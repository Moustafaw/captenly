import crypto from "crypto";
import { NextResponse } from "next/server";
import type { Facility, FacilityPromoCode, SessionCheckin, SessionLedger } from "@/types/captenly";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { checkCoachDelegatedQrAccess } from "@/lib/server/facilityLinksDb";
import { getDeterministicCoachId } from "@/lib/coachProvisioning";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/server/rateLimit";
import { dispatchWhatsAppNotification } from "@/lib/server/whatsappNotifications";
import {
  getCallerAuthorizedFacilityIds,
  getCallerFacilityAccessRole,
  getServerCaller,
  sanitizeFilterToken,
  type ServerCallerContext,
} from "@/lib/memberSession";

export const dynamic = "force-dynamic";

const DUPLICATE_SCAN_WINDOW_MS = 3 * 60 * 60 * 1000;
const DEFAULT_PAGE_LIMIT = 80;
const MAX_PAGE_LIMIT = 200;

function canCallerReadLedger(
  ledger: SessionLedger,
  caller: ServerCallerContext,
  authorizedFacilityIds: Set<string>,
  callerCoachId?: string
): boolean {
  if (caller.isAdmin) return true;
  if (ledger.facilityId && authorizedFacilityIds.has(ledger.facilityId)) return true;
  if (callerCoachId && ledger.coachId === callerCoachId) return true;
  if (
    caller.memberCode &&
    ledger.memberCode &&
    ledger.memberCode.trim().toUpperCase() === caller.memberCode.trim().toUpperCase()
  ) {
    return true;
  }
  return false;
}

function findRecentCheckinAgeMs(checkins: unknown): number | null {
  if (!Array.isArray(checkins) || checkins.length === 0) return null;
  const now = Date.now();
  let smallestAge: number | null = null;
  for (const c of checkins) {
    if (!c || typeof c !== "object") continue;
    const rawIso = (c as { scannedAtIso?: unknown }).scannedAtIso;
    if (typeof rawIso !== "string") continue;
    const ts = Date.parse(rawIso);
    if (!Number.isFinite(ts)) continue;
    const age = now - ts;
    if (age >= 0 && (smallestAge === null || age < smallestAge)) {
      smallestAge = age;
    }
  }
  return smallestAge;
}

function canCallerSeePin(row: Record<string, unknown>, caller: ServerCallerContext): boolean {
  if (caller.isAdmin) return true;
  const payload = (row.payload || {}) as Partial<SessionLedger>;
  const rowMemberCode = String(row.member_code || payload.memberCode || "")
    .trim()
    .toUpperCase();
  return Boolean(
    caller.memberCode && rowMemberCode && caller.memberCode.toUpperCase() === rowMemberCode
  );
}

function rowToSessionLedger(
  row: Record<string, unknown>,
  revealPin = false
): SessionLedger | null {
  const payload = (row.payload || {}) as Partial<SessionLedger>;
  const id = String(row.id || payload.id || "");
  const ledgerCode = String(row.ledger_code || payload.ledgerCode || "");
  if (!id || !ledgerCode) return null;

  const totalSessions = ([8, 12, 24].includes(Number(row.total_sessions || payload.totalSessions))
    ? Number(row.total_sessions || payload.totalSessions)
    : 8) as 8 | 12 | 24;
  const completedSessions = Number(row.completed_sessions ?? payload.completedSessions ?? 0);
  const status = (
    completedSessions >= totalSessions
      ? "completed"
      : row.status || payload.status || "active"
  ) as SessionLedger["status"];

  return {
    id,
    ledgerCode,
    subscriptionCode: payload.subscriptionCode || ledgerCode,
    memberCode: (row.member_code as string) || payload.memberCode,
    athleteId: String(row.athlete_id || payload.athleteId || ""),
    athleteNameAr: String(row.athlete_name_ar || payload.athleteNameAr || ""),
    isMinor: Boolean(payload.isMinor),
    parentNameAr: payload.parentNameAr,
    coachId: String(row.coach_id || payload.coachId || ""),
    coachNameAr: payload.coachNameAr || "",
    facilityId: String(row.facility_id || payload.facilityId || ""),
    facilityNameAr: payload.facilityNameAr || "",
    linkedEntityId: payload.linkedEntityId,
    linkedEntityNameAr: payload.linkedEntityNameAr,
    agreementTypeAtEnroll: payload.agreementTypeAtEnroll,
    pricingSnapshot: payload.pricingSnapshot,
    sportSector: payload.sportSector === "fitness" ? "fitness" : "swimming",
    trackType: payload.trackType,
    trackLabelAr: payload.trackLabelAr,
    packageTitleAr: payload.packageTitleAr || "باقة سباحة",
    totalSessions,
    completedSessions,
    pinCode: revealPin ? String(row.pin_code || payload.pinCode || "0000") : "****",
    status,
    isCodeExpired: Boolean(payload.isCodeExpired || completedSessions >= totalSessions || status === "completed"),
    startedDateAr: payload.startedDateAr || "مفعل عبر كابتنلي",
    checkins: Array.isArray(payload.checkins) ? payload.checkins : [],
    receipts: Array.isArray(payload.receipts) ? payload.receipts : [],
  };
}

function timingSafePinMatch(storedPin: string, inputPin: string): boolean {
  const cleanStored = storedPin.trim();
  const cleanInput = inputPin.trim();
  if (!cleanStored || cleanStored === "****" || !cleanInput) return false;
  if (cleanStored.length !== cleanInput.length) return false;
  const bufA = Buffer.from(cleanStored.padEnd(16, "\0"), "utf8");
  const bufB = Buffer.from(cleanInput.padEnd(16, "\0"), "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
}

function extractStoredPinFromRow(row: Record<string, unknown>): string {
  const colPin = typeof row.pin_code === "string" ? row.pin_code.trim() : "";
  if (colPin && colPin !== "****") return colPin;
  const payload = (row.payload || {}) as Partial<SessionLedger>;
  const payloadPin = typeof payload.pinCode === "string" ? payload.pinCode.trim() : "";
  if (payloadPin && payloadPin !== "****") return payloadPin;
  return "";
}

function maskLedgerForCaller(
  ledger: SessionLedger,
  caller: ServerCallerContext
): SessionLedger {
  const isSwimmerOwner = Boolean(
    caller.memberCode &&
      ledger.memberCode &&
      caller.memberCode.trim().toUpperCase() === ledger.memberCode.trim().toUpperCase()
  );
  return caller.isAdmin || isSwimmerOwner ? ledger : { ...ledger, pinCode: "****" };
}

function extractPromoCodeFromEnrollment(
  ledger: SessionLedger,
  body: Record<string, unknown>
): string {
  const snap = ledger.pricingSnapshot as
    | (NonNullable<SessionLedger["pricingSnapshot"]> & { promoCodeUsed?: string })
    | undefined;
  const raw =
    snap?.promoCode ||
    snap?.promoCodeUsed ||
    (typeof body?.promoCodeUsed === "string" ? body.promoCodeUsed : "");
  return String(raw || "").trim().toUpperCase();
}

async function fetchFacilityPayloadForPromo(
  facilityId: string,
  admin: ReturnType<typeof getSupabaseAdminClient>
): Promise<{
  ok: boolean;
  found: boolean;
  via: "supabase" | "pg" | "none";
  payload?: Partial<Facility>;
}> {
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_facilities")
        .select("id, payload")
        .eq("id", facilityId)
        .maybeSingle();
      if (!error) {
        if (!data) return { ok: true, found: false, via: "supabase" };
        return {
          ok: true,
          found: true,
          via: "supabase",
          payload: ((data as { payload?: unknown }).payload || {}) as Partial<Facility>,
        };
      }
      if (error.code !== "42P01" && error.code !== "PGRST205") {
        return { ok: false, found: false, via: "none" };
      }
    } catch {
      // fall through to PG
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const { rows } = await client.query(
      `select id, payload from public.captenly_facilities where id = $1 limit 1`,
      [facilityId]
    );
    return rows[0] as { id?: string; payload?: Partial<Facility> } | undefined;
  });
  if (!pgRes.ok) return { ok: false, found: false, via: "none" };
  if (!pgRes.value) return { ok: true, found: false, via: "pg" };
  return {
    ok: true,
    found: true,
    via: "pg",
    payload: (pgRes.value.payload || {}) as Partial<Facility>,
  };
}

async function incrementFacilityPromoUsage(
  facilityId: string,
  promoCodeUpper: string,
  currentPayload: Partial<Facility>,
  admin: ReturnType<typeof getSupabaseAdminClient>
): Promise<void> {
  const existingCfg = currentPayload.poolDeskConfig;
  if (!existingCfg || !Array.isArray(existingCfg.promoCodes)) return;

  const updatedPromoCodes = existingCfg.promoCodes.map((p: FacilityPromoCode) =>
    p.code.trim().toUpperCase() === promoCodeUpper
      ? { ...p, usedCount: Math.max(0, Number(p.usedCount || 0)) + 1 }
      : p
  );
  const nextPayload: Partial<Facility> = {
    ...currentPayload,
    poolDeskConfig: {
      ...existingCfg,
      promoCodes: updatedPromoCodes,
      lastUpdatedIso: new Date().toISOString(),
    },
  };

  if (admin) {
    try {
      const { error } = await admin
        .from("captenly_facilities")
        .update({ payload: nextPayload, updated_at: new Date().toISOString() })
        .eq("id", facilityId);
      if (!error) return;
      if (error.code !== "42P01" && error.code !== "PGRST205") return;
    } catch {
      // fall through to PG
    }
  }

  await withPgClient(async (client) => {
    await client.query(
      `update public.captenly_facilities set payload = $2::jsonb, updated_at = now() where id = $1`,
      [facilityId, JSON.stringify(nextPayload)]
    );
    return true;
  });
}

async function queryLedgersWithPgFallback(
  filters: {
    memberCode?: string;
    athleteId?: string;
    coachId?: string;
    facilityId?: string;
    ledgerCode?: string;
    limit: number;
    offset: number;
  },
  caller: ServerCallerContext
): Promise<{ ok: boolean; ledgers: SessionLedger[]; hasMore: boolean; errorCode?: string }> {
  const res = await withPgClient(async (client) => {
    const conditions: string[] = [];
    const values: unknown[] = [];
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

    if (conditions.length === 0) return { ledgers: [] as SessionLedger[], hasMore: false };

    values.push(filters.limit + 1);
    const limitParam = values.length;
    values.push(filters.offset);
    const offsetParam = values.length;

    const sql = `SELECT * FROM public.captenly_session_ledgers WHERE ${conditions.join(" OR ")} ORDER BY updated_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`;
    const q = await client.query(sql, values);
    const rows = (q.rows || []) as Record<string, unknown>[];
    const hasMore = rows.length > filters.limit;
    const sliced = rows.slice(0, filters.limit);
    const ledgers = sliced
      .map((row) => rowToSessionLedger(row, canCallerSeePin(row, caller)))
      .filter((x): x is SessionLedger => Boolean(x));
    return { ledgers, hasMore };
  });
  return res.ok
    ? { ok: true, ledgers: res.value.ledgers, hasMore: res.value.hasMore }
    : { ok: false, ledgers: [], hasMore: false, errorCode: res.errorCode };
}

async function fetchLedgerRowById(
  ledgerId: string,
  admin: ReturnType<typeof getSupabaseAdminClient>
): Promise<{
  ok: boolean;
  row: Record<string, unknown> | null;
  errorCode?: string;
}> {
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_session_ledgers")
        .select("*")
        .eq("id", ledgerId)
        .maybeSingle();
      if (!error) {
        return { ok: true, row: (data as Record<string, unknown> | null) || null };
      }
      if (error.code !== "42P01" && error.code !== "PGRST205") {
        return { ok: false, row: null, errorCode: error.code };
      }
    } catch {
      // fall through to PG
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const res = await client.query(
      `select * from public.captenly_session_ledgers where id = $1 limit 1`,
      [ledgerId]
    );
    return (res.rows?.[0] || null) as Record<string, unknown> | null;
  });
  return pgRes.ok
    ? { ok: true, row: pgRes.value }
    : { ok: false, row: null, errorCode: pgRes.errorCode };
}

async function fetchScopedLedgerRowsForPin(
  params: {
    facilityId?: string;
    coachId?: string;
    authorizedFacilityIds: Set<string>;
  },
  admin: ReturnType<typeof getSupabaseAdminClient>
): Promise<{ ok: boolean; rows: Record<string, unknown>[]; errorCode?: string }> {
  const { facilityId, coachId, authorizedFacilityIds } = params;

  if (admin) {
    try {
      let query = admin
        .from("captenly_session_ledgers")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (facilityId) {
        query = query.eq("facility_id", facilityId);
      } else if (coachId && authorizedFacilityIds.size > 0) {
        const facList = Array.from(authorizedFacilityIds).map((id) => `facility_id.eq.${id}`);
        query = query.or([`coach_id.eq.${coachId}`, ...facList].join(","));
      } else if (coachId) {
        query = query.eq("coach_id", coachId);
      } else if (authorizedFacilityIds.size > 0) {
        query = query.in("facility_id", Array.from(authorizedFacilityIds));
      }
      const { data, error } = await query;
      if (!error) {
        return { ok: true, rows: (data || []) as Record<string, unknown>[] };
      }
      if (error.code !== "42P01" && error.code !== "PGRST205") {
        return { ok: false, rows: [], errorCode: error.code };
      }
    } catch {
      // fall through to PG
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (facilityId) {
      values.push(facilityId);
      conditions.push(`facility_id = $${values.length}`);
    } else {
      if (coachId) {
        values.push(coachId);
        conditions.push(`coach_id = $${values.length}`);
      }
      if (authorizedFacilityIds.size > 0) {
        values.push(Array.from(authorizedFacilityIds));
        conditions.push(`facility_id = any($${values.length}::text[])`);
      }
    }
    const whereClause = conditions.length > 0 ? `where ${conditions.join(" or ")}` : "";
    const { rows } = await client.query(
      `select * from public.captenly_session_ledgers ${whereClause} order by updated_at desc limit 200`,
      values
    );
    return (rows || []) as Record<string, unknown>[];
  });
  return pgRes.ok
    ? { ok: true, rows: pgRes.value }
    : { ok: false, rows: [], errorCode: pgRes.errorCode };
}

async function persistLedgerCasUpdate(
  record: {
    id: string;
    ledger_code: string;
    member_code: string | null;
    athlete_id: string;
    athlete_name_ar: string;
    coach_id: string;
    facility_id: string;
    pin_code: string;
    total_sessions: number;
    completed_sessions: number;
    status: string;
    payload: SessionLedger;
    updated_at: string;
  },
  expectedCompletedSessions: number,
  admin: ReturnType<typeof getSupabaseAdminClient>
): Promise<
  | { ok: true; via: "supabase" | "pg" }
  | { ok: false; conflict: boolean; reason?: string }
> {
  if (admin) {
    try {
      const { data, error } = await admin
        .from("captenly_session_ledgers")
        .update({
          member_code: record.member_code,
          athlete_name_ar: record.athlete_name_ar,
          total_sessions: record.total_sessions,
          completed_sessions: record.completed_sessions,
          status: record.status,
          payload: record.payload,
          updated_at: record.updated_at,
        })
        .eq("id", record.id)
        .eq("completed_sessions", expectedCompletedSessions)
        .select("id");

      if (!error) {
        if (!Array.isArray(data) || data.length === 0) {
          return { ok: false, conflict: true, reason: "concurrent_update_conflict" };
        }
        return { ok: true, via: "supabase" };
      }
      if (error.code !== "42P01" && error.code !== "PGRST205") {
        return { ok: false, conflict: false, reason: error.code || "db_error" };
      }
    } catch {
      // fall through to PG
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const res = await client.query(
      `update public.captenly_session_ledgers
       set member_code = $2,
           athlete_name_ar = $3,
           total_sessions = $4,
           completed_sessions = $5,
           status = $6,
           payload = $7::jsonb,
           updated_at = now()
       where id = $1 and completed_sessions = $8
       returning id`,
      [
        record.id,
        record.member_code,
        record.athlete_name_ar,
        record.total_sessions,
        record.completed_sessions,
        record.status,
        JSON.stringify(record.payload),
        expectedCompletedSessions,
      ]
    );
    return (res.rows || []).length;
  });

  if (!pgRes.ok) {
    return { ok: false, conflict: false, reason: pgRes.errorCode };
  }
  if (pgRes.value === 0) {
    return { ok: false, conflict: true, reason: "concurrent_update_conflict" };
  }
  return { ok: true, via: "pg" };
}

async function persistLedgerUpsert(
  record: {
    id: string;
    ledger_code: string;
    member_code: string | null;
    athlete_id: string;
    athlete_name_ar: string;
    coach_id: string;
    facility_id: string;
    pin_code: string;
    total_sessions: number;
    completed_sessions: number;
    status: string;
    payload: SessionLedger;
    updated_at: string;
  },
  admin: ReturnType<typeof getSupabaseAdminClient>
): Promise<{ ok: true } | { ok: false; reason?: string }> {
  if (admin) {
    try {
      const { error } = await admin
        .from("captenly_session_ledgers")
        .upsert(record, { onConflict: "id" });
      if (!error) return { ok: true };
      if (error.code !== "42P01" && error.code !== "PGRST205") {
        return { ok: false, reason: error.code || "db_error" };
      }
    } catch {
      // fall through to PG
    }
  }

  const pgRes = await withPgClient(async (client) => {
    await client.query(
      `insert into public.captenly_session_ledgers
        (id, ledger_code, member_code, athlete_id, athlete_name_ar, coach_id, facility_id, pin_code, total_sessions, completed_sessions, status, payload, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,now())
       on conflict (id) do update set
         member_code = excluded.member_code,
         athlete_name_ar = excluded.athlete_name_ar,
         total_sessions = excluded.total_sessions,
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
    return true;
  });
  return pgRes.ok ? { ok: true } : { ok: false, reason: pgRes.errorCode };
}

async function handlePinCheckinPost(
  body: Record<string, unknown>,
  caller: ServerCallerContext,
  admin: ReturnType<typeof getSupabaseAdminClient>
) {
  const rawPin = typeof body?.pinCode === "string" ? body.pinCode.trim() : "";
  if (!/^\d{4}$/.test(rawPin)) {
    return NextResponse.json(
      {
        ok: false,
        persisted: false,
        error: "invalid_pin_format",
        messageAr: "يرجى إدخال رمز PIN صحيح مكوّن من 4 أرقام.",
      },
      { status: 400 }
    );
  }

  const reqLedgerId =
    typeof body?.ledgerId === "string" ? sanitizeFilterToken(body.ledgerId) : "";
  const reqFacilityId =
    typeof body?.facilityId === "string" ? sanitizeFilterToken(body.facilityId) : "";
  const reqCoachId =
    typeof body?.coachId === "string" ? sanitizeFilterToken(body.coachId) : "";
  const clientEventId =
    typeof body?.clientEventId === "string" && body.clientEventId.trim()
      ? body.clientEventId.trim()
      : undefined;

  const callerCoachId =
    caller.linkedCoachId ||
    (caller.role === "coach" && caller.memberCode
      ? getDeterministicCoachId(caller.memberCode)
      : undefined);
  const authorizedFacilityIds = caller.isAdmin
    ? new Set<string>()
    : await getCallerAuthorizedFacilityIds(caller);

  if (reqFacilityId) {
    const reqFacRole = await getCallerFacilityAccessRole(reqFacilityId, caller);
    if (reqFacRole === "accounts_manager") {
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          error: "forbidden_accounts_manager",
          messageAr: "صلاحية مسؤول الحسابات لا تسمح بخصم حصص السباحين.",
        },
        { status: 403 }
      );
    }
    const isFacWriter =
      caller.isAdmin ||
      reqFacRole === "admin" ||
      reqFacRole === "owner" ||
      reqFacRole === "general_staff" ||
      reqFacRole === "subscriptions_manager";
    if (!isFacWriter && !callerCoachId) {
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          error: "forbidden",
          messageAr: "خصم الحصص برمز الـ PIN متاح للكابتن أو مسؤول البوابة/الاشتراكات فقط.",
        },
        { status: 403 }
      );
    }
  } else if (!caller.isAdmin && authorizedFacilityIds.size === 0 && !callerCoachId) {
    return NextResponse.json(
      {
        ok: false,
        persisted: false,
        error: "forbidden",
        messageAr: "خصم الحصص برمز الـ PIN متاح للكابتن أو مسؤول البوابة/الاشتراكات فقط.",
      },
      { status: 403 }
    );
  }

  // Rate-limit PIN brute-force attempts per caller + facility (10 attempts / 300_000ms)
  const rlIdentifier = `${caller.memberCode || caller.email || "caller"}:${reqFacilityId || callerCoachId || "global"}`;
  const rateCheck = await enforceRateLimit({
    bucket: "pin_checkin",
    identifier: rlIdentifier,
    limit: 10,
    windowSec: 300,
  });
  if (!rateCheck.allowed) {
    return rateLimitExceededResponse(
      rateCheck.retryAfterSec,
      "تم تجاوز الحد المسموح لمحاولات إدخال الـ PIN (10 محاولات خلال 5 دقائق). يرجى الانتظار أو استخدام كود الاشتراك / QR."
    );
  }

  let candidateRows: Record<string, unknown>[] = [];
  if (reqLedgerId) {
    const single = await fetchLedgerRowById(reqLedgerId, admin);
    if (!single.ok) {
      return NextResponse.json(
        { ok: false, persisted: false, error: "ledger_lookup_unavailable" },
        { status: 503 }
      );
    }
    if (!single.row) {
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          error: "ledger_not_found",
          messageAr: "دفتر الحصص غير موجود.",
        },
        { status: 404 }
      );
    }
    candidateRows = [single.row];
  } else {
    const scoped = await fetchScopedLedgerRowsForPin(
      {
        facilityId: reqFacilityId || undefined,
        coachId: reqCoachId || callerCoachId,
        authorizedFacilityIds,
      },
      admin
    );
    if (!scoped.ok) {
      return NextResponse.json(
        { ok: false, persisted: false, error: "ledger_lookup_unavailable" },
        { status: 503 }
      );
    }
    candidateRows = scoped.rows;
  }

  // Filter strictly to rows the caller is authorized to deduct (explicitly rejecting accounts_manager & swimmers)
  const authorizedCandidates: Array<{
    row: Record<string, unknown>;
    ledger: SessionLedger;
    storedPin: string;
    accessRole: string | null;
    isProviderWriter: boolean;
    canOverrideDuplicate3h: boolean;
  }> = [];

  let sawAccountsManagerBlock = false;
  let sawNonDelegatedCoachBlock = false;

  for (const row of candidateRows) {
    const ledger = rowToSessionLedger(row, true);
    if (!ledger) continue;
    const storedPin = extractStoredPinFromRow(row);
    const accessRole = await getCallerFacilityAccessRole(ledger.facilityId, caller);

    if (accessRole === "accounts_manager") {
      sawAccountsManagerBlock = true;
      continue;
    }

    const isProviderWriter =
      caller.isAdmin ||
      accessRole === "admin" ||
      accessRole === "owner" ||
      accessRole === "general_staff" ||
      accessRole === "subscriptions_manager";
    const isCoachOwner = Boolean(callerCoachId && callerCoachId === ledger.coachId);

    const delegatedAccess =
      !caller.isAdmin && !isProviderWriter && ledger.facilityId
        ? await checkCoachDelegatedQrAccess({
            facilityId: ledger.facilityId,
            coachId: callerCoachId,
            memberCode: caller.memberCode,
            ledgerLinkedEntityId: ledger.linkedEntityId,
          })
        : { governed: false, canScan: true };

    const isDelegatedGroupScanner = Boolean(
      delegatedAccess.governed &&
        delegatedAccess.canScan &&
        ledger.linkedEntityId &&
        delegatedAccess.matchedLink?.id === ledger.linkedEntityId
    );

    if (!caller.isAdmin && !isProviderWriter && delegatedAccess.governed && !delegatedAccess.canScan) {
      sawNonDelegatedCoachBlock = true;
      continue;
    }

    if (!caller.isAdmin && !isProviderWriter && !isCoachOwner && !isDelegatedGroupScanner) {
      continue;
    }

    const canOverrideDuplicate3h =
      caller.isAdmin ||
      accessRole === "admin" ||
      accessRole === "owner" ||
      accessRole === "subscriptions_manager";

    authorizedCandidates.push({
      row,
      ledger,
      storedPin,
      accessRole,
      isProviderWriter,
      canOverrideDuplicate3h,
    });
  }

  if (reqLedgerId && authorizedCandidates.length === 0) {
    if (sawAccountsManagerBlock) {
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          error: "forbidden_accounts_manager",
          messageAr: "صلاحية مسؤول الحسابات لا تسمح بخصم حصص السباحين.",
        },
        { status: 403 }
      );
    }
    if (sawNonDelegatedCoachBlock) {
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          error: "coach_qr_scan_not_delegated",
          messageAr: "صلاحية مسح الحضور لهذه المجموعة مقصورة حالياً على بوابة المنشأة.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        persisted: false,
        error: "forbidden",
        messageAr: "غير مصرح لك بخصم حصة لهذا الدفتر (يمنع الخصم الذاتي للسبّاح).",
      },
      { status: 403 }
    );
  }

  const pinMatches = authorizedCandidates.filter((c) => timingSafePinMatch(c.storedPin, rawPin));
  if (pinMatches.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        persisted: false,
        error: "invalid_pin",
        messageAr: "رمز الـ PIN غير صحيح أو لا يطابق أي اشتراك في نطاقك.",
      },
      { status: 403 }
    );
  }

  let chosen = pinMatches[0];
  if (!reqLedgerId && pinMatches.length > 1) {
    const activeMatches = pinMatches.filter(
      (c) =>
        c.ledger.completedSessions < c.ledger.totalSessions &&
        c.ledger.status !== "completed" &&
        !c.ledger.isCodeExpired
    );
    if (activeMatches.length === 1) {
      chosen = activeMatches[0];
    } else {
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          error: "ambiguous_pin",
          messageAr:
            "يوجد أكثر من مشترك نشط بنفس رمز الـ PIN (4 أرقام) — يرجى تحديد السباح أو إدخال كود الاشتراك (CAP-SUB-*) مباشرة.",
        },
        { status: 409 }
      );
    }
  }

  const targetLedger = chosen.ledger;
  const maskedExisting = maskLedgerForCaller(targetLedger, caller);

  // Idempotency replay check
  if (
    clientEventId &&
    targetLedger.checkins.some((c) => c.clientEventId && c.clientEventId === clientEventId)
  ) {
    return NextResponse.json({
      ok: true,
      persisted: true,
      idempotentReplay: true,
      ledger: maskedExisting,
    });
  }

  // Exhaustion check
  if (
    targetLedger.completedSessions >= targetLedger.totalSessions ||
    targetLedger.status === "completed" ||
    targetLedger.isCodeExpired
  ) {
    return NextResponse.json(
      {
        ok: false,
        persisted: false,
        expired: true,
        error: "ledger_exhausted",
        ledger: maskedExisting,
        messageAr: `انتهت صلاحية كود الاشتراك (${targetLedger.subscriptionCode || targetLedger.ledgerCode}) لاستنفاد جميع الحصص (${targetLedger.totalSessions}/${targetLedger.totalSessions}).`,
      },
      { status: 400 }
    );
  }

  // 3h duplicate guard
  const recentAgeMs = findRecentCheckinAgeMs(targetLedger.checkins);
  if (recentAgeMs !== null && recentAgeMs < DUPLICATE_SCAN_WINDOW_MS) {
    const allowOverride = Boolean(body?.overrideDuplicate3h) && chosen.canOverrideDuplicate3h;
    if (!allowOverride) {
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          duplicateBlocked: true,
          error: "duplicate_checkin_3h",
          ledger: maskedExisting,
          messageAr:
            "تنبيه تكرار المسح: تم تسجيل حضور لهذه الباقة خلال آخر 3 ساعات بالفعل.",
        },
        { status: 409 }
      );
    }
  }

  const prevCompleted = targetLedger.completedSessions;
  const nextNum = prevCompleted + 1;
  const remaining = Math.max(0, targetLedger.totalSessions - nextNum);
  const isNowExpired = nextNum >= targetLedger.totalSessions;
  const now = new Date();
  const nowTimeAr = now.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });
  const scannedByRole: SessionCheckin["scannedByRole"] = caller.isAdmin
    ? "admin"
    : chosen.isProviderWriter
      ? "facility_gate"
      : targetLedger.linkedEntityId
        ? "delegated_coach"
        : "coach_private";
  const operatorLabel =
    typeof body?.operatorNameAr === "string" && body.operatorNameAr.trim()
      ? body.operatorNameAr.trim()
      : caller.memberCode || "مسؤول البوابة";

  const newCheckin: SessionCheckin = {
    sessionNumber: nextNum,
    dateAr: `اليوم ${nowTimeAr} — ختم موثق بالـ PIN`,
    method: "pin_4digit",
    verifiedByAr: operatorLabel,
    coachNoteAr:
      (typeof body?.coachNoteAr === "string" && body.coachNoteAr.trim()) ||
      "حضور مؤكد بالـ PIN (4 أرقام)",
    wasOffline: false,
    ...(clientEventId ? { clientEventId } : {}),
    scannedAtIso: now.toISOString(),
    scannedByNameAr: operatorLabel,
    scannedByMemberCode: caller.memberCode,
    scannedByRole,
    scanSource:
      body?.scanSource === "gate_kiosk" ||
      body?.scanSource === "dashboard_manual" ||
      body?.scanSource === "coach_poolside" ||
      body?.scanSource === "system_url_qr"
        ? body.scanSource
        : "gate_kiosk",
  };

  const storedLedger: SessionLedger = {
    ...targetLedger,
    pinCode: chosen.storedPin,
    completedSessions: nextNum,
    status: isNowExpired ? "completed" : remaining <= 2 ? "renewal_due" : "active",
    isCodeExpired: isNowExpired,
    checkins: [...targetLedger.checkins, newCheckin],
  };

  const record = {
    id: storedLedger.id,
    ledger_code: storedLedger.ledgerCode.toUpperCase(),
    member_code: storedLedger.memberCode ? storedLedger.memberCode.trim().toUpperCase() : null,
    athlete_id: storedLedger.athleteId,
    athlete_name_ar: storedLedger.athleteNameAr,
    coach_id: storedLedger.coachId,
    facility_id: storedLedger.facilityId,
    pin_code: chosen.storedPin,
    total_sessions: storedLedger.totalSessions,
    completed_sessions: storedLedger.completedSessions,
    status: storedLedger.status,
    payload: storedLedger,
    updated_at: now.toISOString(),
  };

  const casResult = await persistLedgerCasUpdate(record, prevCompleted, admin);
  if (!casResult.ok) {
    if (casResult.conflict) {
      const latest = await fetchLedgerRowById(storedLedger.id, admin);
      const serverLedger = latest.row
        ? rowToSessionLedger(latest.row, canCallerSeePin(latest.row, caller))
        : undefined;
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          error: "concurrent_update_conflict",
          messageAr:
            "تم تحديث هذا الدفتر من جهاز آخر في نفس اللحظة — يرجى مراجعة الرصيد المحدّث.",
          serverLedger,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, persisted: false, reason: casResult.reason || "db_error" },
      { status: 500 }
    );
  }

  const maskedResponseLedger = maskLedgerForCaller(storedLedger, caller);
  const subCode = storedLedger.subscriptionCode || storedLedger.ledgerCode;
  const expiryOrRenewalMsg = isNowExpired
    ? ` — اكتملت الـ ${storedLedger.totalSessions} حصص وانتهت صلاحية كود الاشتراك (${subCode}) تلقائياً!`
    : remaining <= 2
      ? ` — تنبيه: متبقي ${remaining} حصة فقط في هذا الكود.`
      : "";

  if (storedLedger.memberCode) {
    try {
      await dispatchWhatsAppNotification({
        eventType: "attendance_checkin",
        recipientMemberCode: storedLedger.memberCode,
        facilityId: storedLedger.facilityId || null,
        ledgerId: storedLedger.id,
        athleteNameAr: storedLedger.athleteNameAr,
        facilityNameAr: storedLedger.facilityNameAr,
        completedSessions: storedLedger.completedSessions,
        totalSessions: storedLedger.totalSessions,
        remainingSessions: remaining,
        dedupeScope: `${storedLedger.id}-s${nextNum}`,
        actionHref: `/dashboard/ledger?id=${encodeURIComponent(storedLedger.id)}`,
      });
      if (remaining > 0 && remaining <= 2) {
        await dispatchWhatsAppNotification({
          eventType: "subscription_expiring",
          recipientMemberCode: storedLedger.memberCode,
          facilityId: storedLedger.facilityId || null,
          ledgerId: storedLedger.id,
          athleteNameAr: storedLedger.athleteNameAr,
          facilityNameAr: storedLedger.facilityNameAr,
          completedSessions: storedLedger.completedSessions,
          totalSessions: storedLedger.totalSessions,
          remainingSessions: remaining,
          dedupeScope: `${storedLedger.id}-rem-${remaining}`,
          actionHref: `/dashboard/ledger?id=${encodeURIComponent(storedLedger.id)}`,
        });
      }
    } catch {
      // Never block check-in response on notification dispatch
    }
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    ledger: maskedResponseLedger,
    messageAr: `تم خصم الحصة رقم (${nextNum} من ${storedLedger.totalSessions}) للمشترك ${storedLedger.athleteNameAr} عبر الـ PIN بنجاح${expiryOrRenewalMsg}`,
  });
}

export async function GET(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json(
      { persisted: false, ledgers: [], profile: null, reason: "unauthorized" },
      { status: 401 }
    );
  }

  const admin = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);
  const memberCode = sanitizeFilterToken(searchParams.get("memberCode") || "").toUpperCase();
  const athleteId = sanitizeFilterToken(searchParams.get("athleteId") || "");
  const coachId = sanitizeFilterToken(searchParams.get("coachId") || "");
  const facilityId = sanitizeFilterToken(searchParams.get("facilityId") || "");
  const ledgerCode = sanitizeFilterToken(searchParams.get("ledgerCode") || "").toUpperCase();

  const rawLimit = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(MAX_PAGE_LIMIT, Math.floor(rawLimit))
      : DEFAULT_PAGE_LIMIT;
  const rawOffset = Number(searchParams.get("offset"));
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;

  if (!memberCode && !athleteId && !coachId && !facilityId && !ledgerCode) {
    return NextResponse.json({
      persisted: false,
      ledgers: [],
      profile: null,
      hasMore: false,
      nextOffset: null,
    });
  }

  const authorizedFacilityIds = caller.isAdmin
    ? new Set<string>()
    : await getCallerAuthorizedFacilityIds(caller);
  const callerCoachId =
    caller.linkedCoachId ||
    (caller.role === "coach" && caller.memberCode
      ? getDeterministicCoachId(caller.memberCode)
      : undefined);

  if (!caller.isAdmin) {
    if (facilityId && !authorizedFacilityIds.has(facilityId)) {
      return NextResponse.json(
        { persisted: false, ledgers: [], profile: null, reason: "forbidden" },
        { status: 403 }
      );
    }
    if (coachId && (!callerCoachId || callerCoachId !== coachId)) {
      return NextResponse.json(
        { persisted: false, ledgers: [], profile: null, reason: "forbidden" },
        { status: 403 }
      );
    }
    const hasStaffScope = authorizedFacilityIds.size > 0 || Boolean(callerCoachId);
    if ((memberCode || ledgerCode || athleteId) && !hasStaffScope) {
      const selfMatches = Boolean(
        memberCode && caller.memberCode && caller.memberCode.toUpperCase() === memberCode
      );
      if (!selfMatches || ledgerCode || athleteId) {
        return NextResponse.json(
          { persisted: false, ledgers: [], profile: null, reason: "forbidden" },
          { status: 403 }
        );
      }
    }
  }

  let matchedProfile: {
    memberCode: string;
    fullNameAr: string;
    phone: string;
    city: string;
    role: string;
    avatarUrl?: string;
  } | null = null;

  if (memberCode) {
    if (admin) {
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
    } else {
      const pgProfile = await withPgClient(async (client) => {
        const { rows } = await client.query(
          `select member_code, full_name_ar, phone, city, role, avatar_url from public.captenly_profiles where upper(member_code) = upper($1) limit 1`,
          [memberCode]
        );
        return rows[0] as Record<string, unknown> | undefined;
      });
      if (pgProfile.ok && pgProfile.value) {
        const pRow = pgProfile.value;
        matchedProfile = {
          memberCode: String(pRow.member_code),
          fullNameAr: String(pRow.full_name_ar),
          phone: pRow.phone ? String(pRow.phone) : "",
          city: pRow.city ? String(pRow.city) : "مصر",
          role: String(pRow.role || "adult_athlete"),
          avatarUrl: pRow.avatar_url ? String(pRow.avatar_url) : undefined,
        };
      }
    }
  }

  const pgFallbackResponse = async (fallbackReason?: string) => {
    const pgFallback = await queryLedgersWithPgFallback(
      {
        memberCode,
        athleteId,
        coachId,
        facilityId,
        ledgerCode,
        limit,
        offset,
      },
      caller
    );
    const visiblePgLedgers = pgFallback.ledgers.filter((l) =>
      canCallerReadLedger(l, caller, authorizedFacilityIds, callerCoachId)
    );
    const allowMatchedProfile = Boolean(
      caller.isAdmin ||
        (memberCode && caller.memberCode && caller.memberCode.toUpperCase() === memberCode) ||
        visiblePgLedgers.length > 0
    );
    return NextResponse.json({
      persisted: pgFallback.ok,
      ledgers: visiblePgLedgers,
      hasMore: pgFallback.hasMore,
      nextOffset: pgFallback.hasMore ? offset + limit : null,
      limit,
      offset,
      profile: allowMatchedProfile ? matchedProfile : null,
      ...(pgFallback.ok ? {} : { reason: pgFallback.errorCode || fallbackReason || "pg_error" }),
    });
  };

  if (!admin) {
    return pgFallbackResponse("supabase_not_configured");
  }

  try {
    const orClauses: string[] = [];
    if (ledgerCode) orClauses.push(`ledger_code.ilike.${ledgerCode}`);
    if (memberCode) orClauses.push(`member_code.ilike.${memberCode}`);
    if (athleteId) orClauses.push(`athlete_id.eq.${athleteId}`);
    if (coachId) orClauses.push(`coach_id.eq.${coachId}`);
    if (facilityId) orClauses.push(`facility_id.eq.${facilityId}`);

    const { data, error } = await admin
      .from("captenly_session_ledgers")
      .select("*")
      .or(orClauses.join(","))
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit);

    if (error && (error.code === "42P01" || error.code === "PGRST205")) {
      return pgFallbackResponse(error.code);
    }

    if (error) {
      return NextResponse.json({
        persisted: false,
        ledgers: [],
        hasMore: false,
        nextOffset: null,
        profile: matchedProfile,
        reason: error.code || "db_error",
      });
    }

    const rows = (data || []) as Record<string, unknown>[];
    const hasMore = rows.length > limit;
    const rawLedgers = rows
      .slice(0, limit)
      .map((row) => rowToSessionLedger(row, canCallerSeePin(row, caller)))
      .filter((x): x is SessionLedger => Boolean(x));

    const ledgers = rawLedgers.filter((l) =>
      canCallerReadLedger(l, caller, authorizedFacilityIds, callerCoachId)
    );
    const allowMatchedProfile = Boolean(
      caller.isAdmin ||
        (memberCode && caller.memberCode && caller.memberCode.toUpperCase() === memberCode) ||
        ledgers.length > 0
    );

    return NextResponse.json({
      persisted: true,
      ledgers,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
      limit,
      offset,
      profile: allowMatchedProfile ? matchedProfile : null,
    });
  } catch {
    return pgFallbackResponse("query_error");
  }
}

export async function POST(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ ok: false, persisted: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  try {
    const body = (await request.json()) as Record<string, unknown>;

    // GAP-002: Dedicated server-side 4-digit PIN verification & atomic deduction path
    if (body?.action === "pin_checkin") {
      return handlePinCheckinPost(body, caller, admin);
    }

    const ledger = body?.ledger as SessionLedger | undefined;
    if (!ledger || !ledger.id || !ledger.ledgerCode || !ledger.athleteId) {
      return NextResponse.json(
        { ok: false, persisted: false, error: "invalid_ledger" },
        { status: 400 }
      );
    }

    const accessRole = await getCallerFacilityAccessRole(ledger.facilityId, caller);
    const isProviderFacilityWriter =
      accessRole === "admin" ||
      accessRole === "owner" ||
      accessRole === "general_staff" ||
      accessRole === "subscriptions_manager";
    // Security remediation (F-007): 3-hour duplicate override is restricted exclusively
    // to platform admins, facility owners/managers, and subscription administrators.
    const canOverrideDuplicate3h =
      caller.isAdmin ||
      accessRole === "admin" ||
      accessRole === "owner" ||
      accessRole === "subscriptions_manager";
    const isAccountsOnly = accessRole === "accounts_manager";
    const callerCoachId =
      caller.linkedCoachId ||
      (caller.role === "coach" && caller.memberCode ? getDeterministicCoachId(caller.memberCode) : undefined);
    const isCoachOwner = Boolean(callerCoachId && callerCoachId === ledger.coachId);
    const delegatedAccess =
      !caller.isAdmin && !isProviderFacilityWriter && ledger.facilityId
        ? await checkCoachDelegatedQrAccess({
            facilityId: ledger.facilityId,
            coachId: callerCoachId,
            memberCode: caller.memberCode,
            ledgerLinkedEntityId: ledger.linkedEntityId,
          })
        : { governed: false, canScan: true };
    const isDelegatedGroupScanner = Boolean(
      delegatedAccess.governed &&
        delegatedAccess.canScan &&
        ledger.linkedEntityId &&
        delegatedAccess.matchedLink?.id === ledger.linkedEntityId
    );
    const isSwimmerOwner = Boolean(
      caller.memberCode &&
        ledger.memberCode &&
        caller.memberCode.trim().toUpperCase() === ledger.memberCode.trim().toUpperCase()
    );

    if (
      !caller.isAdmin &&
      !isProviderFacilityWriter &&
      !isAccountsOnly &&
      !isCoachOwner &&
      !isDelegatedGroupScanner &&
      !isSwimmerOwner
    ) {
      return NextResponse.json({ ok: false, persisted: false, error: "forbidden" }, { status: 403 });
    }

    let existingPin: string | undefined;
    let existingFacilityId: string | undefined;
    let existingCompletedSessions = 0;
    let existingPayload: Partial<SessionLedger> | undefined;

    const existingLookup = await fetchLedgerRowById(ledger.id, admin);
    if (!existingLookup.ok) {
      return NextResponse.json(
        { ok: false, persisted: false, error: "ledger_lookup_unavailable" },
        { status: 503 }
      );
    }

    if (existingLookup.row) {
      const existingRow = existingLookup.row;
      if (typeof existingRow.pin_code === "string" && existingRow.pin_code !== "****") {
        existingPin = existingRow.pin_code;
      }
      if (typeof existingRow.facility_id === "string") {
        existingFacilityId = existingRow.facility_id;
      }
      if (existingRow.payload && typeof existingRow.payload === "object") {
        existingPayload = existingRow.payload as Partial<SessionLedger>;
      }
      existingCompletedSessions = Number(
        existingRow.completed_sessions ?? existingPayload?.completedSessions ?? 0
      );
    }

    // Security remediation (F-007): prevent swapping facilityId on an existing ledger to bypass ACLs.
    const storedFacilityId = existingFacilityId || existingPayload?.facilityId;
    if (!caller.isAdmin && storedFacilityId && storedFacilityId !== ledger.facilityId) {
      return NextResponse.json(
        { ok: false, persisted: false, error: "forbidden_facility_change" },
        { status: 403 }
      );
    }

    // GAP-021 Idempotency check before duplicate/CAS guards
    if (existingPayload) {
      const existingCheckins = Array.isArray(existingPayload.checkins)
        ? existingPayload.checkins
        : [];
      const existingEventIds = new Set(
        existingCheckins
          .map((c) => c?.clientEventId)
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      );
      const bodyEventId =
        typeof body?.clientEventId === "string" ? body.clientEventId.trim() : "";
      const incomingCheckins = Array.isArray(ledger.checkins) ? ledger.checkins : [];
      const newIncomingCheckins = incomingCheckins.slice(existingCheckins.length);
      const allNewHaveMatchingEventId =
        newIncomingCheckins.length > 0 &&
        newIncomingCheckins.every(
          (c) => Boolean(c?.clientEventId && existingEventIds.has(c.clientEventId))
        );

      if ((bodyEventId && existingEventIds.has(bodyEventId)) || allNewHaveMatchingEventId) {
        const canonicalExisting =
          rowToSessionLedger(
            existingLookup.row!,
            caller.isAdmin || isSwimmerOwner
          ) || maskLedgerForCaller(existingPayload as SessionLedger, caller);
        return NextResponse.json({
          ok: true,
          persisted: true,
          idempotentReplay: true,
          ledger: canonicalExisting,
        });
      }
    }

    // Governance enforcement: If a host facility governs this coach/academy link and has NOT enabled QR scan delegation,
    // prevent direct check-in increments from coach clients.
    const isCheckinIncrement =
      ledger.completedSessions > existingCompletedSessions ||
      (Array.isArray(ledger.checkins) &&
        ledger.checkins.length > (existingPayload?.checkins?.length || 0));

    if (
      !caller.isAdmin &&
      !isProviderFacilityWriter &&
      isCheckinIncrement &&
      delegatedAccess.governed &&
      !delegatedAccess.canScan
    ) {
      return NextResponse.json(
        {
          ok: false,
          persisted: false,
          error: "coach_qr_scan_not_delegated",
          messageAr: `صلاحية مسح الـ QR لهذه المجموعة مقصورة حالياً على بوابة ${ledger.facilityNameAr}.`,
        },
        { status: 403 }
      );
    }

    // GAP-021 Optimistic concurrency check on existing ledger increments
    if (existingPayload && isCheckinIncrement) {
      if (
        typeof body?.expectedCompletedSessions === "number" &&
        body.expectedCompletedSessions !== existingCompletedSessions
      ) {
        const canonicalExisting =
          rowToSessionLedger(
            existingLookup.row!,
            caller.isAdmin || isSwimmerOwner
          ) || maskLedgerForCaller(existingPayload as SessionLedger, caller);
        return NextResponse.json(
          {
            ok: false,
            persisted: false,
            error: "concurrent_update_conflict",
            messageAr:
              "تم تحديث رصيد حصص هذا الدفتر من جهاز آخر للتو — تم تحديث البيانات بأحدث رصيد على السيرفر.",
            serverLedger: canonicalExisting,
          },
          { status: 409 }
        );
      }
    }

    // Security remediation (F-007): server-side atomic 3-hour duplicate check-in guard
    if (existingPayload && isCheckinIncrement) {
      const recentAgeMs = findRecentCheckinAgeMs(existingPayload.checkins);
      if (recentAgeMs !== null && recentAgeMs < DUPLICATE_SCAN_WINDOW_MS) {
        const allowFacilityOverride =
          Boolean(body?.overrideDuplicate3h) && canOverrideDuplicate3h;
        if (!allowFacilityOverride) {
          return NextResponse.json(
            {
              ok: false,
              persisted: false,
              duplicateBlocked: true,
              error: "duplicate_checkin_3h",
              messageAr:
                "تنبيه تكرار المسح: تم تسجيل حضور لهذه الباقة خلال آخر 3 ساعات بالفعل.",
            },
            { status: 409 }
          );
        }
      }
    }

    // GAP-010: Server-side promo code validation on new facility ledger enrollment
    let promoIncrementTarget: {
      facilityId: string;
      promoCodeUpper: string;
      facilityPayload: Partial<Facility>;
    } | null = null;
    if (!existingPayload && ledger.facilityId) {
      const promoCodeUpper = extractPromoCodeFromEnrollment(ledger, body);
      if (promoCodeUpper) {
        const facLookup = await fetchFacilityPayloadForPromo(ledger.facilityId, admin);
        if (!facLookup.ok) {
          return NextResponse.json(
            { ok: false, persisted: false, error: "promo_validation_unavailable" },
            { status: 503 }
          );
        }
        const promos = facLookup.found
          ? facLookup.payload?.poolDeskConfig?.promoCodes || []
          : [];
        const matchedPromo = promos.find(
          (p) => p.code.trim().toUpperCase() === promoCodeUpper
        );
        if (!facLookup.found || !matchedPromo) {
          return NextResponse.json(
            {
              ok: false,
              persisted: false,
              error: "invalid_promo_code",
              messageAr: `كود الخصم (${promoCodeUpper}) غير موجود في إعدادات هذه المنشأة.`,
            },
            { status: 400 }
          );
        }
        if (!matchedPromo.isActive) {
          return NextResponse.json(
            {
              ok: false,
              persisted: false,
              error: "inactive_promo_code",
              messageAr: `كود الخصم (${matchedPromo.code}) متوقف حالياً.`,
            },
            { status: 400 }
          );
        }
        if (
          matchedPromo.expiresAtIso &&
          new Date(`${matchedPromo.expiresAtIso}T23:59:59`).getTime() < Date.now()
        ) {
          return NextResponse.json(
            {
              ok: false,
              persisted: false,
              error: "expired_promo_code",
              messageAr: `انتهت صلاحية كود الخصم (${matchedPromo.code}).`,
            },
            { status: 400 }
          );
        }
        if (matchedPromo.maxUses && matchedPromo.usedCount >= matchedPromo.maxUses) {
          return NextResponse.json(
            {
              ok: false,
              persisted: false,
              error: "exhausted_promo_code",
              messageAr: `وصل كود الخصم (${matchedPromo.code}) للحد الأقصى للاستخدام.`,
            },
            { status: 400 }
          );
        }

        promoIncrementTarget = {
          facilityId: ledger.facilityId,
          promoCodeUpper,
          facilityPayload: facLookup.payload || {},
        };
      }
    }

    let sanitizedLedger: SessionLedger = { ...ledger };

    if (!caller.isAdmin && !isProviderFacilityWriter && !isCoachOwner && !isDelegatedGroupScanner) {
      if (isAccountsOnly) {
        if (!existingPayload) {
          return NextResponse.json(
            { ok: false, persisted: false, error: "forbidden" },
            { status: 403 }
          );
        }
        sanitizedLedger = {
          ...(existingPayload as SessionLedger),
          receipts: Array.isArray(ledger.receipts) ? ledger.receipts : (existingPayload.receipts || []),
        };
      } else if (isSwimmerOwner) {
        const prevConfirmedMap = new Map<string, boolean>();
        for (const r of existingPayload?.receipts || []) {
          prevConfirmedMap.set(r.id, Boolean(r.confirmedByProvider));
        }
        const safeReceipts = (Array.isArray(ledger.receipts) ? ledger.receipts : []).map((r) => ({
          ...r,
          confirmedByProvider: prevConfirmedMap.get(r.id) === true,
        }));

        if (existingPayload) {
          sanitizedLedger = {
            ...(existingPayload as SessionLedger),
            receipts: safeReceipts,
          };
        } else {
          sanitizedLedger = {
            ...ledger,
            completedSessions: 0,
            status: "active",
            checkins: [],
            receipts: safeReceipts.map((r) => ({ ...r, confirmedByProvider: false })),
          };
        }
      }
    }

    let resolvedPinCode = (sanitizedLedger.pinCode || "").trim();
    if (!resolvedPinCode || resolvedPinCode === "****") {
      resolvedPinCode = existingPin || "0000";
    }

    // Ensure clientEventId on latest check-in if passed in body
    const bodyEventId =
      typeof body?.clientEventId === "string" && body.clientEventId.trim()
        ? body.clientEventId.trim()
        : undefined;
    const normalizedCheckins = Array.isArray(sanitizedLedger.checkins)
      ? sanitizedLedger.checkins.map((c, idx) =>
          bodyEventId &&
          idx === sanitizedLedger.checkins.length - 1 &&
          !c.clientEventId &&
          isCheckinIncrement
            ? { ...c, clientEventId: bodyEventId }
            : c
        )
      : [];

    const storedLedger: SessionLedger = {
      ...sanitizedLedger,
      checkins: normalizedCheckins,
      pinCode: resolvedPinCode,
    };

    const responseLedger: SessionLedger =
      caller.isAdmin || isSwimmerOwner
        ? storedLedger
        : { ...storedLedger, pinCode: "****" };

    const record = {
      id: storedLedger.id,
      ledger_code: storedLedger.ledgerCode.toUpperCase(),
      member_code: storedLedger.memberCode ? storedLedger.memberCode.trim().toUpperCase() : null,
      athlete_id: storedLedger.athleteId,
      athlete_name_ar: storedLedger.athleteNameAr,
      coach_id: storedLedger.coachId,
      facility_id: storedLedger.facilityId,
      pin_code: storedLedger.pinCode,
      total_sessions: storedLedger.totalSessions,
      completed_sessions: storedLedger.completedSessions,
      status: storedLedger.status,
      payload: storedLedger,
      updated_at: new Date().toISOString(),
    };

    if (existingPayload && isCheckinIncrement) {
      const casRes = await persistLedgerCasUpdate(record, existingCompletedSessions, admin);
      if (!casRes.ok) {
        if (casRes.conflict) {
          const latest = await fetchLedgerRowById(record.id, admin);
          const serverLedger = latest.row
            ? rowToSessionLedger(latest.row, caller.isAdmin || isSwimmerOwner)
            : undefined;
          return NextResponse.json(
            {
              ok: false,
              persisted: false,
              error: "concurrent_update_conflict",
              messageAr:
                "تم تحديث هذا الدفتر من جهاز آخر للتو — تم استرجاع أحدث رصيد حصص لمنع التعارض.",
              serverLedger,
            },
            { status: 409 }
          );
        }
        return NextResponse.json({
          ok: false,
          persisted: false,
          reason: casRes.reason || "db_error",
        });
      }
      if (storedLedger.memberCode) {
        const remaining = Math.max(0, storedLedger.totalSessions - storedLedger.completedSessions);
        try {
          await dispatchWhatsAppNotification({
            eventType: "attendance_checkin",
            recipientMemberCode: storedLedger.memberCode,
            facilityId: storedLedger.facilityId || null,
            ledgerId: storedLedger.id,
            athleteNameAr: storedLedger.athleteNameAr,
            facilityNameAr: storedLedger.facilityNameAr,
            completedSessions: storedLedger.completedSessions,
            totalSessions: storedLedger.totalSessions,
            remainingSessions: remaining,
            dedupeScope: `${storedLedger.id}-s${storedLedger.completedSessions}`,
            actionHref: `/dashboard/ledger?id=${encodeURIComponent(storedLedger.id)}`,
          });
          if (remaining > 0 && remaining <= 2) {
            await dispatchWhatsAppNotification({
              eventType: "subscription_expiring",
              recipientMemberCode: storedLedger.memberCode,
              facilityId: storedLedger.facilityId || null,
              ledgerId: storedLedger.id,
              athleteNameAr: storedLedger.athleteNameAr,
              facilityNameAr: storedLedger.facilityNameAr,
              completedSessions: storedLedger.completedSessions,
              totalSessions: storedLedger.totalSessions,
              remainingSessions: remaining,
              dedupeScope: `${storedLedger.id}-rem-${remaining}`,
              actionHref: `/dashboard/ledger?id=${encodeURIComponent(storedLedger.id)}`,
            });
          }
        } catch {
          // Never block check-in response on notification dispatch
        }
      }
      return NextResponse.json({ ok: true, persisted: true, ledger: responseLedger });
    }

    const upsertRes = await persistLedgerUpsert(record, admin);
    if (!upsertRes.ok) {
      return NextResponse.json({
        ok: false,
        persisted: false,
        reason: upsertRes.reason || "db_error",
      });
    }

    if (promoIncrementTarget) {
      await incrementFacilityPromoUsage(
        promoIncrementTarget.facilityId,
        promoIncrementTarget.promoCodeUpper,
        promoIncrementTarget.facilityPayload,
        admin
      );
    }

    if (storedLedger.memberCode && existingPayload) {
      try {
        if (storedLedger.totalSessions > (existingPayload.totalSessions || 0)) {
          await dispatchWhatsAppNotification({
            eventType: "subscription_renewal",
            recipientMemberCode: storedLedger.memberCode,
            facilityId: storedLedger.facilityId || null,
            ledgerId: storedLedger.id,
            athleteNameAr: storedLedger.athleteNameAr,
            facilityNameAr: storedLedger.facilityNameAr,
            completedSessions: storedLedger.completedSessions,
            totalSessions: storedLedger.totalSessions,
            remainingSessions: Math.max(0, storedLedger.totalSessions - storedLedger.completedSessions),
            dedupeScope: `${storedLedger.id}-t${storedLedger.totalSessions}`,
            actionHref: `/dashboard/ledger?id=${encodeURIComponent(storedLedger.id)}`,
          });
        }
        const prevConfirmed = new Set(
          (existingPayload.receipts || []).filter((r) => r.confirmedByProvider).map((r) => r.id)
        );
        const newlyConfirmed = (storedLedger.receipts || []).find(
          (r) => r.confirmedByProvider && !prevConfirmed.has(r.id)
        );
        if (newlyConfirmed) {
          await dispatchWhatsAppNotification({
            eventType: "receipt_confirmed",
            recipientMemberCode: storedLedger.memberCode,
            facilityId: storedLedger.facilityId || null,
            ledgerId: storedLedger.id,
            athleteNameAr: storedLedger.athleteNameAr,
            facilityNameAr: storedLedger.facilityNameAr,
            amountEgp: newlyConfirmed.amountEgp,
            dedupeScope: `${storedLedger.id}-rcpt-${newlyConfirmed.id}`,
            actionHref: `/dashboard/ledger?id=${encodeURIComponent(storedLedger.id)}`,
          });
        }
      } catch {
        // Best-effort notification
      }
    }

    return NextResponse.json({ ok: true, persisted: true, ledger: responseLedger });
  } catch {
    return NextResponse.json(
      { ok: false, persisted: false, reason: "invalid_payload" },
      { status: 400 }
    );
  }
}
