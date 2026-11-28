import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getServerCaller } from "@/lib/memberSession";
import {
  dispatchWhatsAppNotification,
  getCairoDateString,
  retryDueWhatsAppDispatches,
} from "@/lib/server/whatsappNotifications";
import type { SessionLedger } from "@/types/captenly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorizeCronOrAdmin(request: Request): Promise<boolean> {
  const secret = (process.env.CRON_SECRET || "").trim();
  const authHeader = (request.headers.get("authorization") || "").trim();
  if (secret && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const a = Buffer.from(token, "utf8");
    const b = Buffer.from(secret, "utf8");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  const caller = await getServerCaller().catch(() => null);
  return Boolean(caller?.authenticated && caller.isAdmin);
}

async function fetchActiveLedgers(limit = 200): Promise<Record<string, unknown>[]> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_session_ledgers")
        .select("*")
        .in("status", ["active", "renewal_due"])
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (!error && Array.isArray(data)) {
        return data as Record<string, unknown>[];
      }
    } catch {
      // fall through
    }
  }

  const pg = await withPgClient(async (client) => {
    const { rows } = await client.query(
      `select * from public.captenly_session_ledgers
       where status in ('active', 'renewal_due')
       order by updated_at desc limit $1`,
      [limit]
    );
    return rows as Record<string, unknown>[];
  });
  return pg.ok ? pg.value : [];
}

function getCairoWeekdayTokens(date = new Date()): { arDay: string; isoDate: string } {
  const isoDate = getCairoDateString(date);
  const arDay = new Intl.DateTimeFormat("ar-EG", {
    timeZone: "Africa/Cairo",
    weekday: "long",
  }).format(date);
  return { arDay, isoDate };
}

function shouldSendSessionReminderToday(payload: Record<string, unknown>, todayArDay: string): boolean {
  const schedule =
    typeof payload.scheduleDaysAr === "string"
      ? payload.scheduleDaysAr.trim()
      : typeof payload.startedDateAr === "string"
        ? payload.startedDateAr.trim()
        : "";
  if (!schedule) return false;
  const cleanToday = todayArDay.replace(/أ|إ|آ/g, "ا");
  const cleanSched = schedule.replace(/أ|إ|آ/g, "ا");
  return cleanSched.includes(cleanToday);
}

async function runCronRemindersHandler(request: Request) {
  if (!(await authorizeCronOrAdmin(request))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { arDay, isoDate } = getCairoWeekdayTokens();
  const rows = await fetchActiveLedgers(200);

  let scanned = 0;
  let sessionRemindersTriggered = 0;
  let expiryRemindersTriggered = 0;

  for (const row of rows) {
    scanned += 1;
    const payload = ((row.payload || {}) as Partial<SessionLedger>) || {};
    const ledgerId = String(row.id || payload.id || "");
    const memberCode = String(row.member_code || payload.memberCode || "").trim();
    if (!ledgerId || !memberCode) continue;

    const completed = Number(row.completed_sessions ?? payload.completedSessions ?? 0);
    const total = Number(row.total_sessions ?? payload.totalSessions ?? 0);
    const remaining = Math.max(0, total - completed);
    if (remaining <= 0) continue;

    const common = {
      recipientMemberCode: memberCode,
      explicitPhone:
        typeof (payload as Record<string, unknown>).parentPhone === "string"
          ? String((payload as Record<string, unknown>).parentPhone)
          : null,
      facilityId: row.facility_id ? String(row.facility_id) : payload.facilityId || null,
      ledgerId,
      athleteNameAr: String(row.athlete_name_ar || payload.athleteNameAr || "السبّاح"),
      facilityNameAr: String(payload.facilityNameAr || "كابتنلي"),
      completedSessions: completed,
      totalSessions: total,
      remainingSessions: remaining,
      dateKey: isoDate,
      actionHref: `/dashboard/ledger?id=${encodeURIComponent(ledgerId)}`,
    };

    if (shouldSendSessionReminderToday(payload as Record<string, unknown>, arDay)) {
      const r = await dispatchWhatsAppNotification({
        ...common,
        eventType: "session_reminder",
      });
      if (!r.deduplicated) sessionRemindersTriggered += 1;
    }

    if (remaining <= 2) {
      const r = await dispatchWhatsAppNotification({
        ...common,
        eventType: "subscription_expiring",
        dedupeScope: `${ledgerId}-rem-${remaining}`,
      });
      if (!r.deduplicated) expiryRemindersTriggered += 1;
    }
  }

  const retrySummary = await retryDueWhatsAppDispatches({ limit: 20 });

  return NextResponse.json({
    ok: true,
    cairoDate: isoDate,
    scanned,
    sessionRemindersTriggered,
    expiryRemindersTriggered,
    retrySummary,
  });
}

export async function GET(request: Request) {
  return runCronRemindersHandler(request);
}

export async function POST(request: Request) {
  return runCronRemindersHandler(request);
}
