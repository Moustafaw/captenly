import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import {
  getCallerAuthorizedFacilityIds,
  getCallerFacilityAccessRole,
  getServerCaller,
} from "@/lib/memberSession";
import { getDeterministicCoachId } from "@/lib/coachProvisioning";
import { enforceRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/server/rateLimit";
import {
  dispatchWhatsAppNotification,
  getWhatsAppProviderStatus,
  listWhatsAppDispatches,
  retryDueWhatsAppDispatches,
} from "@/lib/server/whatsappNotifications";
import type { SessionLedger } from "@/types/captenly";

export const runtime = "nodejs";

async function findLedgerById(ledgerId: string): Promise<Record<string, unknown> | null> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_session_ledgers")
        .select("*")
        .eq("id", ledgerId)
        .maybeSingle();
      if (!error && data) return data as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  const pg = await withPgClient(async (client) => {
    const { rows } = await client.query(
      `select * from public.captenly_session_ledgers where id = $1 limit 1`,
      [ledgerId]
    );
    return (rows[0] as Record<string, unknown>) || null;
  });
  return pg.ok ? pg.value : null;
}

export async function GET(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, error: "unauthorized", dispatches: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const facilityId = (searchParams.get("facilityId") || "").trim();
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));

  if (facilityId) {
    const authorizedIds = caller.isAdmin
      ? new Set([facilityId])
      : await getCallerAuthorizedFacilityIds(caller);
    if (!caller.isAdmin && !authorizedIds.has(facilityId)) {
      return NextResponse.json({ ok: false, error: "forbidden", dispatches: [] }, { status: 403 });
    }
    const dispatches = await listWhatsAppDispatches({ facilityId, limit });
    return NextResponse.json({
      ok: true,
      providerStatus: getWhatsAppProviderStatus(),
      dispatches,
    });
  }

  if (!caller.memberCode) {
    return NextResponse.json({
      ok: true,
      providerStatus: getWhatsAppProviderStatus(),
      dispatches: [],
    });
  }

  const dispatches = await listWhatsAppDispatches({
    recipientMemberCode: caller.memberCode,
    limit,
  });
  return NextResponse.json({
    ok: true,
    providerStatus: getWhatsAppProviderStatus(),
    dispatches,
  });
}

export async function POST(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rl = await enforceRateLimit({
    bucket: "notifications:whatsapp",
    identifier: `${caller.memberCode || getClientIp(request)}`,
    limit: 20,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl.retryAfterSec);
  }

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const action = String(body?.action || "");

    if (action === "send_test") {
      if (!caller.memberCode) {
        return NextResponse.json(
          { ok: false, error: "missing_member_code", messageAr: "لا يوجد كود عضو مرتبط بالحساب." },
          { status: 400 }
        );
      }
      const testRl = await enforceRateLimit({
        bucket: "notifications:whatsapp:test",
        identifier: caller.memberCode,
        limit: 3,
        windowSec: 300,
      });
      if (!testRl.allowed) {
        return rateLimitExceededResponse(testRl.retryAfterSec);
      }

      const result = await dispatchWhatsAppNotification({
        eventType: "test_message",
        recipientMemberCode: caller.memberCode,
        explicitPhone: typeof body?.phone === "string" ? body.phone : undefined,
        athleteNameAr:
          typeof body?.fullNameAr === "string" && body.fullNameAr.trim()
            ? body.fullNameAr.trim()
            : caller.memberCode,
        facilityNameAr: "كابتنلي",
        dedupeScope: `test-${Date.now()}`,
        skipPreferenceCheck: true,
      });

      return NextResponse.json({
        ...result,
        providerStatus: getWhatsAppProviderStatus(),
      });
    }

    if (action === "retry_failed") {
      const facilityId = typeof body?.facilityId === "string" ? body.facilityId.trim() : "";
      if (!caller.isAdmin) {
        if (!facilityId) {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
        const role = await getCallerFacilityAccessRole(facilityId, caller);
        if (role !== "owner" && role !== "general_staff" && role !== "subscriptions_manager" && role !== "admin") {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
      }
      const summary = await retryDueWhatsAppDispatches({
        facilityId: facilityId || undefined,
        limit: 15,
      });
      return NextResponse.json({
        ok: true,
        ...summary,
        messageAr: `تمت إعادة محاولة ${summary.attempted} إشعار: نجح ${summary.sent} وفشل ${summary.failed}.`,
      });
    }

    if (
      action === "send_absence_alert" ||
      action === "send_session_reminder" ||
      action === "send_renewal_reminder"
    ) {
      const ledgerId = typeof body?.ledgerId === "string" ? body.ledgerId.trim() : "";
      if (!ledgerId) {
        return NextResponse.json({ ok: false, error: "missing_ledger_id" }, { status: 400 });
      }
      const row = await findLedgerById(ledgerId);
      if (!row) {
        return NextResponse.json(
          { ok: false, error: "ledger_not_found", messageAr: "لم يتم العثور على سجل الاشتراك." },
          { status: 404 }
        );
      }

      const payload = ((row.payload || {}) as Partial<SessionLedger>) || {};
      const facilityId = String(row.facility_id || payload.facilityId || "");
      const coachId = String(row.coach_id || payload.coachId || "");
      const callerCoachId =
        caller.linkedCoachId ||
        (caller.role === "coach" && caller.memberCode ? getDeterministicCoachId(caller.memberCode) : undefined);

      const accessRole = facilityId ? await getCallerFacilityAccessRole(facilityId, caller) : "none";
      const isFacilityAuthorized =
        accessRole === "admin" ||
        accessRole === "owner" ||
        accessRole === "general_staff" ||
        accessRole === "subscriptions_manager";
      const isCoachAuthorized = Boolean(callerCoachId && coachId && callerCoachId === coachId);

      if (!caller.isAdmin && !isFacilityAuthorized && !isCoachAuthorized) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }

      const recipientMemberCode = String(
        row.member_code || payload.memberCode || payload.athleteId || ""
      ).trim();
      if (!recipientMemberCode) {
        return NextResponse.json(
          { ok: false, error: "missing_recipient_member_code", messageAr: "لا يوجد كود عضو لهذا المشترك." },
          { status: 400 }
        );
      }

      const completedSessions = Number(row.completed_sessions ?? payload.completedSessions ?? 0);
      const totalSessions = Number(row.total_sessions ?? payload.totalSessions ?? 0);
      const remainingSessions = Math.max(0, totalSessions - completedSessions);

      const eventType =
        action === "send_absence_alert"
          ? "absence_alert"
          : action === "send_session_reminder"
            ? "session_reminder"
            : "subscription_expiring";

      const result = await dispatchWhatsAppNotification({
        eventType,
        recipientMemberCode,
        explicitPhone:
          typeof (payload as Record<string, unknown>).parentPhone === "string"
            ? String((payload as Record<string, unknown>).parentPhone)
            : null,
        facilityId: facilityId || null,
        ledgerId,
        athleteNameAr: String(row.athlete_name_ar || payload.athleteNameAr || "السبّاح"),
        facilityNameAr: String(payload.facilityNameAr || "كابتنلي"),
        completedSessions,
        totalSessions,
        remainingSessions,
        actionHref: `/dashboard/ledger?id=${encodeURIComponent(ledgerId)}`,
      });

      return NextResponse.json({
        ...result,
        providerStatus: getWhatsAppProviderStatus(),
      });
    }

    return NextResponse.json({ ok: false, error: "unsupported_action" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
}
