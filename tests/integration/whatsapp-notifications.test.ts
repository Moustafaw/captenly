import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import type { FacilityAccessRole } from "@/lib/facilityPermissions";
import type { ServerCallerContext } from "@/lib/memberSession";

const ENV_KEYS = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_MODE",
  "CRON_SECRET",
] as const;

let savedEnv: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;

let caller: ServerCallerContext = { authenticated: false, isAdmin: false };
let accessRole: FacilityAccessRole | null = null;
let authorizedFacilities = new Set<string>();

const dispatchStore = new Map<string, Record<string, unknown>>();
const notifStore: Record<string, unknown>[] = [];
const newsletterStore = new Map<string, Record<string, unknown>>();
const prefStore = new Map<string, Record<string, unknown>>();
const profileStore = new Map<string, Record<string, unknown>>();
const ledgerStore = new Map<string, Record<string, unknown>>();

const mockModule = mock.module.bind(mock) as unknown as (
  specifier: string,
  opts: { exports: Record<string, unknown> }
) => void;

mockModule("@/lib/memberSession", {
  exports: {
    getServerCaller: async () => caller,
    getCallerFacilityAccessRole: async () => accessRole,
    getCallerAuthorizedFacilityIds: async () => new Set(authorizedFacilities),
  },
});

mockModule("@/lib/coachProvisioning", {
  exports: {
    getDeterministicCoachId: (code: string) => `coach-${code}`,
  },
});

mockModule("@/lib/server/rateLimit", {
  exports: {
    getClientIp: () => "127.0.0.1",
    enforceRateLimit: async () => ({
      allowed: true,
      remaining: 20,
      retryAfterSec: 60,
      backend: "supabase_rest",
    }),
    rateLimitExceededResponse: (retryAfterSec: number) =>
      new Response(JSON.stringify({ ok: false, error: "rate_limited", retryAfterSec }), { status: 429 }),
  },
});

mockModule("@/lib/supabase/pgFallback", {
  exports: {
    withPgClient: async () => ({ ok: false, errorCode: "disabled_in_mock_test" }),
  },
});

mockModule("@/lib/supabase/server", {
  exports: {
    getSupabaseAdminClient: () => ({
      from(table: string) {
        if (table === "captenly_whatsapp_dispatches") {
          return {
            select() {
              const filters: Record<string, unknown> = {};
              let ltAttempt: number | null = null;
              const chain: Record<string, unknown> = {
                eq(col: string, val: unknown) {
                  filters[col] = val;
                  return chain;
                },
                ilike(col: string, val: string) {
                  filters[`ilike:${col}`] = val.toUpperCase();
                  return chain;
                },
                lt(_col: string, val: number) {
                  ltAttempt = val;
                  return chain;
                },
                or() {
                  return chain;
                },
                order() {
                  return chain;
                },
                limit() {
                  return Promise.resolve({
                    data: Array.from(dispatchStore.values()).filter((r) => {
                      if (filters.delivery_status && r.delivery_status !== filters.delivery_status) return false;
                      if (filters.facility_id && r.facility_id !== filters.facility_id) return false;
                      if (filters["ilike:recipient_member_code"]) {
                        if (String(r.recipient_member_code || "").toUpperCase() !== filters["ilike:recipient_member_code"]) {
                          return false;
                        }
                      }
                      if (ltAttempt !== null && Number(r.attempt_count || 0) >= ltAttempt) return false;
                      return true;
                    }),
                    error: null,
                  });
                },
                async maybeSingle() {
                  const key = String(filters.dedupe_key || "");
                  return { data: dispatchStore.get(key) || null, error: null };
                },
              };
              return chain;
            },
            upsert(row: Record<string, unknown>) {
              const saved = { id: `wa-${dispatchStore.size + 1}`, created_at: new Date().toISOString(), ...row };
              dispatchStore.set(String(row.dedupe_key), saved);
              return {
                select() {
                  return {
                    async maybeSingle() {
                      return { data: saved, error: null };
                    },
                  };
                },
              };
            },
            update(patch: Record<string, unknown>) {
              return {
                async eq(col: string, val: unknown) {
                  if (col === "provider_message_id") {
                    for (const [k, row] of dispatchStore.entries()) {
                      if (row.provider_message_id === val) {
                        dispatchStore.set(k, { ...row, ...patch });
                      }
                    }
                  }
                  return { error: null };
                },
              };
            },
          };
        }

        if (table === "captenly_user_prefs") {
          return {
            select() {
              let memberCode = "";
              const chain: Record<string, unknown> = {
                ilike(_c: string, v: string) {
                  memberCode = v.toUpperCase();
                  return chain;
                },
                async maybeSingle() {
                  return { data: prefStore.get(memberCode) || null, error: null };
                },
              };
              return chain;
            },
          };
        }

        if (table === "captenly_profiles") {
          return {
            select() {
              let memberCode = "";
              const chain: Record<string, unknown> = {
                ilike(_c: string, v: string) {
                  memberCode = v.toUpperCase();
                  return chain;
                },
                async maybeSingle() {
                  return { data: profileStore.get(memberCode) || null, error: null };
                },
              };
              return chain;
            },
          };
        }

        if (table === "captenly_notifications") {
          return {
            async insert(row: Record<string, unknown>) {
              notifStore.push(row);
              return { error: null };
            },
          };
        }

        if (table === "captenly_session_ledgers") {
          return {
            select() {
              let eqId = "";
              const chain: Record<string, unknown> = {
                eq(_c: string, v: string) {
                  eqId = v;
                  return chain;
                },
                in() {
                  return chain;
                },
                order() {
                  return chain;
                },
                async limit() {
                  return { data: Array.from(ledgerStore.values()), error: null };
                },
                async maybeSingle() {
                  return { data: ledgerStore.get(eqId) || null, error: null };
                },
              };
              return chain;
            },
          };
        }

        if (table === "captenly_newsletter_subscribers") {
          return {
            async upsert(row: Record<string, unknown>) {
              newsletterStore.set(String(row.email), row);
              return { error: null };
            },
          };
        }

        return {};
      },
    }),
  },
});

const whatsappApi = await import("@/app/api/notifications/whatsapp/route");
const webhookApi = await import("@/app/api/whatsapp/webhook/route");
const cronApi = await import("@/app/api/cron/whatsapp-reminders/route");
const newsletterApi = await import("@/app/api/supabase/newsletter/route");

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  caller = { authenticated: false, isAdmin: false };
  accessRole = null;
  authorizedFacilities = new Set();
  dispatchStore.clear();
  notifStore.length = 0;
  newsletterStore.clear();
  prefStore.clear();
  profileStore.clear();
  ledgerStore.clear();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  globalThis.fetch = originalFetch;
});

describe("WhatsApp APIs, Webhook, Cron & Newsletter contracts", () => {
  it("enforces authentication (401) and cross-facility authorization (403)", async () => {
    const res401 = await whatsappApi.GET(new Request("http://localhost/api/notifications/whatsapp"));
    assert.equal(res401.status, 401);

    caller = { authenticated: true, isAdmin: false, memberCode: "CAP-M-2002" };
    authorizedFacilities = new Set(["fac-1"]);
    const res403 = await whatsappApi.GET(
      new Request("http://localhost/api/notifications/whatsapp?facilityId=fac-other")
    );
    assert.equal(res403.status, 403);
  });

  it("logs unconfigured status cleanly, respects opt-out preferences, delivers via Meta API, and deduplicates", async () => {
    ledgerStore.set("led-1", {
      id: "led-1",
      facility_id: "fac-1",
      coach_id: "coach-1",
      member_code: "CAP-M-1001",
      athlete_name_ar: "يوسف طارق",
      total_sessions: 8,
      completed_sessions: 6,
      status: "renewal_due",
      payload: {
        id: "led-1",
        facilityId: "fac-1",
        facilityNameAr: "نادي الموج",
        memberCode: "CAP-M-1001",
        athleteNameAr: "يوسف طارق",
        parentPhone: "01012345678",
        totalSessions: 8,
        completedSessions: 6,
        scheduleDaysAr: "السبت والجمعة والأحد والاثنين والثلاثاء والأربعاء والخميس",
      },
    });

    caller = { authenticated: true, isAdmin: false, memberCode: "CAP-M-FAC", linkedFacilityId: "fac-1" };
    accessRole = "owner";
    authorizedFacilities = new Set(["fac-1"]);

    // 1) Missing Meta keys -> honest provider_unconfigured status
    const unconfRes = await whatsappApi.POST(
      new Request("http://localhost/api/notifications/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_absence_alert", ledgerId: "led-1" }),
      })
    );
    const unconfJson = await unconfRes.json();
    assert.equal(unconfJson.deliveryStatus, "provider_unconfigured");
    assert.equal(unconfJson.ok, false);
    assert.equal(notifStore.length, 1);

    // 2) Configure Meta keys & opt-out preference -> skipped_opt_out
    process.env.WHATSAPP_ACCESS_TOKEN = "meta-test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    prefStore.set("CAP-M-1001", { user_settings: { notifyWhatsappSessions: false } });
    const optOutRes = await whatsappApi.POST(
      new Request("http://localhost/api/notifications/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_absence_alert", ledgerId: "led-1" }),
      })
    );
    const optOutJson = await optOutRes.json();
    assert.equal(optOutJson.deliveryStatus, "skipped_opt_out");

    // 3) Re-enable preference and trigger session_reminder -> Meta Graph API 200 -> sent + deduped on replay
    prefStore.set("CAP-M-1001", { user_settings: { notifyWhatsappSessions: true, notifyWhatsappRenewals: true } });
    let metaCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes("graph.facebook.com")) {
        metaCalls += 1;
        return new Response(JSON.stringify({ messages: [{ id: "wamid.mock.123" }] }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const sentRes = await whatsappApi.POST(
      new Request("http://localhost/api/notifications/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_session_reminder", ledgerId: "led-1" }),
      })
    );
    const sentJson = await sentRes.json();
    assert.equal(sentJson.ok, true);
    assert.equal(sentJson.deliveryStatus, "sent");
    assert.equal(sentJson.providerMessageId, "wamid.mock.123");
    assert.equal(metaCalls, 1);

    // Duplicate prevention on same day
    const replayRes = await whatsappApi.POST(
      new Request("http://localhost/api/notifications/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_session_reminder", ledgerId: "led-1" }),
      })
    );
    const replayJson = await replayRes.json();
    assert.equal(replayJson.deduplicated, true);
    assert.equal(metaCalls, 1);

    // 4) Meta Webhook GET challenge + POST delivered update
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "captenly-verify-secret";
    process.env.WHATSAPP_APP_SECRET = "meta-app-secret";
    const challengeRes = await webhookApi.GET(
      new Request(
        "http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=captenly-verify-secret&hub.challenge=98765"
      )
    );
    assert.equal(challengeRes.status, 200);
    assert.equal(await challengeRes.text(), "98765");

    const webhookBody = JSON.stringify({
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.mock.123", status: "delivered" }] } }] }],
    });
    const sig = `sha256=${crypto.createHmac("sha256", "meta-app-secret").update(webhookBody).digest("hex")}`;
    const postWebhook = await webhookApi.POST(
      new Request("http://localhost/api/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-signature-256": sig },
        body: webhookBody,
      })
    );
    assert.equal(postWebhook.status, 200);
    const updatedDispatch = Array.from(dispatchStore.values()).find(
      (d) => d.provider_message_id === "wamid.mock.123"
    );
    assert.equal(updatedDispatch?.delivery_status, "delivered");
  });

  it("secures cron endpoint and triggers expiry reminder scan + persists newsletter emails", async () => {
    process.env.CRON_SECRET = "cron-top-secret";
    const unauthCron = await cronApi.GET(new Request("http://localhost/api/cron/whatsapp-reminders"));
    assert.equal(unauthCron.status, 401);

    ledgerStore.set("led-exp", {
      id: "led-exp",
      facility_id: "fac-1",
      member_code: "CAP-M-9009",
      athlete_name_ar: "زياد عمرو",
      total_sessions: 8,
      completed_sessions: 7,
      status: "renewal_due",
      payload: {
        id: "led-exp",
        facilityId: "fac-1",
        facilityNameAr: "أكاديمية الدلتا",
        memberCode: "CAP-M-9009",
        athleteNameAr: "زياد عمرو",
        parentPhone: "01099887766",
        totalSessions: 8,
        completedSessions: 7,
      },
    });

    const authCron = await cronApi.GET(
      new Request("http://localhost/api/cron/whatsapp-reminders", {
        headers: { Authorization: "Bearer cron-top-secret" },
      })
    );
    assert.equal(authCron.status, 200);
    const cronJson = await authCron.json();
    assert.equal(cronJson.scanned, 1);
    assert.equal(cronJson.expiryRemindersTriggered, 1);

    const newsRes = await newsletterApi.POST(
      new Request("http://localhost/api/supabase/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "Swimmer@Example.com", source: "magazine" }),
      })
    );
    assert.equal(newsRes.status, 200);
    const newsJson = await newsRes.json();
    assert.equal(newsJson.ok, true);
    assert.equal(newsJson.persisted, true);
    assert.ok(newsletterStore.has("swimmer@example.com"));
  });
});
