import { NextResponse } from "next/server";
import type { SessionLedger } from "@/types/captenly";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CREATE_LEDGER_TABLE_SQL = `
create table if not exists public.captenly_session_ledgers (
  id text primary key,
  ledger_code text not null unique,
  member_code text,
  athlete_id text not null,
  athlete_name_ar text not null,
  coach_id text not null,
  facility_id text not null,
  pin_code text not null,
  total_sessions integer not null,
  completed_sessions integer not null default 0,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_captenly_session_ledgers_member_code on public.captenly_session_ledgers (member_code);
create index if not exists idx_captenly_session_ledgers_athlete_id on public.captenly_session_ledgers (athlete_id);
create index if not exists idx_captenly_session_ledgers_coach_id on public.captenly_session_ledgers (coach_id);
create index if not exists idx_captenly_session_ledgers_facility_id on public.captenly_session_ledgers (facility_id);
alter table public.captenly_session_ledgers enable row level security;
notify pgrst, 'reload schema';
`;

function getPostgresConnectionString(): string {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    ""
  ).trim();
}

let tableBootstrapped = false;

async function ensureLedgerTableExists(): Promise<boolean> {
  if (tableBootstrapped) return true;
  const connStr = getPostgresConnectionString();
  if (!connStr) return false;
  try {
    const { Client } = await import("pg");
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(CREATE_LEDGER_TABLE_SQL);
    await client.end();
    tableBootstrapped = true;
    return true;
  } catch {
    return false;
  }
}

function rowToSessionLedger(row: Record<string, unknown>): SessionLedger | null {
  const payload = (row.payload || {}) as Partial<SessionLedger>;
  const id = String(row.id || payload.id || "");
  const ledgerCode = String(row.ledger_code || payload.ledgerCode || "");
  if (!id || !ledgerCode) return null;

  return {
    id,
    ledgerCode,
    memberCode: (row.member_code as string) || payload.memberCode,
    athleteId: String(row.athlete_id || payload.athleteId || ""),
    athleteNameAr: String(row.athlete_name_ar || payload.athleteNameAr || ""),
    isMinor: Boolean(payload.isMinor),
    parentNameAr: payload.parentNameAr,
    coachId: String(row.coach_id || payload.coachId || ""),
    coachNameAr: payload.coachNameAr || "",
    facilityId: String(row.facility_id || payload.facilityId || ""),
    facilityNameAr: payload.facilityNameAr || "",
    sportSector: payload.sportSector === "fitness" ? "fitness" : "swimming",
    packageTitleAr: payload.packageTitleAr || "باقة سباحة",
    totalSessions: ([8, 12, 24].includes(Number(row.total_sessions || payload.totalSessions))
      ? Number(row.total_sessions || payload.totalSessions)
      : 8) as 8 | 12 | 24,
    completedSessions: Number(row.completed_sessions ?? payload.completedSessions ?? 0),
    pinCode: String(row.pin_code || payload.pinCode || "0000"),
    status: (row.status || payload.status || "active") as SessionLedger["status"],
    startedDateAr: payload.startedDateAr || "مفعل عبر كابتنلي",
    checkins: Array.isArray(payload.checkins) ? payload.checkins : [],
    receipts: Array.isArray(payload.receipts) ? payload.receipts : [],
  };
}

async function queryLedgersWithPgFallback(filters: {
  memberCode?: string;
  athleteId?: string;
  coachId?: string;
  facilityId?: string;
  ledgerCode?: string;
}): Promise<SessionLedger[]> {
  const connStr = getPostgresConnectionString();
  if (!connStr) return [];
  try {
    const { Client } = await import("pg");
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(CREATE_LEDGER_TABLE_SQL);
    tableBootstrapped = true;

    const conditions: string[] = [];
    const values: string[] = [];
    if (filters.ledgerCode) {
      values.push(filters.ledgerCode);
      conditions.push(`upper(ledger_code) = upper($${values.length})`);
    }
    if (filters.memberCode) {
      values.push(filters.memberCode);
      conditions.push(`upper(member_code) = upper($${values.length})`);
    }
    if (filters.athleteId) {
      values.push(filters.athleteId);
      conditions.push(`athlete_id = $${values.length}`);
    }
    if (filters.coachId) {
      values.push(filters.coachId);
      conditions.push(`coach_id = $${values.length}`);
    }
    if (filters.facilityId) {
      values.push(filters.facilityId);
      conditions.push(`facility_id = $${values.length}`);
    }

    if (conditions.length === 0) {
      await client.end();
      return [];
    }

    const sql = `SELECT * FROM public.captenly_session_ledgers WHERE ${conditions.join(" OR ")} ORDER BY updated_at DESC LIMIT 80`;
    const res = await client.query(sql, values);
    await client.end();
    return (res.rows || [])
      .map((r) => rowToSessionLedger(r as Record<string, unknown>))
      .filter((x): x is SessionLedger => Boolean(x));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const admin = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const memberCode = (searchParams.get("memberCode") || "").trim().toUpperCase();
  const athleteId = (searchParams.get("athleteId") || "").trim();
  const coachId = (searchParams.get("coachId") || "").trim();
  const facilityId = (searchParams.get("facilityId") || "").trim();
  const ledgerCode = (searchParams.get("ledgerCode") || "").trim().toUpperCase();

  if (!memberCode && !athleteId && !coachId && !facilityId && !ledgerCode) {
    return NextResponse.json({ persisted: false, ledgers: [], profile: null });
  }

  let matchedProfile: {
    memberCode: string;
    fullNameAr: string;
    phone: string;
    city: string;
    role: string;
    avatarUrl?: string;
  } | null = null;

  if (admin && memberCode) {
    try {
      const { data: pRow } = await admin
        .from("captenly_profiles")
        .select("member_code, full_name_ar, phone, city, role, avatar_url")
        .ilike("member_code", memberCode)
        .maybeSingle();

      if (pRow) {
        matchedProfile = {
          memberCode: String(pRow.member_code),
          fullNameAr: String(pRow.full_name_ar),
          phone: pRow.phone ? String(pRow.phone) : "",
          city: pRow.city ? String(pRow.city) : "مصر",
          role: String(pRow.role || "adult_athlete"),
          avatarUrl: pRow.avatar_url ? String(pRow.avatar_url) : undefined,
        };
      }
    } catch {
      // ignore profile lookup error
    }
  }

  if (!admin) {
    return NextResponse.json({
      persisted: false,
      ledgers: [],
      profile: matchedProfile,
      reason: "supabase_not_configured",
    });
  }

  try {
    const orClauses: string[] = [];
    if (ledgerCode) orClauses.push(`ledger_code.ilike.${ledgerCode}`);
    if (memberCode) orClauses.push(`member_code.ilike.${memberCode}`);
    if (athleteId) orClauses.push(`athlete_id.eq.${athleteId}`);
    if (coachId) orClauses.push(`coach_id.eq.${coachId}`);
    if (facilityId) orClauses.push(`facility_id.eq.${facilityId}`);

    let { data, error } = await admin
      .from("captenly_session_ledgers")
      .select("*")
      .or(orClauses.join(","))
      .order("updated_at", { ascending: false })
      .limit(80);

    if (error && (error.code === "42P01" || error.code === "PGRST205")) {
      const bootOk = await ensureLedgerTableExists();
      if (bootOk) {
        const retry = await admin
          .from("captenly_session_ledgers")
          .select("*")
          .or(orClauses.join(","))
          .order("updated_at", { ascending: false })
          .limit(80);
        if (!retry.error) {
          data = retry.data;
          error = null;
        } else {
          const directLedgers = await queryLedgersWithPgFallback({
            memberCode,
            athleteId,
            coachId,
            facilityId,
            ledgerCode,
          });
          return NextResponse.json({
            persisted: true,
            ledgers: directLedgers,
            profile: matchedProfile,
          });
        }
      }
    }

    if (error) {
      return NextResponse.json({
        persisted: false,
        ledgers: [],
        profile: matchedProfile,
        reason: error.code || "db_error",
      });
    }

    const ledgers = (data || [])
      .map((r) => rowToSessionLedger(r as Record<string, unknown>))
      .filter((x): x is SessionLedger => Boolean(x));

    return NextResponse.json({
      persisted: true,
      ledgers,
      profile: matchedProfile,
    });
  } catch {
    return NextResponse.json({
      persisted: false,
      ledgers: [],
      profile: matchedProfile,
      reason: "query_error",
    });
  }
}

export async function POST(request: Request) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ persisted: false, reason: "supabase_not_configured" });
  }

  try {
    const body = await request.json();
    const ledger = body?.ledger as SessionLedger | undefined;
    if (!ledger || !ledger.id || !ledger.ledgerCode || !ledger.athleteId) {
      return NextResponse.json({ persisted: false, error: "invalid_ledger" }, { status: 400 });
    }

    const record = {
      id: ledger.id,
      ledger_code: ledger.ledgerCode.toUpperCase(),
      member_code: ledger.memberCode ? ledger.memberCode.trim().toUpperCase() : null,
      athlete_id: ledger.athleteId,
      athlete_name_ar: ledger.athleteNameAr,
      coach_id: ledger.coachId,
      facility_id: ledger.facilityId,
      pin_code: ledger.pinCode,
      total_sessions: ledger.totalSessions,
      completed_sessions: ledger.completedSessions,
      status: ledger.status,
      payload: ledger,
      updated_at: new Date().toISOString(),
    };

    let { error } = await admin
      .from("captenly_session_ledgers")
      .upsert(record, { onConflict: "id" });

    if (error && (error.code === "42P01" || error.code === "PGRST205")) {
      const bootOk = await ensureLedgerTableExists();
      if (bootOk) {
        const retry = await admin
          .from("captenly_session_ledgers")
          .upsert(record, { onConflict: "id" });
        error = retry.error;

        if (error) {
          // Direct pg upsert fallback while PostgREST schema cache catches up
          const connStr = getPostgresConnectionString();
          if (connStr) {
            const { Client } = await import("pg");
            const client = new Client({
              connectionString: connStr,
              ssl: { rejectUnauthorized: false },
            });
            await client.connect();
            await client.query(
              `insert into public.captenly_session_ledgers
                (id, ledger_code, member_code, athlete_id, athlete_name_ar, coach_id, facility_id, pin_code, total_sessions, completed_sessions, status, payload, updated_at)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,now())
               on conflict (id) do update set
                 member_code = excluded.member_code,
                 completed_sessions = excluded.completed_sessions,
                 status = excluded.status,
                 payload = excluded.payload,
                 updated_at = now()`,
              [
                record.id,
                record.ledger_code,
                record.member_code,
                record.athlete_id,
                record.athlete_name_ar,
                record.coach_id,
                record.facility_id,
                record.pin_code,
                record.total_sessions,
                record.completed_sessions,
                record.status,
                JSON.stringify(record.payload),
              ]
            );
            await client.end();
            return NextResponse.json({ persisted: true, ledger });
          }
        }
      }
    }

    if (error) {
      return NextResponse.json({ persisted: false, reason: error.code || "db_error" });
    }

    return NextResponse.json({ persisted: true, ledger });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
