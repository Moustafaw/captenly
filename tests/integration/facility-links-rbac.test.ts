import { beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { FacilityAccessRole } from "@/lib/facilityPermissions";
import type { ServerCallerContext } from "@/lib/memberSession";
import type { FacilityLinkedEntity, SessionLedger } from "@/types/captenly";

const mockModule = mock.module.bind(mock) as unknown as (
  specifier: string,
  opts: { exports: Record<string, unknown> }
) => void;

let currentCaller: ServerCallerContext = { authenticated: false, isAdmin: false };
let currentAccessRole: FacilityAccessRole | null = null;
const linkStore = new Map<string, FacilityLinkedEntity>();
const ledgerStore = new Map<string, Record<string, unknown>>();

mockModule("@/lib/memberSession", {
  exports: {
    getServerCaller: async () => currentCaller,
    getCallerFacilityAccessRole: async () => currentAccessRole,
    hasFacilityStaffAccess: async () => Boolean(currentAccessRole),
    getCallerAuthorizedFacilityIds: async () =>
      currentCaller.linkedFacilityId ? new Set([currentCaller.linkedFacilityId]) : new Set<string>(),
    sanitizeFilterToken: (raw: string) =>
      raw
        .replace(/[,()*%'"\\;\r\n]/g, "")
        .trim()
        .slice(0, 120),
  },
});

mockModule("@/lib/server/facilityLinksDb", {
  exports: {
    fetchFacilityLinksByFacilityId: async (facilityId: string) =>
      Array.from(linkStore.values()).filter((l) => l.facilityId === facilityId),
    rowToFacilityLink: (row: Record<string, unknown>) =>
      (row.payload as FacilityLinkedEntity) || null,
    withFacilityLinksPg: async () => ({ ok: false, errorCode: "missing_postgres_url" }),
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

mockModule("@/lib/supabase/server", {
  exports: {
    getSupabaseAdminClient: () => ({
      from(table: string) {
        if (table === "captenly_facility_links") {
          return {
            async upsert(row: { payload: FacilityLinkedEntity }) {
              linkStore.set(row.payload.id, row.payload);
              return { error: null };
            },
          };
        }
        if (table === "captenly_facilities") {
          return {
            select() {
              return {
                eq() {
                  return {
                    async limit() {
                      return { data: [], error: null };
                    },
                  };
                },
              };
            },
          };
        }
        if (table === "captenly_session_ledgers") {
          return {
            select() {
              let eqId = "";
              return {
                eq(_col: string, val: string) {
                  eqId = val;
                  return {
                    async maybeSingle() {
                      return { data: ledgerStore.get(eqId) || null, error: null };
                    },
                  };
                },
              };
            },
            update(patch: Record<string, unknown>) {
              let eqId = "";
              let expectedCompleted: number | undefined;
              const chain = {
                eq(col: string, val: unknown) {
                  if (col === "id") eqId = String(val);
                  if (col === "completed_sessions") expectedCompleted = Number(val);
                  return chain;
                },
                async select() {
                  const row = ledgerStore.get(eqId);
                  if (!row || Number(row.completed_sessions) !== expectedCompleted) {
                    return { data: [], error: null };
                  }
                  const updated = { ...row, ...patch };
                  ledgerStore.set(eqId, updated);
                  return { data: [{ id: eqId }], error: null };
                },
              };
              return chain;
            },
          };
        }
        return {};
      },
    }),
  },
});

mockModule("@/lib/supabase/pgFallback", {
  exports: {
    withPgClient: async () => ({ ok: false, errorCode: "missing_postgres_url" }),
  },
});

mockModule("@/lib/server/rateLimit", {
  exports: {
    enforceRateLimit: async () => ({
      allowed: true,
      remaining: 10,
      retryAfterSec: 300,
      backend: "unconfigured_fail_open",
    }),
    rateLimitExceededResponse: () => new Response(null, { status: 429 }),
  },
});

const facilityLinksRoute = await import("@/app/api/supabase/facility-links/route");
const sessionLedgersRoute = await import("@/app/api/supabase/session-ledgers/route");

function makeLedger(overrides: Partial<SessionLedger> = {}): SessionLedger {
  return {
    id: "led-group-1",
    ledgerCode: "SUB-7001-A1",
    subscriptionCode: "SUB-7001-A1",
    memberCode: "CAP-M-7001",
    athleteId: "ath-7001",
    athleteNameAr: "آدم خالد",
    isMinor: false,
    coachId: "coach-cap-c-1001",
    coachNameAr: "كابتن شريف",
    facilityId: "fac-1",
    facilityNameAr: "نادي الموج",
    linkedEntityId: "link-coach-1",
    sportSector: "swimming",
    packageTitleAr: "باقة 8 حصص",
    totalSessions: 8,
    completedSessions: 2,
    pinCode: "5678",
    status: "active",
    isCodeExpired: false,
    startedDateAr: "اليوم",
    checkins: [],
    receipts: [],
    ...overrides,
  };
}

describe("API integration: facility-links RBAC & canScanGroupQr enforcement", () => {
  beforeEach(() => {
    linkStore.clear();
    ledgerStore.clear();

    linkStore.set("link-coach-1", {
      id: "link-coach-1",
      facilityId: "fac-1",
      facilityNameAr: "نادي الموج",
      entityKind: "coach",
      linkedCoachId: "coach-cap-c-1001",
      linkedMemberCode: "CAP-C-1001",
      displayNameAr: "كابتن شريف",
      agreementType: "per_swimmer_water",
      direction: "added_by_facility",
      status: "approved",
      canScanGroupQr: false,
      createdAtAr: "اليوم",
      createdAtIso: "2026-11-27T08:00:00Z",
    });

    const baseLedger = makeLedger();
    ledgerStore.set(baseLedger.id, {
      id: baseLedger.id,
      ledger_code: baseLedger.ledgerCode,
      member_code: baseLedger.memberCode,
      athlete_id: baseLedger.athleteId,
      athlete_name_ar: baseLedger.athleteNameAr,
      coach_id: baseLedger.coachId,
      facility_id: baseLedger.facilityId,
      pin_code: baseLedger.pinCode,
      total_sessions: baseLedger.totalSessions,
      completed_sessions: baseLedger.completedSessions,
      status: baseLedger.status,
      payload: baseLedger,
    });
  });

  it("blocks accounts_manager (403) on facility-links PATCH and add_direct, while allowing owner (200)", async () => {
    currentCaller = {
      authenticated: true,
      isAdmin: false,
      memberCode: "CAP-M-3002",
      role: "adult_athlete",
    };
    currentAccessRole = "accounts_manager";

    const addBlocked = await facilityLinksRoute.POST(
      new Request("https://captenly.test/api/supabase/facility-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_direct",
          facilityId: "fac-1",
          displayNameAr: "أكاديمية الدلتا",
        }),
      })
    );
    assert.equal(addBlocked.status, 403);
    assert.equal((await addBlocked.json()).error, "forbidden");

    const patchBlocked = await facilityLinksRoute.PATCH(
      new Request("https://captenly.test/api/supabase/facility-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "link-coach-1",
          facilityId: "fac-1",
          canScanGroupQr: true,
        }),
      })
    );
    assert.equal(patchBlocked.status, 403);

    // Owner succeeds
    currentAccessRole = "owner";
    const ownerPatch = await facilityLinksRoute.PATCH(
      new Request("https://captenly.test/api/supabase/facility-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "link-coach-1",
          facilityId: "fac-1",
          canScanGroupQr: true,
          collectedMonthlyEgp: 1500,
        }),
      })
    );
    assert.equal(ownerPatch.status, 200);
    const body = (await ownerPatch.json()) as { ok: boolean; link: FacilityLinkedEntity };
    assert.equal(body.ok, true);
    assert.equal(body.link.canScanGroupQr, true);
    assert.equal(body.link.collectedMonthlyEgp, 1500);
  });

  it("enforces canScanGroupQr on session-ledgers POST for governed coaches", async () => {
    currentCaller = {
      authenticated: true,
      isAdmin: false,
      memberCode: "CAP-C-1001",
      role: "coach",
      linkedCoachId: "coach-cap-c-1001",
    };
    currentAccessRole = null;

    const incremented = makeLedger({
      completedSessions: 3,
      checkins: [
        {
          sessionNumber: 3,
          dateAr: "اليوم",
          method: "qr_scan",
          verifiedByAr: "كابتن شريف",
          coachNoteAr: "تمرين",
          wasOffline: false,
          scannedAtIso: new Date().toISOString(),
        },
      ],
    });

    // Blocked when canScanGroupQr is false
    const blockedRes = await sessionLedgersRoute.POST(
      new Request("https://captenly.test/api/supabase/session-ledgers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ledger: incremented, expectedCompletedSessions: 2 }),
      })
    );
    assert.equal(blockedRes.status, 403);
    assert.equal((await blockedRes.json()).error, "coach_qr_scan_not_delegated");

    // Allowed once facility delegates canScanGroupQr: true
    const link = linkStore.get("link-coach-1")!;
    linkStore.set("link-coach-1", { ...link, canScanGroupQr: true });

    const allowedRes = await sessionLedgersRoute.POST(
      new Request("https://captenly.test/api/supabase/session-ledgers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ledger: incremented, expectedCompletedSessions: 2 }),
      })
    );
    assert.equal(allowedRes.status, 200);
    const allowedBody = (await allowedRes.json()) as { ok: boolean; ledger: SessionLedger };
    assert.equal(allowedBody.ok, true);
    assert.equal(allowedBody.ledger.completedSessions, 3);
    assert.equal(allowedBody.ledger.pinCode, "****");
  });
});
