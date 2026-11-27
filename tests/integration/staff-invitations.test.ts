import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { ServerCallerContext } from "@/lib/memberSession";

const mockModule = mock.module.bind(mock) as unknown as (
  specifier: string,
  opts: { exports: Record<string, unknown> }
) => void;

interface MockFacilityRow {
  id: string;
  payload: Record<string, unknown>;
}

let currentCaller: ServerCallerContext = { authenticated: false, isAdmin: false };
let dbAvailable = true;
const facilityStore = new Map<string, MockFacilityRow>();
const profileIdByQuery = new Map<string, string>();

mockModule("@/lib/memberSession", {
  exports: {
    getServerCaller: async () => currentCaller,
    sanitizeFilterToken: (raw: string) =>
      raw
        .replace(/[,()*%'"\\;\r\n]/g, "")
        .trim()
        .slice(0, 120),
  },
});

mockModule("@/lib/supabase/server", {
  exports: {
    getSupabaseAdminClient: () => {
      if (!dbAvailable) return null;
      return {
        from(table: string) {
          if (table === "captenly_facilities") {
            let eqId = "";
            return {
              select() {
                return {
                  eq(_col: string, val: string) {
                    eqId = val;
                    return {
                      async limit() {
                        const row = facilityStore.get(eqId);
                        return { data: row ? [row] : [], error: null };
                      },
                    };
                  },
                };
              },
              update(patch: { payload: Record<string, unknown> }) {
                return {
                  async eq(_col: string, val: string) {
                    if (!facilityStore.has(val)) {
                      return { error: { code: "PGRST116" } };
                    }
                    facilityStore.set(val, { id: val, payload: patch.payload });
                    return { error: null };
                  },
                };
              },
            };
          }
          if (table === "captenly_profiles") {
            let lookupVal = "";
            return {
              select() {
                return {
                  limit() {
                    return {
                      async eq(_col: string, val: string) {
                        lookupVal = val;
                        const id = profileIdByQuery.get(lookupVal.toLowerCase());
                        return { data: id ? [{ id }] : [], error: null };
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
    withPgClient: async () => ({ ok: false, errorCode: "missing_postgres_url" }),
  },
});

const { POST } = await import("@/app/api/supabase/staff-invitations/route");

function makePostRequest(body: unknown) {
  return new Request("https://captenly.test/api/supabase/staff-invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API integration: /api/supabase/staff-invitations", () => {
  beforeEach(() => {
    dbAvailable = true;
    facilityStore.clear();
    profileIdByQuery.clear();
    currentCaller = {
      authenticated: true,
      isAdmin: false,
      memberCode: "CAP-M-5001",
      role: "adult_athlete",
      email: "invitee@example.com",
    };

    facilityStore.set("fac-1", {
      id: "fac-1",
      payload: {
        id: "fac-1",
        nameAr: "أكاديمية النيل للسباحة",
        ownerMemberCode: "CAP-M-9999",
        staffMembers: [
          {
            id: "st-pending",
            facilityId: "fac-1",
            facilityNameAr: "أكاديمية النيل للسباحة",
            fullNameAr: "أحمد علي",
            role: "subscriptions_manager",
            roleTitleAr: "مسؤول الاشتراكات",
            hasAccount: true,
            linkedMemberCode: "CAP-M-5001",
            email: "invitee@example.com",
            isActive: true,
            invitationStatus: "pending",
            assignedDateAr: "دعوة معلقة",
          },
          {
            id: "st-accepted",
            facilityId: "fac-1",
            facilityNameAr: "أكاديمية النيل للسباحة",
            fullNameAr: "أحمد علي",
            role: "general_staff",
            roleTitleAr: "مشرف عام",
            hasAccount: true,
            linkedMemberCode: "CAP-M-5001",
            isActive: true,
            invitationStatus: "accepted",
            assignedDateAr: "مقبولة",
          },
          {
            id: "st-expired",
            facilityId: "fac-1",
            facilityNameAr: "أكاديمية النيل للسباحة",
            fullNameAr: "أحمد علي",
            role: "accounts_manager",
            roleTitleAr: "مسؤول الحسابات",
            hasAccount: true,
            linkedMemberCode: "CAP-M-5001",
            isActive: true,
            invitationStatus: "pending",
            expiresAtIso: "2020-01-01T00:00:00.000Z",
            assignedDateAr: "منتهية",
          },
          {
            id: "st-revoked",
            facilityId: "fac-1",
            facilityNameAr: "أكاديمية النيل للسباحة",
            fullNameAr: "أحمد علي",
            role: "accounts_manager",
            roleTitleAr: "مسؤول الحسابات",
            hasAccount: true,
            linkedMemberCode: "CAP-M-5001",
            isActive: false,
            invitationStatus: "revoked",
            assignedDateAr: "ملغاة",
          },
        ],
      },
    });
  });

  afterEach(() => {
    facilityStore.clear();
  });

  it("rejects unauthenticated callers with 401", async () => {
    currentCaller = { authenticated: false, isAdmin: false };
    const res = await POST(
      makePostRequest({ facilityId: "fac-1", staffId: "st-pending", decision: "accepted" })
    );
    assert.equal(res.status, 401);
  });

  it("returns 404 when facility or staff invitation is missing", async () => {
    const missingFac = await POST(
      makePostRequest({ facilityId: "fac-missing", staffId: "st-pending", decision: "accepted" })
    );
    assert.equal(missingFac.status, 404);
    assert.equal((await missingFac.json()).error, "facility_not_found");

    const missingInvite = await POST(
      makePostRequest({ facilityId: "fac-1", staffId: "st-none", decision: "accepted" })
    );
    assert.equal(missingInvite.status, 404);
    assert.equal((await missingInvite.json()).error, "invitation_not_found");
  });

  it("blocks wrong user with 403 forbidden_not_invitee", async () => {
    currentCaller = {
      authenticated: true,
      isAdmin: false,
      memberCode: "CAP-M-8888",
      role: "adult_athlete",
      email: "intruder@example.com",
    };
    const res = await POST(
      makePostRequest({ facilityId: "fac-1", staffId: "st-pending", decision: "accepted" })
    );
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, "forbidden_not_invitee");
  });

  it("returns 409 for already accepted/declined invitations and 410 for expired/revoked", async () => {
    const alreadyRes = await POST(
      makePostRequest({ facilityId: "fac-1", staffId: "st-accepted", decision: "accepted" })
    );
    assert.equal(alreadyRes.status, 409);
    assert.equal((await alreadyRes.json()).error, "already_responded");

    const expiredRes = await POST(
      makePostRequest({ facilityId: "fac-1", staffId: "st-expired", decision: "accepted" })
    );
    assert.equal(expiredRes.status, 410);
    assert.equal((await expiredRes.json()).error, "invitation_inactive");

    const revokedRes = await POST(
      makePostRequest({ facilityId: "fac-1", staffId: "st-revoked", decision: "declined" })
    );
    assert.equal(revokedRes.status, 410);
    assert.equal((await revokedRes.json()).error, "invitation_inactive");
  });

  it("accepts valid pending invitation, blocks role escalation, and persists cross-device state", async () => {
    const res = await POST(
      makePostRequest({
        facilityId: "fac-1",
        staffId: "st-pending",
        decision: "accepted",
        role: "owner", // attempted role escalation must be ignored
      })
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      persisted: boolean;
      invitationStatus: string;
      facility: { ownerMemberCode?: string; staffMembers: Array<Record<string, unknown>> };
    };
    assert.equal(body.ok, true);
    assert.equal(body.persisted, true);
    assert.equal(body.invitationStatus, "accepted");
    assert.equal(body.facility.ownerMemberCode, undefined);
    assert.equal(body.facility.staffMembers.length, 1);
    assert.equal(body.facility.staffMembers[0].role, "subscriptions_manager");
    assert.equal(body.facility.staffMembers[0].isActive, true);

    // Cross-device persistence check in store
    const stored = facilityStore.get("fac-1")?.payload.staffMembers as Array<Record<string, unknown>>;
    const updated = stored.find((s) => s.id === "st-pending");
    assert.equal(updated?.invitationStatus, "accepted");
    assert.equal(updated?.isActive, true);
    assert.equal(updated?.role, "subscriptions_manager");
  });

  it("declines valid pending invitation and persists declined status", async () => {
    const res = await POST(
      makePostRequest({
        facilityId: "fac-1",
        staffId: "st-pending",
        decision: "declined",
      })
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { invitationStatus: string };
    assert.equal(body.invitationStatus, "declined");

    const stored = facilityStore.get("fac-1")?.payload.staffMembers as Array<Record<string, unknown>>;
    assert.equal(stored.find((s) => s.id === "st-pending")?.invitationStatus, "declined");
  });
});
