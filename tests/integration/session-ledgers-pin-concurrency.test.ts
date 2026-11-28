import { beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { FacilityAccessRole } from "@/lib/facilityPermissions";
import type { ServerCallerContext } from "@/lib/memberSession";
import type { Facility, FacilityLinkedEntity, SessionLedger } from "@/types/captenly";

interface StoredLedgerRow {
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
}

let currentCaller: ServerCallerContext = { authenticated: false, isAdmin: false };
let currentAccessRole: FacilityAccessRole | null = null;
let authorizedFacilityIds = new Set<string>();
let useSupabaseAdmin = true;

const ledgerStore = new Map<string, StoredLedgerRow>();
const facilityStore = new Map<string, Partial<Facility>>();
const linkStore = new Map<string, FacilityLinkedEntity>();
const rateLimitCounters = new Map<string, number>();

function makeLedger(overrides: Partial<SessionLedger> = {}): SessionLedger {
  const id = overrides.id || "led-1";
  const ledgerCode = overrides.ledgerCode || "SUB-1001-A1";
  return {
    id,
    ledgerCode,
    subscriptionCode: overrides.subscriptionCode || ledgerCode,
    memberCode: "CAP-M-1001",
    athleteId: "ath-1001",
    athleteNameAr: "يوسف طارق",
    isMinor: false,
    coachId: "coach-1",
    coachNameAr: "كابتن شريف",
    facilityId: "fac-1",
    facilityNameAr: "نادي الموج الأزرق",
    sportSector: "swimming",
    packageTitleAr: "باقة 8 حصص",
    totalSessions: 8,
    completedSessions: 2,
    pinCode: "4829",
    status: "active",
    isCodeExpired: false,
    startedDateAr: "اليوم",
    checkins: [],
    receipts: [],
    ...overrides,
  };
}

function seedLedger(ledger: SessionLedger, updatedAt = "2026-11-27T10:00:00.000Z") {
  ledgerStore.set(ledger.id, {
    id: ledger.id,
    ledger_code: ledger.ledgerCode.toUpperCase(),
    member_code: ledger.memberCode ? ledger.memberCode.toUpperCase() : null,
    athlete_id: ledger.athleteId,
    athlete_name_ar: ledger.athleteNameAr,
    coach_id: ledger.coachId,
    facility_id: ledger.facilityId,
    pin_code: ledger.pinCode,
    total_sessions: ledger.totalSessions,
    completed_sessions: ledger.completedSessions,
    status: ledger.status,
    payload: ledger,
    updated_at: updatedAt,
  });
}

function filterLedgerRows(orRaw: string): StoredLedgerRow[] {
  const clauses = orRaw.split(",").map((s) => s.trim()).filter(Boolean);
  return Array.from(ledgerStore.values())
    .filter((row) => {
      if (clauses.length === 0) return true;
      return clauses.some((clause) => {
        if (clause.startsWith("ledger_code.ilike.")) {
          return row.ledger_code.toUpperCase() === clause.slice("ledger_code.ilike.".length).toUpperCase();
        }
        if (clause.startsWith("member_code.ilike.")) {
          return (row.member_code || "").toUpperCase() === clause.slice("member_code.ilike.".length).toUpperCase();
        }
        if (clause.startsWith("athlete_id.eq.")) {
          return row.athlete_id === clause.slice("athlete_id.eq.".length);
        }
        if (clause.startsWith("coach_id.eq.")) {
          return row.coach_id === clause.slice("coach_id.eq.".length);
        }
        if (clause.startsWith("facility_id.eq.")) {
          return row.facility_id === clause.slice("facility_id.eq.".length);
        }
        return false;
      });
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

const mockModule = mock.module.bind(mock) as unknown as (
  specifier: string,
  opts: { exports: Record<string, unknown> }
) => void;

mockModule("@/lib/memberSession", {
  exports: {
    getServerCaller: async () => currentCaller,
    getCallerFacilityAccessRole: async () => currentAccessRole,
    getCallerAuthorizedFacilityIds: async () => new Set(authorizedFacilityIds),
    sanitizeFilterToken: (raw: string) =>
      raw
        .replace(/[,()*%'"\\;\r\n]/g, "")
        .trim()
        .slice(0, 120),
  },
});

mockModule("@/lib/server/facilityLinksDb", {
  exports: {
    checkCoachDelegatedQrAccess: async (params: {
      facilityId: string;
      coachId?: string;
      memberCode?: string;
      ledgerLinkedEntityId?: string;
    }) => {
      const links = Array.from(linkStore.values()).filter(
        (l) => l.facilityId === params.facilityId
      );
      const matched = links.find(
        (l) =>
          (params.ledgerLinkedEntityId && l.id === params.ledgerLinkedEntityId) ||
          (params.coachId && l.linkedCoachId === params.coachId)
      );
      if (!matched) return { governed: false, canScan: true };
      return {
        governed: true,
        canScan: matched.status === "approved" && Boolean(matched.canScanGroupQr),
        matchedLink: matched,
      };
    },
  },
});

mockModule("@/lib/server/rateLimit", {
  exports: {
    enforceRateLimit: async (opts: { bucket: string; identifier: string; limit: number; windowSec: number }) => {
      const key = `${opts.bucket}:${opts.identifier}`;
      const next = (rateLimitCounters.get(key) || 0) + 1;
      rateLimitCounters.set(key, next);
      return {
        allowed: next <= opts.limit,
        remaining: Math.max(0, opts.limit - next),
        retryAfterSec: opts.windowSec,
        backend: "supabase_rest",
      };
    },
    rateLimitExceededResponse: (retryAfterSec: number, messageAr = "rate_limited") =>
      new Response(
        JSON.stringify({ ok: false, persisted: false, error: "rate_limited", retryAfterSec, messageAr }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSec),
          },
        }
      ),
  },
});

mockModule("@/lib/supabase/server", {
  exports: {
    getSupabaseAdminClient: () => {
      if (!useSupabaseAdmin) return null;
      return {
        from(table: string) {
          if (table === "captenly_session_ledgers") {
            return {
              select() {
                let eqId: string | null = null;
                let eqFacId: string | null = null;
                let eqCoachId: string | null = null;
                let inFacIds: string[] | null = null;
                let orExpr = "";
                let rangeBounds: [number, number] | null = null;

                const executeQuery = () => {
                  let rows = Array.from(ledgerStore.values());
                  if (eqFacId) rows = rows.filter((r) => r.facility_id === eqFacId);
                  else if (orExpr) rows = filterLedgerRows(orExpr);
                  else if (eqCoachId) rows = rows.filter((r) => r.coach_id === eqCoachId);
                  else if (inFacIds) rows = rows.filter((r) => inFacIds!.includes(r.facility_id));
                  rows = rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
                  if (rangeBounds) {
                    rows = rows.slice(rangeBounds[0], rangeBounds[1] + 1);
                  }
                  return { data: rows, error: null };
                };

                const queryChain: Record<string, unknown> = {
                  eq(col: string, val: string) {
                    if (col === "id") eqId = val;
                    if (col === "facility_id") eqFacId = val;
                    if (col === "coach_id") eqCoachId = val;
                    return queryChain;
                  },
                  in(_col: string, vals: string[]) {
                    inFacIds = vals;
                    return queryChain;
                  },
                  or(expr: string) {
                    orExpr = expr;
                    return queryChain;
                  },
                  order() {
                    return queryChain;
                  },
                  limit() {
                    return queryChain;
                  },
                  range(fromIdx: number, toIdx: number) {
                    rangeBounds = [fromIdx, toIdx];
                    return Promise.resolve(executeQuery());
                  },
                  async maybeSingle() {
                    const row = eqId ? ledgerStore.get(eqId) || null : null;
                    return { data: row, error: null };
                  },
                  then(
                    onFulfilled: (value: { data: StoredLedgerRow[]; error: null }) => unknown,
                    onRejected?: (reason: unknown) => unknown
                  ) {
                    return Promise.resolve(executeQuery()).then(onFulfilled, onRejected);
                  },
                };
                return queryChain;
              },
              update(patch: Partial<StoredLedgerRow>) {
                let eqId = "";
                let expectedCompleted: number | undefined;
                const updateChain = {
                  eq(col: string, val: unknown) {
                    if (col === "id") eqId = String(val);
                    if (col === "completed_sessions") expectedCompleted = Number(val);
                    return updateChain;
                  },
                  async select() {
                    const existing = ledgerStore.get(eqId);
                    if (!existing || existing.completed_sessions !== expectedCompleted) {
                      return { data: [], error: null };
                    }
                    const next: StoredLedgerRow = { ...existing, ...patch };
                    ledgerStore.set(eqId, next);
                    return { data: [{ id: eqId }], error: null };
                  },
                };
                return updateChain;
              },
              async upsert(record: StoredLedgerRow) {
                ledgerStore.set(record.id, { ...record });
                return { error: null };
              },
            };
          }
          if (table === "captenly_facilities") {
            return {
              select() {
                return {
                  eq(_col: string, val: string) {
                    return {
                      async maybeSingle() {
                        const fac = facilityStore.get(val);
                        return { data: fac ? { id: val, payload: fac } : null, error: null };
                      },
                    };
                  },
                };
              },
              update(patch: { payload: Partial<Facility> }) {
                return {
                  async eq(_col: string, val: string) {
                    facilityStore.set(val, patch.payload);
                    return { error: null };
                  },
                };
              },
            };
          }
          if (table === "captenly_profiles") {
            return {
              select() {
                return {
                  ilike() {
                    return {
                      async maybeSingle() {
                        return { data: null, error: null };
                      },
                    };
                  },
                };
              },
            };
          }
          return {};
        },
      };
    },
  },
});

mockModule("@/lib/supabase/pgFallback", {
  exports: {
    withPgClient: async (fn: (client: { query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }> }) => Promise<unknown>) => {
      const value = await fn({
        async query(sql: string, values: unknown[] = []) {
          const normalized = sql.toLowerCase();
          if (normalized.includes("from public.captenly_session_ledgers")) {
            const limitVal = Number(values[values.length - 2] ?? 81);
            const offsetVal = Number(values[values.length - 1] ?? 0);
            const filterTokens = values.slice(0, -2).map((v) => String(v));
            const matched = Array.from(ledgerStore.values())
              .filter((row) =>
                filterTokens.some(
                  (tok) =>
                    row.facility_id === tok ||
                    row.ledger_code.toUpperCase() === tok.toUpperCase() ||
                    (row.member_code || "").toUpperCase() === tok.toUpperCase() ||
                    row.coach_id === tok ||
                    row.athlete_id === tok
                )
              )
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
            return { rows: matched.slice(offsetVal, offsetVal + limitVal) };
          }
          return { rows: [] };
        },
      });
      return { ok: true, value };
    },
  },
});

const { GET, POST } = await import("@/app/api/supabase/session-ledgers/route");

function makePost(body: unknown) {
  return new Request("https://captenly.test/api/supabase/session-ledgers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API integration: /api/supabase/session-ledgers PIN, CAS, idempotency, promos & pagination", () => {
  beforeEach(() => {
    useSupabaseAdmin = true;
    ledgerStore.clear();
    facilityStore.clear();
    linkStore.clear();
    rateLimitCounters.clear();

    currentCaller = {
      authenticated: true,
      isAdmin: false,
      memberCode: "CAP-M-9001",
      role: "facility_manager",
      linkedFacilityId: "fac-1",
    };
    currentAccessRole = "owner";
    authorizedFacilityIds = new Set(["fac-1"]);

    seedLedger(makeLedger({ id: "led-1", pinCode: "4829", completedSessions: 2 }));

    facilityStore.set("fac-1", {
      id: "fac-1",
      nameAr: "نادي الموج الأزرق",
      poolDeskConfig: {
        waterFeePerSessionEgp: 60,
        allowOpenManualDiscount: true,
        promoCodes: [
          {
            id: "p-valid",
            code: "SUMMER20",
            discountType: "percent",
            value: 20,
            isActive: true,
            maxUses: 5,
            usedCount: 1,
            expiresAtIso: "2099-12-31",
            createdAtIso: "2026-11-27T08:00:00Z",
          },
          {
            id: "p-inactive",
            code: "PAUSED",
            discountType: "fixed_egp",
            value: 100,
            isActive: false,
            usedCount: 0,
            createdAtIso: "2026-11-27T08:00:00Z",
          },
          {
            id: "p-expired",
            code: "OLD2020",
            discountType: "fixed_egp",
            value: 100,
            isActive: true,
            usedCount: 0,
            expiresAtIso: "2020-01-01",
            createdAtIso: "2026-11-27T08:00:00Z",
          },
          {
            id: "p-maxed",
            code: "MAXED",
            discountType: "fixed_egp",
            value: 100,
            isActive: true,
            maxUses: 3,
            usedCount: 3,
            createdAtIso: "2026-11-27T08:00:00Z",
          },
        ],
        linkedEntities: [],
      },
    });
  });

  it("enforces PIN checkin auth, RBAC, timingSafeEqual, masking, rate limit, ambiguous PIN, 3h duplicate, and exhaustion", async () => {
    // 1. 401 unauthenticated
    currentCaller = { authenticated: false, isAdmin: false };
    assert.equal((await POST(makePost({ action: "pin_checkin", pinCode: "4829" }))).status, 401);

    // 2. 403 accounts_manager
    currentCaller = { authenticated: true, isAdmin: false, memberCode: "CAP-M-ACC", role: "adult_athlete" };
    currentAccessRole = "accounts_manager";
    const accRes = await POST(makePost({ action: "pin_checkin", pinCode: "4829", facilityId: "fac-1" }));
    assert.equal(accRes.status, 403);
    assert.equal((await accRes.json()).error, "forbidden_accounts_manager");

    // 3. 403 swimmer self-deduction
    currentCaller = { authenticated: true, isAdmin: false, memberCode: "CAP-M-1001", role: "adult_athlete" };
    currentAccessRole = null;
    authorizedFacilityIds = new Set();
    const selfRes = await POST(makePost({ action: "pin_checkin", pinCode: "4829", ledgerId: "led-1" }));
    assert.equal(selfRes.status, 403);

    // 4. 403 wrong PIN & masking on GET for facility staff
    currentCaller = { authenticated: true, isAdmin: false, memberCode: "CAP-M-9001", role: "facility_manager", linkedFacilityId: "fac-1" };
    currentAccessRole = "owner";
    authorizedFacilityIds = new Set(["fac-1"]);

    const getStaff = await GET(new Request("https://captenly.test/api/supabase/session-ledgers?facilityId=fac-1"));
    assert.equal(getStaff.status, 200);
    const getStaffBody = (await getStaff.json()) as { ledgers: SessionLedger[] };
    assert.equal(getStaffBody.ledgers[0].pinCode, "****");

    const wrongPinRes = await POST(makePost({ action: "pin_checkin", pinCode: "9999", facilityId: "fac-1" }));
    assert.equal(wrongPinRes.status, 403);
    assert.equal((await wrongPinRes.json()).error, "invalid_pin");

    // 5. Valid 200 PIN checkin masks pinCode for staff and marks pin_4digit
    const okRes = await POST(
      makePost({
        action: "pin_checkin",
        pinCode: "4829",
        facilityId: "fac-1",
        clientEventId: "evt-pin-1",
      })
    );
    assert.equal(okRes.status, 200);
    const okBody = (await okRes.json()) as { ok: boolean; ledger: SessionLedger };
    assert.equal(okBody.ok, true);
    assert.equal(okBody.ledger.pinCode, "****");
    assert.equal(okBody.ledger.completedSessions, 3);
    assert.equal(okBody.ledger.checkins[0].method, "pin_4digit");

    // 6. Idempotent replay via clientEventId does NOT double-deduct
    const replayRes = await POST(
      makePost({
        action: "pin_checkin",
        pinCode: "4829",
        facilityId: "fac-1",
        clientEventId: "evt-pin-1",
      })
    );
    assert.equal(replayRes.status, 200);
    const replayBody = (await replayRes.json()) as { idempotentReplay: boolean; ledger: SessionLedger };
    assert.equal(replayBody.idempotentReplay, true);
    assert.equal(replayBody.ledger.completedSessions, 3);

    // 7. 409 duplicate_checkin_3h blocked for general_staff even with overrideDuplicate3h, allowed for owner
    currentAccessRole = "general_staff";
    const dupBlocked = await POST(
      makePost({
        action: "pin_checkin",
        pinCode: "4829",
        facilityId: "fac-1",
        overrideDuplicate3h: true,
        clientEventId: "evt-pin-2",
      })
    );
    assert.equal(dupBlocked.status, 409);
    assert.equal((await dupBlocked.json()).error, "duplicate_checkin_3h");

    currentAccessRole = "owner";
    const dupOverride = await POST(
      makePost({
        action: "pin_checkin",
        pinCode: "4829",
        facilityId: "fac-1",
        overrideDuplicate3h: true,
        clientEventId: "evt-pin-2",
      })
    );
    assert.equal(dupOverride.status, 200);
    assert.equal((await dupOverride.json()).ledger.completedSessions, 4);

    // 8. 400 exhausted ledger
    seedLedger(
      makeLedger({
        id: "led-exhausted",
        ledgerCode: "SUB-EXH",
        pinCode: "3333",
        totalSessions: 8,
        completedSessions: 8,
        status: "completed",
        isCodeExpired: true,
      })
    );
    const exhRes = await POST(makePost({ action: "pin_checkin", pinCode: "3333", facilityId: "fac-1" }));
    assert.equal(exhRes.status, 400);
    assert.equal((await exhRes.json()).error, "ledger_exhausted");

    // 9. 409 ambiguous_pin when 2 active ledgers share the same PIN
    seedLedger(makeLedger({ id: "led-dup-a", ledgerCode: "SUB-A", pinCode: "7777" }));
    seedLedger(makeLedger({ id: "led-dup-b", ledgerCode: "SUB-B", pinCode: "7777" }));
    const ambigRes = await POST(makePost({ action: "pin_checkin", pinCode: "7777", facilityId: "fac-1" }));
    assert.equal(ambigRes.status, 409);
    assert.equal((await ambigRes.json()).error, "ambiguous_pin");

    // 10. 429 rate limit after >10 attempts
    for (let i = 0; i < 4; i++) {
      await POST(makePost({ action: "pin_checkin", pinCode: "9999", facilityId: "fac-1" }));
    }
    const rlRes = await POST(makePost({ action: "pin_checkin", pinCode: "4829", facilityId: "fac-1" }));
    assert.equal(rlRes.status, 429);
    assert.equal((await rlRes.json()).error, "rate_limited");
  });

  it("enforces optimistic CAS concurrency and idempotency on standard POST (GAP-021)", async () => {
    const base = ledgerStore.get("led-1")!.payload;
    const staleUpdate = makeLedger({
      ...base,
      completedSessions: 3,
      checkins: [
        {
          sessionNumber: 3,
          dateAr: "اليوم",
          method: "qr_scan",
          verifiedByAr: "البوابة",
          coachNoteAr: "",
          wasOffline: false,
          clientEventId: "evt-cas-1",
          scannedAtIso: new Date().toISOString(),
        },
      ],
    });

    // Stale expectedCompletedSessions (1 != 2) -> 409 concurrent_update_conflict + serverLedger
    const conflictRes = await POST(
      makePost({
        ledger: staleUpdate,
        expectedCompletedSessions: 1,
        clientEventId: "evt-cas-1",
      })
    );
    assert.equal(conflictRes.status, 409);
    const conflictBody = (await conflictRes.json()) as {
      error: string;
      serverLedger: SessionLedger;
    };
    assert.equal(conflictBody.error, "concurrent_update_conflict");
    assert.equal(conflictBody.serverLedger.completedSessions, 2);
    assert.equal(conflictBody.serverLedger.pinCode, "****");

    // Valid expectedCompletedSessions (2 === 2) -> 200
    const okRes = await POST(
      makePost({
        ledger: staleUpdate,
        expectedCompletedSessions: 2,
        clientEventId: "evt-cas-1",
      })
    );
    assert.equal(okRes.status, 200);
    assert.equal((await okRes.json()).ledger.completedSessions, 3);

    // Idempotent replay with same clientEventId -> 200 idempotentReplay: true without double increment
    const replayRes = await POST(
      makePost({
        ledger: { ...staleUpdate, completedSessions: 4 },
        expectedCompletedSessions: 2,
        clientEventId: "evt-cas-1",
      })
    );
    assert.equal(replayRes.status, 200);
    const replayBody = (await replayRes.json()) as {
      idempotentReplay: boolean;
      ledger: SessionLedger;
    };
    assert.equal(replayBody.idempotentReplay, true);
    assert.equal(replayBody.ledger.completedSessions, 3);
  });

  it("validates promo codes on new enrollment and increments usedCount on success (GAP-010)", async () => {
    for (const [promoCode, expectedErr] of [
      ["MISSING", "invalid_promo_code"],
      ["PAUSED", "inactive_promo_code"],
      ["OLD2020", "expired_promo_code"],
      ["MAXED", "exhausted_promo_code"],
    ] as const) {
      const badRes = await POST(
        makePost({
          ledger: makeLedger({ id: `led-promo-${promoCode}`, ledgerCode: `SUB-${promoCode}` }),
          promoCodeUsed: promoCode,
        })
      );
      assert.equal(badRes.status, 400);
      assert.equal((await badRes.json()).error, expectedErr);
    }

    const okRes = await POST(
      makePost({
        ledger: makeLedger({ id: "led-promo-ok", ledgerCode: "SUB-PROMO-OK" }),
        promoCodeUsed: "SUMMER20",
      })
    );
    assert.equal(okRes.status, 200);
    const promos = facilityStore.get("fac-1")?.poolDeskConfig?.promoCodes || [];
    assert.equal(promos.find((p) => p.code === "SUMMER20")?.usedCount, 2);
  });

  it("supports pagination >80 rows (GAP-014) and pure-PG GET fallback without admin client (GAP-006)", async () => {
    ledgerStore.clear();
    for (let i = 0; i < 85; i++) {
      const ts = new Date(Date.UTC(2026, 10, 27, 10, 0, i)).toISOString();
      seedLedger(
        makeLedger({
          id: `led-pg-${i}`,
          ledgerCode: `SUB-PG-${i}`,
          pinCode: "1122",
        }),
        ts
      );
    }

    // Page 1 via Supabase (>80 rows)
    const page1Res = await GET(
      new Request("https://captenly.test/api/supabase/session-ledgers?facilityId=fac-1&limit=80&offset=0")
    );
    assert.equal(page1Res.status, 200);
    const page1 = (await page1Res.json()) as {
      persisted: boolean;
      ledgers: SessionLedger[];
      hasMore: boolean;
      nextOffset: number | null;
    };
    assert.equal(page1.persisted, true);
    assert.equal(page1.ledgers.length, 80);
    assert.equal(page1.hasMore, true);
    assert.equal(page1.nextOffset, 80);

    // Page 2 via pure-PG fallback (admin = null)
    useSupabaseAdmin = false;
    const page2Res = await GET(
      new Request("https://captenly.test/api/supabase/session-ledgers?facilityId=fac-1&limit=80&offset=80")
    );
    assert.equal(page2Res.status, 200);
    const page2 = (await page2Res.json()) as {
      persisted: boolean;
      ledgers: SessionLedger[];
      hasMore: boolean;
      nextOffset: number | null;
    };
    assert.equal(page2.persisted, true);
    assert.equal(page2.ledgers.length, 5);
    assert.equal(page2.hasMore, false);
    assert.equal(page2.nextOffset, null);

    // Swimmer owner sees own real PIN via pure-PG GET fallback
    currentCaller = {
      authenticated: true,
      isAdmin: false,
      memberCode: "CAP-M-1001",
      role: "adult_athlete",
    };
    authorizedFacilityIds = new Set();
    const swimmerRes = await GET(
      new Request("https://captenly.test/api/supabase/session-ledgers?memberCode=CAP-M-1001&limit=10")
    );
    assert.equal(swimmerRes.status, 200);
    const swimmerBody = (await swimmerRes.json()) as { ledgers: SessionLedger[] };
    assert.equal(swimmerBody.ledgers[0].pinCode, "1122");
  });
});
