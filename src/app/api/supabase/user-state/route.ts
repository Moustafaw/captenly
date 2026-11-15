import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getServerCaller, hasFacilityStaffAccess, type ServerCallerContext } from "@/lib/memberSession";
import type {
  MinorAthleteProfile,
  PersonalBestRecord,
  SkillEvaluation5Point,
} from "@/types/captenly";

export const runtime = "nodejs";

async function ensureUserStateTablesViaPg() {
  await withPgClient(async (client) => {
    await client.query(`
      create table if not exists public.captenly_pb_records (
        id text primary key,
        member_code text not null,
        athlete_id text not null,
        payload jsonb not null,
        updated_at timestamptz default now()
      );
      create table if not exists public.captenly_skill_evaluations (
        athlete_id text primary key,
        member_code text not null,
        payload jsonb not null,
        updated_at timestamptz default now()
      );
      create table if not exists public.captenly_minor_athletes (
        id text primary key,
        parent_member_code text not null,
        child_member_code text,
        full_name_ar text,
        payload jsonb not null,
        updated_at timestamptz default now()
      );
      create table if not exists public.captenly_user_prefs (
        member_code text primary key,
        favorites jsonb default '[]'::jsonb,
        compare_ids jsonb default '[]'::jsonb,
        user_settings jsonb default '{}'::jsonb,
        user_location jsonb default '{}'::jsonb,
        updated_at timestamptz default now()
      );
      alter table public.captenly_pb_records enable row level security;
      alter table public.captenly_skill_evaluations enable row level security;
      alter table public.captenly_minor_athletes enable row level security;
      alter table public.captenly_user_prefs enable row level security;
      alter table public.captenly_minor_athletes add column if not exists child_member_code text;
      alter table public.captenly_minor_athletes add column if not exists full_name_ar text;
    `);
    return true;
  });
}

async function isProviderLinkedToAthlete(
  caller: ServerCallerContext,
  memberCode: string,
  athleteId?: string
): Promise<boolean> {
  if (!caller.authenticated) return false;
  if (caller.isAdmin) return true;

  let rows: Array<{ coach_id?: string | null; facility_id?: string | null }> = [];
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      let query = admin
        .from("captenly_session_ledgers")
        .select("coach_id, facility_id")
        .limit(40);
      if (athleteId) {
        query = query.or(`member_code.eq.${memberCode},athlete_id.eq.${athleteId}`);
      } else {
        query = query.eq("member_code", memberCode);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        rows = data as typeof rows;
      }
    } catch {
      // fall through
    }
  }

  if (rows.length === 0) {
    const pg = await withPgClient(async (client) => {
      const res = athleteId
        ? await client.query(
            `select coach_id, facility_id from public.captenly_session_ledgers
             where upper(coalesce(member_code, '')) = upper($1) or athlete_id = $2 limit 40`,
            [memberCode, athleteId]
          )
        : await client.query(
            `select coach_id, facility_id from public.captenly_session_ledgers
             where upper(coalesce(member_code, '')) = upper($1) limit 40`,
            [memberCode]
          );
      return res.rows as typeof rows;
    });
    if (pg.ok) rows = pg.value;
  }

  for (const r of rows) {
    if (caller.linkedCoachId && r.coach_id === caller.linkedCoachId) return true;
    if (caller.linkedFacilityId && r.facility_id === caller.linkedFacilityId) return true;
    if (r.facility_id && (await hasFacilityStaffAccess(r.facility_id, caller, ["general_staff", "subscriptions_manager"]))) {
      return true;
    }
  }
  return false;
}

export async function GET(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memberCode = (searchParams.get("memberCode") || "").trim().toUpperCase();
  const athleteIdsParam = (searchParams.get("athleteIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!memberCode) {
    return NextResponse.json({ ok: false, reason: "missing_member_code" }, { status: 400 });
  }

  if (
    !caller.isAdmin &&
    (!caller.memberCode || caller.memberCode.toUpperCase() !== memberCode)
  ) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const [pbRes, evalRes, minorRes, prefRes] = await Promise.all([
        admin.from("captenly_pb_records").select("payload").eq("member_code", memberCode).limit(60),
        athleteIdsParam.length > 0
          ? admin.from("captenly_skill_evaluations").select("athlete_id, payload").in("athlete_id", athleteIdsParam)
          : admin.from("captenly_skill_evaluations").select("athlete_id, payload").eq("member_code", memberCode),
        admin.from("captenly_minor_athletes").select("payload").eq("parent_member_code", memberCode).limit(20),
        admin.from("captenly_user_prefs").select("*").eq("member_code", memberCode).limit(1),
      ]);

      if (!pbRes.error && !evalRes.error && !minorRes.error && !prefRes.error) {
        const skillEvaluations: Record<string, SkillEvaluation5Point> = {};
        for (const r of evalRes.data || []) {
          const row = r as { athlete_id: string; payload: SkillEvaluation5Point };
          if (row.athlete_id && row.payload) skillEvaluations[row.athlete_id] = row.payload;
        }
        const prefRow = (prefRes.data?.[0] || null) as Record<string, unknown> | null;
        return NextResponse.json({
          ok: true,
          pbRecords: (pbRes.data || []).map((r) => (r as { payload: PersonalBestRecord }).payload),
          skillEvaluations,
          minorAthletes: (minorRes.data || []).map((r) => (r as { payload: MinorAthleteProfile }).payload),
          prefs: prefRow
            ? {
                favorites: Array.isArray(prefRow.favorites) ? prefRow.favorites : undefined,
                compareIds: Array.isArray(prefRow.compare_ids) ? prefRow.compare_ids : undefined,
                userSettings: prefRow.user_settings || undefined,
                userLocation: prefRow.user_location || undefined,
              }
            : null,
        });
      }
    } catch {
      // fall through to pg
    }
  }

  await ensureUserStateTablesViaPg();
  const pgRes = await withPgClient(async (client) => {
    const [pbRows, evalRows, minorRows, prefRows] = await Promise.all([
      client.query(`select payload from public.captenly_pb_records where member_code = $1 order by updated_at desc limit 60`, [memberCode]),
      athleteIdsParam.length > 0
        ? client.query(`select athlete_id, payload from public.captenly_skill_evaluations where athlete_id = any($1::text[])`, [athleteIdsParam])
        : client.query(`select athlete_id, payload from public.captenly_skill_evaluations where member_code = $1`, [memberCode]),
      client.query(`select payload from public.captenly_minor_athletes where parent_member_code = $1 order by updated_at desc limit 20`, [memberCode]),
      client.query(`select favorites, compare_ids, user_settings, user_location from public.captenly_user_prefs where member_code = $1 limit 1`, [memberCode]),
    ]);
    return {
      pbRows: pbRows.rows,
      evalRows: evalRows.rows,
      minorRows: minorRows.rows,
      prefRow: prefRows.rows[0] || null,
    };
  });

  if (pgRes.ok) {
    const skillEvaluations: Record<string, SkillEvaluation5Point> = {};
    for (const r of pgRes.value.evalRows) {
      if (r.athlete_id && r.payload) {
        skillEvaluations[String(r.athlete_id)] = r.payload as SkillEvaluation5Point;
      }
    }
    const pref = pgRes.value.prefRow as Record<string, unknown> | null;
    return NextResponse.json({
      ok: true,
      pbRecords: pgRes.value.pbRows.map((r) => r.payload as PersonalBestRecord),
      skillEvaluations,
      minorAthletes: pgRes.value.minorRows.map((r) => r.payload as MinorAthleteProfile),
      prefs: pref
        ? {
            favorites: Array.isArray(pref.favorites) ? pref.favorites : undefined,
            compareIds: Array.isArray(pref.compare_ids) ? pref.compare_ids : undefined,
            userSettings: pref.user_settings || undefined,
            userLocation: pref.user_location || undefined,
          }
        : null,
    });
  }

  return NextResponse.json({ ok: false, pbRecords: [], skillEvaluations: {}, minorAthletes: [], prefs: null });
}

export async function POST(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ persisted: false, reason: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      type: "pb" | "skill_eval" | "minor_upsert" | "minor_delete" | "prefs";
      memberCode: string;
      pbRecord?: PersonalBestRecord;
      skillEvaluation?: SkillEvaluation5Point;
      minorAthlete?: MinorAthleteProfile;
      minorId?: string;
      prefs?: {
        favorites?: string[];
        compareIds?: string[];
        userSettings?: Record<string, unknown>;
        userLocation?: Record<string, unknown>;
      };
    };

    const memberCode = (body.memberCode || "").trim().toUpperCase();
    if (!memberCode || !body.type) {
      return NextResponse.json({ persisted: false }, { status: 400 });
    }

    const isSelfOwner = Boolean(caller.memberCode && caller.memberCode.toUpperCase() === memberCode);
    const targetAthleteId = body.pbRecord?.athleteId || body.skillEvaluation?.athleteId;

    if (body.type === "pb" || body.type === "skill_eval") {
      if (!caller.isAdmin && !isSelfOwner) {
        const linked = await isProviderLinkedToAthlete(caller, memberCode, targetAthleteId);
        if (!linked) {
          return NextResponse.json({ persisted: false, reason: "forbidden" }, { status: 403 });
        }
      }
    } else if (!caller.isAdmin && !isSelfOwner) {
      return NextResponse.json({ persisted: false, reason: "forbidden" }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();
    await ensureUserStateTablesViaPg();

    if (body.type === "pb" && body.pbRecord?.id) {
      const rec = body.pbRecord;
      if (admin) {
        const { error } = await admin.from("captenly_pb_records").upsert(
          {
            id: rec.id,
            member_code: memberCode,
            athlete_id: rec.athleteId,
            payload: rec,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        if (!error) return NextResponse.json({ persisted: true });
      }
      const pg = await withPgClient(async (client) => {
        await client.query(
          `insert into public.captenly_pb_records (id, member_code, athlete_id, payload, updated_at)
           values ($1,$2,$3,$4::jsonb,now())
           on conflict (id) do update set payload = excluded.payload, updated_at = now()`,
          [rec.id, memberCode, rec.athleteId, JSON.stringify(rec)]
        );
        return true;
      });
      return NextResponse.json({ persisted: pg.ok });
    }

    if (body.type === "skill_eval" && body.skillEvaluation?.athleteId) {
      const ev = body.skillEvaluation;
      if (admin) {
        const { error } = await admin.from("captenly_skill_evaluations").upsert(
          {
            athlete_id: ev.athleteId,
            member_code: memberCode,
            payload: ev,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "athlete_id" }
        );
        if (!error) return NextResponse.json({ persisted: true });
      }
      const pg = await withPgClient(async (client) => {
        await client.query(
          `insert into public.captenly_skill_evaluations (athlete_id, member_code, payload, updated_at)
           values ($1,$2,$3::jsonb,now())
           on conflict (athlete_id) do update set payload = excluded.payload, member_code = excluded.member_code, updated_at = now()`,
          [ev.athleteId, memberCode, JSON.stringify(ev)]
        );
        return true;
      });
      return NextResponse.json({ persisted: pg.ok });
    }

    if (body.type === "minor_upsert" && body.minorAthlete?.id) {
      const child = body.minorAthlete;
      if (admin) {
        const { error } = await admin.from("captenly_minor_athletes").upsert(
          {
            id: child.id,
            parent_member_code: memberCode,
            child_member_code: child.childMemberCode || null,
            full_name_ar: child.fullNameAr || null,
            payload: child,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        if (!error) return NextResponse.json({ persisted: true });
      }
      const pg = await withPgClient(async (client) => {
        await client.query(
          `insert into public.captenly_minor_athletes (id, parent_member_code, child_member_code, full_name_ar, payload, updated_at)
           values ($1,$2,$3,$4,$5::jsonb,now())
           on conflict (id) do update set
             child_member_code = coalesce(excluded.child_member_code, public.captenly_minor_athletes.child_member_code),
             full_name_ar = coalesce(excluded.full_name_ar, public.captenly_minor_athletes.full_name_ar),
             payload = excluded.payload,
             updated_at = now()
           where upper(public.captenly_minor_athletes.parent_member_code) = upper($2)`,
          [child.id, memberCode, child.childMemberCode || null, child.fullNameAr || null, JSON.stringify(child)]
        );
        return true;
      });
      return NextResponse.json({ persisted: pg.ok });
    }

    if (body.type === "minor_delete" && body.minorId) {
      if (admin) {
        const { error } = await admin
          .from("captenly_minor_athletes")
          .delete()
          .eq("id", body.minorId)
          .eq("parent_member_code", memberCode);
        if (!error) return NextResponse.json({ persisted: true });
      }
      const pg = await withPgClient(async (client) => {
        await client.query(
          `delete from public.captenly_minor_athletes where id = $1 and parent_member_code = $2`,
          [body.minorId, memberCode]
        );
        return true;
      });
      return NextResponse.json({ persisted: pg.ok });
    }

    if (body.type === "prefs" && body.prefs) {
      const p = body.prefs;
      if (admin) {
        const { error } = await admin.from("captenly_user_prefs").upsert(
          {
            member_code: memberCode,
            ...(p.favorites !== undefined ? { favorites: p.favorites } : {}),
            ...(p.compareIds !== undefined ? { compare_ids: p.compareIds } : {}),
            ...(p.userSettings !== undefined ? { user_settings: p.userSettings } : {}),
            ...(p.userLocation !== undefined ? { user_location: p.userLocation } : {}),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_code" }
        );
        if (!error) return NextResponse.json({ persisted: true });
      }
      const pg = await withPgClient(async (client) => {
        await client.query(
          `insert into public.captenly_user_prefs (member_code, favorites, compare_ids, user_settings, user_location, updated_at)
           values ($1, coalesce($2::jsonb, '[]'::jsonb), coalesce($3::jsonb, '[]'::jsonb), coalesce($4::jsonb, '{}'::jsonb), coalesce($5::jsonb, '{}'::jsonb), now())
           on conflict (member_code) do update set
             favorites = case when $2 is not null then $2::jsonb else public.captenly_user_prefs.favorites end,
             compare_ids = case when $3 is not null then $3::jsonb else public.captenly_user_prefs.compare_ids end,
             user_settings = case when $4 is not null then $4::jsonb else public.captenly_user_prefs.user_settings end,
             user_location = case when $5 is not null then $5::jsonb else public.captenly_user_prefs.user_location end,
             updated_at = now()`,
          [
            memberCode,
            p.favorites ? JSON.stringify(p.favorites) : null,
            p.compareIds ? JSON.stringify(p.compareIds) : null,
            p.userSettings ? JSON.stringify(p.userSettings) : null,
            p.userLocation ? JSON.stringify(p.userLocation) : null,
          ]
        );
        return true;
      });
      return NextResponse.json({ persisted: pg.ok });
    }

    return NextResponse.json({ persisted: false }, { status: 400 });
  } catch {
    return NextResponse.json({ persisted: false }, { status: 400 });
  }
}
