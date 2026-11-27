import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";

const ENV_KEYS = [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "AUTH_SECRET",
  "CAPTENLY_OTP_SECRET",
] as const;

let savedEnv: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;

interface MockProfileRow {
  id: string;
  member_code: string;
  email: string | null;
  phone: string | null;
  full_name_ar: string;
  role: string;
  otp_code_hash: string | null;
  otp_expires_at: string | null;
}

const profileStore = new Map<string, MockProfileRow>();

const mockModule = mock.module.bind(mock) as unknown as (
  specifier: string,
  opts: { exports: Record<string, unknown> }
) => void;

mockModule("@/lib/supabase/server", {
  exports: {
    getSupabaseAdminClient: () => ({
      from(table: string) {
        if (table !== "captenly_profiles") return {};
        return {
          select() {
            return {
              limit() {
                return {
                  eq(_col: string, val: string) {
                    const row = Array.from(profileStore.values()).find(
                      (p) =>
                        p.email?.toLowerCase() === val.toLowerCase() ||
                        p.member_code.toUpperCase() === val.toUpperCase()
                    );
                    return Promise.resolve({ data: row ? [row] : [], error: null });
                  },
                  ilike(_col: string, val: string) {
                    const needle = val.replace(/%/g, "");
                    const row = Array.from(profileStore.values()).find((p) =>
                      (p.phone || "").endsWith(needle)
                    );
                    return Promise.resolve({ data: row ? [row] : [], error: null });
                  },
                };
              },
            };
          },
          update(patch: { otp_code_hash: string | null; otp_expires_at: string | null }) {
            return {
              async eq(_col: string, val: string) {
                const row = profileStore.get(val.toUpperCase());
                if (!row) return { error: { code: "PGRST116" } };
                row.otp_code_hash = patch.otp_code_hash;
                row.otp_expires_at = patch.otp_expires_at;
                return { error: null };
              },
            };
          },
        };
      },
    }),
  },
});

mockModule("@/lib/supabase/pgFallback", {
  exports: {
    withPgClient: async () => ({ ok: false, errorCode: "missing_postgres_url" }),
  },
});

mockModule("@/auth", {
  exports: {
    getAuthInstance: () => null,
  },
});

mockModule("@/lib/memberSession", {
  exports: {
    attachMemberSessionCookie: (res: Response) => res,
    clearMemberSessionCookie: (res: Response) => res,
    getServerCaller: async () => ({ authenticated: false, isAdmin: false }),
  },
});

mockModule("@/lib/server/coachDb", {
  exports: {
    deleteCoachByMemberOrIdInDb: async () => {},
    ensureSelfRegisteredCoachInDb: async () => {},
  },
});

mockModule("@/lib/server/accountPurge", {
  exports: {
    OWNER_EMAIL: "",
    purgeNonOwnerAccountsInDb: async () => ({ ok: false, purgedProfiles: 0 }),
  },
});

mockModule("@/lib/server/rateLimit", {
  exports: {
    enforceRateLimit: async () => ({
      allowed: true,
      remaining: 25,
      retryAfterSec: 60,
      backend: "unconfigured_fail_open",
    }),
    getClientIp: () => "127.0.0.1",
    rateLimitExceededResponse: () => new Response(null, { status: 429 }),
  },
});

const { POST } = await import("@/app/api/auth/member-auth/route");

function makeOtpRequest(query: string) {
  return new Request("https://captenly.test/api/auth/member-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "request_otp", query }),
  });
}

function captureConsole() {
  const logs: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  const push = (...args: unknown[]) => logs.push(args.map((a) => String(a)).join(" "));
  console.log = push;
  console.warn = push;
  console.error = push;
  return {
    logs,
    restore() {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origErr;
    },
  };
}

describe("API integration: /api/auth/member-auth request_otp delivery", () => {
  beforeEach(() => {
    savedEnv = {};
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
    process.env.AUTH_SECRET = "otp-test-secret-32-chars-minimum!";

    profileStore.clear();
    profileStore.set("CAP-M-6001", {
      id: "prof-6001",
      member_code: "CAP-M-6001",
      email: "swimmer@example.com",
      phone: "01012345678",
      full_name_ar: "يوسف طارق",
      role: "adult_athlete",
      otp_code_hash: null,
      otp_expires_at: null,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it("delivers OTP via Resend email, stores HMAC hash, and leaks no OTP or secrets", async () => {
    process.env.RESEND_API_KEY = "re_test_secret_key_xyz";
    let sentOtp = "";
    const cap = captureConsole();

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(url), "https://api.resend.com/emails");
      const payload = JSON.parse(String(init?.body || "{}")) as { html: string; to: string[] };
      assert.deepEqual(payload.to, ["swimmer@example.com"]);
      const m = payload.html.match(/>(\d{6})</);
      sentOtp = m?.[1] || "";
      assert.match(sentOtp, /^\d{6}$/);
      return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
    }) as typeof fetch;

    try {
      const res = await POST(makeOtpRequest("swimmer@example.com"));
      assert.equal(res.status, 200);
      const text = await res.text();
      const body = JSON.parse(text) as { ok: boolean; channel: string };
      assert.equal(body.ok, true);
      assert.equal(body.channel, "email");

      // Stored hash is 64-char hex HMAC, never raw OTP
      const stored = profileStore.get("CAP-M-6001")!;
      assert.match(stored.otp_code_hash || "", /^[a-f0-9]{64}$/);
      assert.notEqual(stored.otp_code_hash, sentOtp);

      // No OTP or secret in response or logs
      const allOutput = `${text}\n${cap.logs.join("\n")}`;
      assert.equal(allOutput.includes(sentOtp), false);
      assert.equal(allOutput.includes("re_test_secret_key_xyz"), false);
    } finally {
      cap.restore();
    }
  });

  it("falls back to Twilio SMS when Resend fails, hiding OTP and Twilio credentials", async () => {
    process.env.RESEND_API_KEY = "re_test_secret_key_xyz";
    process.env.TWILIO_ACCOUNT_SID = "AC_test_sid_999";
    process.env.TWILIO_AUTH_TOKEN = "twilio_secret_token_999";
    process.env.TWILIO_FROM_NUMBER = "+201000000000";

    let smsOtp = "";
    const cap = captureConsole();

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target.includes("api.resend.com")) {
        return new Response(JSON.stringify({ error: "resend_down" }), { status: 500 });
      }
      if (target.includes("api.twilio.com")) {
        const params = new URLSearchParams(String(init?.body || ""));
        assert.equal(params.get("To"), "+201012345678");
        const m = (params.get("Body") || "").match(/(\d{6})/);
        smsOtp = m?.[1] || "";
        assert.match(smsOtp, /^\d{6}$/);
        return new Response(JSON.stringify({ sid: "SM123" }), { status: 201 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const res = await POST(makeOtpRequest("swimmer@example.com"));
      assert.equal(res.status, 200);
      const text = await res.text();
      const body = JSON.parse(text) as { ok: boolean; channel: string };
      assert.equal(body.ok, true);
      assert.equal(body.channel, "sms");

      const allOutput = `${text}\n${cap.logs.join("\n")}`;
      assert.equal(allOutput.includes(smsOtp), false);
      assert.equal(allOutput.includes("twilio_secret_token_999"), false);
      assert.equal(allOutput.includes("re_test_secret_key_xyz"), false);
    } finally {
      cap.restore();
    }
  });

  it("returns 503 deliveryUnavailable on provider timeout/failure and on missing provider config", async () => {
    // 1. Missing config
    const noCfgRes = await POST(makeOtpRequest("swimmer@example.com"));
    assert.equal(noCfgRes.status, 503);
    const noCfgBody = (await noCfgRes.json()) as {
      ok: boolean;
      deliveryUnavailable: boolean;
      hasGoogleOption: boolean;
    };
    assert.equal(noCfgBody.ok, false);
    assert.equal(noCfgBody.deliveryUnavailable, true);
    assert.equal(noCfgBody.hasGoogleOption, true);

    // 2. Timeout / network abort on configured provider
    process.env.RESEND_API_KEY = "re_timeout_secret";
    const cap = captureConsole();
    globalThis.fetch = (async () => {
      const err = new Error("Request aborted");
      err.name = "AbortError";
      throw err;
    }) as typeof fetch;

    try {
      const timeoutRes = await POST(makeOtpRequest("swimmer@example.com"));
      assert.equal(timeoutRes.status, 503);
      const text = await timeoutRes.text();
      const body = JSON.parse(text) as { ok: boolean; deliveryUnavailable: boolean };
      assert.equal(body.ok, false);
      assert.equal(body.deliveryUnavailable, true);
      assert.equal(`${text}\n${cap.logs.join("\n")}`.includes("re_timeout_secret"), false);
    } finally {
      cap.restore();
    }
  });
});
