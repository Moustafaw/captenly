import { NextResponse } from "next/server";
import type { SessionLedger } from "@/types/captenly";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { checkCoachDelegatedQrAccess } from "@/lib/server/facilityLinksDb";
import { getDeterministicCoachId } from "@/lib/coachProvisioning";
import {
  getCallerAuthorizedFacilityIds,
  getCallerFacilityAccessRole,
  getServerCaller,
  sanitizeFilterToken,
  type ServerCallerContext,
} from "@/lib/memberSession";

export const dynamic = "force-dynamic";

const DUPLICATE_SCAN_WINDOW_MS = 3 * 60 * 60 * 1000;

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

async function queryLedgersWithPgFallback(
  filters: {
    memberCode?: string;
    athleteId?: string;
    coachId?: string;
    facilityId?: string;
    ledgerCode?: string;
  },
  caller: ServerCallerContext
): Promise<{ ok: boolean; ledgers: SessionLedger[]; errorCode?: string }> {
  const res = await withPgClient(async (client) => {
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

    if (conditions.length === 0) return [] as SessionLedger[];

    const sql = `SELECT * FROM public.captenly_session_ledgers WHERE ${conditions.join(" OR ")} ORDER BY updated_at DESC LIMIT 80`;
    const q = await client.query(sql, values);
    return (q.rows || [])
      .map((r) => {
        const row = r as Record<string, unknown>;
        return rowToSessionLedger(row, canCallerSeePin(row, caller));
      })
      .filter((x): x is SessionLedger => Boolean(x));
  });
  return res.ok
    ? { ok: true, ledgers: res.value }
    : { ok: false, ledgers: [], errorCode: res.errorCode };
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

  if (!memberCode && !athleteId && !coachId && !facilityId && !ledgerCode) {
    return NextResponse.json({ persisted: false, ledgers: [], profile: null });
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
      const pgFallback = await queryLedgersWithPgFallback(
        {
          memberCode,
          athleteId,
          coachId,
          facilityId,
          ledgerCode,
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
        profile: allowMatchedProfile ? matchedProfile : null,
        ...(pgFallback.ok ? {} : { reason: pgFallback.errorCode || error.code }),
      });
    }

    if (error) {
      return NextResponse.json({
        persisted: false,
        ledgers: [],
        profile: matchedProfile,
        reason: error.code || "db_error",
      });
    }

    const rawLedgers = (data || [])
      .map((r) => {
        const row = r as Record<string, unknown>;
        return rowToSessionLedger(row, canCallerSeePin(row, caller));
      })
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
      profile: allowMatchedProfile ? matchedProfile : null,
    });
  } catch {
    return NextResponse.json({
      persisted: false,
      ledgers: [],
      profile: null,
      reason: "query_error",
    });
  }
}

export async function POST(request: Request) {
  const caller = await getServerCaller();
  if (!caller.authenticated) {
    return NextResponse.json({ persisted: false, error: "unauthorized" }, { status: 401 });
  }

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
      return NextResponse.json({ persisted: false, error: "forbidden" }, { status: 403 });
    }

    let existingPin: string | undefined;
    let existingFacilityId: string | undefined;
    let existingPayload: Partial<SessionLedger> | undefined;
    let existingLookupSucceeded = false;
    try {
      const { data: existingRow, error: existingErr } = await admin
        .from("captenly_session_ledgers")
        .select("pin_code, facility_id, payload")
        .eq("id", ledger.id)
        .maybeSingle();
      if (!existingErr) {
        existingLookupSucceeded = true;
        if (typeof existingRow?.pin_code === "string" && existingRow.pin_code !== "****") {
          existingPin = existingRow.pin_code;
        }
        if (typeof existingRow?.facility_id === "string") {
          existingFacilityId = existingRow.facility_id;
        }
        if (existingRow?.payload && typeof existingRow.payload === "object") {
          existingPayload = existingRow.payload as Partial<SessionLedger>;
        }
      }
    } catch {
      // fall through to PostgreSQL fallback lookup
    }

    let pgLookupOk = false;
    if (!existingLookupSucceeded) {
      const pgExisting = await withPgClient(async (client) => {
        const res = await client.query(
          `select pin_code, facility_id, payload from public.captenly_session_ledgers where id = $1 limit 1`,
          [ledger.id]
        );
        return (res.rows?.[0] || null) as Record<string, unknown> | null;
      });
      pgLookupOk = pgExisting.ok;
      if (pgExisting.ok && pgExisting.value) {
        if (typeof pgExisting.value.pin_code === "string" && pgExisting.value.pin_code !== "****") {
          existingPin = pgExisting.value.pin_code;
        }
        if (typeof pgExisting.value.facility_id === "string") {
          existingFacilityId = pgExisting.value.facility_id;
        }
        if (pgExisting.value.payload && typeof pgExisting.value.payload === "object") {
          existingPayload = pgExisting.value.payload as Partial<SessionLedger>;
        }
      }
    }

    if (!existingLookupSucceeded && !pgLookupOk) {
      return NextResponse.json(
        { persisted: false, error: "ledger_lookup_unavailable" },
        { status: 503 }
      );
    }

    // Security remediation (F-007): prevent swapping facilityId on an existing ledger to bypass ACLs.
    const storedFacilityId = existingFacilityId || existingPayload?.facilityId;
    if (!caller.isAdmin && storedFacilityId && storedFacilityId !== ledger.facilityId) {
      return NextResponse.json({ persisted: false, error: "forbidden_facility_change" }, { status: 403 });
    }

    // Governance enforcement: If a host facility governs this coach/academy link and has NOT enabled QR scan delegation,
    // prevent direct check-in increments from coach clients.
    const isCheckinIncrement =
      ledger.completedSessions > Number(existingPayload?.completedSessions ?? 0) ||
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
          persisted: false,
          error: "coach_qr_scan_not_delegated",
          messageAr: `صلاحية مسح الـ QR لهذه المجموعة مقصورة حالياً على بوابة ${ledger.facilityNameAr}.`,
        },
        { status: 403 }
      );
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

    let sanitizedLedger: SessionLedger = { ...ledger };

    if (!caller.isAdmin && !isProviderFacilityWriter && !isCoachOwner && !isDelegatedGroupScanner) {
      if (isAccountsOnly) {
        if (!existingPayload) {
          return NextResponse.json({ persisted: false, error: "forbidden" }, { status: 403 });
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

    const storedLedger: SessionLedger = {
      ...sanitizedLedger,
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

    let { error } = await admin
      .from("captenly_session_ledgers")
      .upsert(record, { onConflict: "id" });

    if (error && (error.code === "42P01" || error.code === "PGRST205")) {
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
      if (pgRes.ok) {
        return NextResponse.json({ persisted: true, ledger: responseLedger });
      }
      return NextResponse.json({ persisted: false, reason: pgRes.errorCode });
    }

    if (error) {
      return NextResponse.json({ persisted: false, reason: error.code || "db_error" });
    }

    return NextResponse.json({ persisted: true, ledger: responseLedger });
  } catch {
    return NextResponse.json({ persisted: false, reason: "invalid_payload" }, { status: 400 });
  }
}
