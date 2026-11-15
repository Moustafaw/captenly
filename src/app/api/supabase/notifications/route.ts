import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { callerHasAnyStaffRole, getServerCaller } from "@/lib/memberSession";

export const runtime = "nodejs";

async function ensureNotificationsTableViaPg() {
  await withPgClient(async (client) => {
    await client.query(`
      create table if not exists public.captenly_notifications (
        id uuid default gen_random_uuid() primary key,
        member_code text not null,
        title_ar text not null,
        message_ar text not null,
        notif_type text default 'system',
        action_label_ar text,
        action_href text,
        is_read boolean default false,
        created_at timestamptz default now()
      );
      alter table public.captenly_notifications enable row level security;
      drop policy if exists "captenly_notifications_public_read" on public.captenly_notifications;
    `);
    return true;
  });
}

export async function GET(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ persisted: false, error: "unauthorized", items: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memberCode = (searchParams.get("memberCode") || "").trim();
  if (!memberCode) {
    return NextResponse.json({ persisted: false, items: [] });
  }

  if (
    !caller.isAdmin &&
    (!caller.memberCode || caller.memberCode.toUpperCase() !== memberCode.toUpperCase())
  ) {
    return NextResponse.json({ persisted: false, error: "forbidden", items: [] }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_notifications")
        .select("*")
        .eq("member_code", memberCode)
        .order("created_at", { ascending: false })
        .limit(40);
      if (!error) {
        return NextResponse.json({ persisted: true, items: data || [] });
      }
    } catch {
      // fall through to pg
    }
  }

  await ensureNotificationsTableViaPg();
  const pgRes = await withPgClient(async (client) => {
    const { rows } = await client.query(
      `select * from public.captenly_notifications where member_code = $1 order by created_at desc limit 40`,
      [memberCode]
    );
    return rows;
  });

  if (pgRes.ok) {
    return NextResponse.json({ persisted: true, items: pgRes.value });
  }

  return NextResponse.json({ persisted: false, items: [] });
}

export async function POST(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ persisted: false, reason: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const admin = getSupabaseAdminClient();

    if (body.markReadId) {
      const markReadId = String(body.markReadId);
      if (admin) {
        let updateQuery = admin
          .from("captenly_notifications")
          .update({ is_read: true })
          .eq("id", markReadId);
        if (!caller.isAdmin && caller.memberCode) {
          updateQuery = updateQuery.eq("member_code", caller.memberCode);
        }
        const { error } = await updateQuery;
        if (!error) return NextResponse.json({ persisted: true });
      }
      await ensureNotificationsTableViaPg();
      const pgRes = await withPgClient(async (client) => {
        if (!caller.isAdmin && caller.memberCode) {
          await client.query(
            `update public.captenly_notifications set is_read = true where id::text = $1 and upper(member_code) = upper($2)`,
            [markReadId, caller.memberCode]
          );
        } else {
          await client.query(
            `update public.captenly_notifications set is_read = true where id::text = $1`,
            [markReadId]
          );
        }
        return true;
      });
      return NextResponse.json({ persisted: pgRes.ok });
    }

    const row = {
      member_code: String(body.memberCode || ""),
      title_ar: String(body.titleAr || ""),
      message_ar: String(body.messageAr || ""),
      notif_type: String(body.type || "system"),
      action_label_ar: body.actionLabelAr ? String(body.actionLabelAr) : null,
      action_href: body.actionHref ? String(body.actionHref) : null,
      is_read: false,
    };

    const isSelfTarget =
      Boolean(caller.memberCode) &&
      caller.memberCode!.toUpperCase() === row.member_code.trim().toUpperCase();
    const isProviderOrAdmin =
      caller.isAdmin ||
      Boolean(caller.linkedCoachId) ||
      Boolean(caller.linkedFacilityId) ||
      (await callerHasAnyStaffRole(caller, ["general_staff", "subscriptions_manager"]));

    if (!isSelfTarget && !isProviderOrAdmin) {
      return NextResponse.json({ persisted: false, reason: "forbidden" }, { status: 403 });
    }

    if (!row.member_code || !row.title_ar) {
      return NextResponse.json({ persisted: false, reason: "missing_fields" }, { status: 400 });
    }

    if (admin) {
      const { error } = await admin.from("captenly_notifications").insert(row);
      if (!error) return NextResponse.json({ persisted: true });
    }

    await ensureNotificationsTableViaPg();
    const pgRes = await withPgClient(async (client) => {
      await client.query(
        `insert into public.captenly_notifications
          (member_code, title_ar, message_ar, notif_type, action_label_ar, action_href, is_read)
         values ($1,$2,$3,$4,$5,$6,false)`,
        [
          row.member_code,
          row.title_ar,
          row.message_ar,
          row.notif_type,
          row.action_label_ar,
          row.action_href,
        ]
      );
      return true;
    });

    return NextResponse.json({ persisted: pgRes.ok });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
