import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  enforceRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/server/rateLimit";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
] as const;

let savedEnv: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;

describe("rateLimit: client IP, window limits, buckets & 429 response", () => {
  beforeEach(() => {
    savedEnv = {};
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it("extracts client IP safely from proxy headers and ignores spoofable host", () => {
    const req1 = new Request("https://captenly.test/api/test", {
      headers: {
        "x-forwarded-for": "197.55.12.34, 10.0.0.1",
        host: "evil.example.com",
      },
    });
    assert.equal(getClientIp(req1), "197.55.12.34");

    const req2 = new Request("https://captenly.test/api/test", {
      headers: { "x-real-ip": "41.33.10.9" },
    });
    assert.equal(getClientIp(req2), "41.33.10.9");

    const req3 = new Request("https://captenly.test/api/test", {
      headers: { host: "spoofed-host.local" },
    });
    assert.equal(getClientIp(req3), "unknown");
  });

  it("fails open cleanly with unconfigured_fail_open when no DB is configured", async () => {
    const res = await enforceRateLimit({
      bucket: "test:no-db",
      identifier: "1.2.3.4",
      limit: 5,
      windowSec: 60,
    });
    assert.equal(res.allowed, true);
    assert.equal(res.remaining, 5);
    assert.equal(res.retryAfterSec, 60);
    assert.equal(res.backend, "unconfigured_fail_open");
  });

  it("enforces fixed-window limits, isolates buckets, resets expired windows, and builds 429 response", async () => {
    const store = new Map<string, { key: string; hit_count: number; reset_at: string }>();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-supabase.local";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key";

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const method = (init?.method || "GET").toUpperCase();

      if (url.pathname.endsWith("/rest/v1/captenly_rate_limits") && method === "GET") {
        const keyFilter = url.searchParams.get("key") || "";
        const key = keyFilter.startsWith("eq.") ? keyFilter.slice(3) : keyFilter;
        const row = store.get(key);
        return new Response(JSON.stringify(row ? [row] : []), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname.endsWith("/rest/v1/captenly_rate_limits") && method === "POST") {
        const body = JSON.parse(String(init?.body || "{}")) as {
          key: string;
          hit_count: number;
          reset_at: string;
        };
        store.set(body.key, {
          key: body.key,
          hit_count: body.hit_count,
          reset_at: body.reset_at,
        });
        return new Response(JSON.stringify([body]), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 404 });
    }) as typeof fetch;

    // 1. Bucket A allows up to limit=2 and blocks on 3rd call
    const r1 = await enforceRateLimit({
      bucket: "pin_checkin",
      identifier: "CAP-M-100:fac-1",
      limit: 2,
      windowSec: 300,
    });
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 1);
    assert.equal(r1.backend, "supabase_rest");

    const r2 = await enforceRateLimit({
      bucket: "pin_checkin",
      identifier: "CAP-M-100:fac-1",
      limit: 2,
      windowSec: 300,
    });
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 0);

    const r3 = await enforceRateLimit({
      bucket: "pin_checkin",
      identifier: "CAP-M-100:fac-1",
      limit: 2,
      windowSec: 300,
    });
    assert.equal(r3.allowed, false);
    assert.equal(r3.remaining, 0);
    assert.ok(r3.retryAfterSec >= 1);

    // 2. Separate bucket stays independent
    const otherBucket = await enforceRateLimit({
      bucket: "otp_request",
      identifier: "CAP-M-100:fac-1",
      limit: 2,
      windowSec: 300,
    });
    assert.equal(otherBucket.allowed, true);
    assert.equal(otherBucket.remaining, 1);

    // 3. Expired window resets counter to 1
    const bucketKey = "pin_checkin:CAP-M-100:fac-1";
    store.set(bucketKey, {
      key: bucketKey,
      hit_count: 99,
      reset_at: new Date(Date.now() - 5_000).toISOString(),
    });
    const afterExpiry = await enforceRateLimit({
      bucket: "pin_checkin",
      identifier: "CAP-M-100:fac-1",
      limit: 2,
      windowSec: 300,
    });
    assert.equal(afterExpiry.allowed, true);
    assert.equal(afterExpiry.remaining, 1);

    // 4. 429 helper response format & headers
    const resp = rateLimitExceededResponse(r3.retryAfterSec);
    assert.equal(resp.status, 429);
    assert.equal(resp.headers.get("Retry-After"), String(r3.retryAfterSec));
    assert.equal(resp.headers.get("X-RateLimit-Remaining"), "0");
    assert.equal(resp.headers.get("Cache-Control"), "no-store, max-age=0");
    const payload = (await resp.json()) as { error: string; retryAfterSec: number };
    assert.equal(payload.error, "rate_limited");
    assert.equal(payload.retryAfterSec, r3.retryAfterSec);
  });
});
