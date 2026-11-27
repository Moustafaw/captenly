import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import workAsyncStorageMod from "next/dist/server/app-render/work-async-storage.external.js";
import workUnitAsyncStorageMod from "next/dist/server/app-render/work-unit-async-storage.external.js";

const { workAsyncStorage } = workAsyncStorageMod;
const { workUnitAsyncStorage } = workUnitAsyncStorageMod;
import {
  ADMIN_COOKIE_NAME,
  attachMemberSessionCookie,
  buildMemberSessionCookieValue,
  clearMemberSessionCookie,
  getServerCaller,
  MEMBER_COOKIE_NAME,
  sanitizeFilterToken,
} from "@/lib/memberSession";

const ENV_KEYS = [
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "CAPTENLY_ADMIN_KEY",
  "CAPTENLY_ADMIN_EMAILS",
  "NODE_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "POSTGRES_URL",
  "DATABASE_URL",
] as const;

let savedEnv: Record<string, string | undefined> = {};

function runWithRequestCookies<T>(cookiePairs: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const cookieHeader = Object.entries(cookiePairs)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  const headers = new Headers(cookieHeader ? { cookie: cookieHeader } : {});
  const reqCookies = new NextRequest("https://captenly.test/api/test", { headers }).cookies;
  const workStore = {
    route: "/api/test",
    forceStatic: false,
    dynamicShouldError: false,
  } as unknown as Parameters<typeof workAsyncStorage.run>[0];
  const workUnitStore = {
    type: "request",
    phase: "render",
    cookies: reqCookies,
    mutableCookies: reqCookies,
    userspaceMutableCookies: reqCookies,
    headers,
    implicitTags: { tags: [], expirable: false },
  } as unknown as Parameters<typeof workUnitAsyncStorage.run>[0];

  return workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(workUnitStore, fn)
  );
}

describe("memberSession: HMAC signing, verification, expiry & sanitization", () => {
  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.AUTH_SECRET = "unit-test-auth-secret-32-chars-min!!";
  });

  afterEach(() => {
    const env = process.env as Record<string, string | undefined>;
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete env[key];
      else env[key] = savedEnv[key];
    }
  });

  it("signs valid HMAC-SHA256 member tokens and normalizes memberCode/email", async () => {
    const token = buildMemberSessionCookieValue({
      memberCode: " cap-m-4040 ",
      role: "adult_athlete",
      email: " Swimmer@Example.COM ",
      linkedFacilityId: " fac-1 ",
    });

    const [encoded, sig] = token.split(".");
    assert.ok(encoded && sig);
    const expectedSig = crypto
      .createHmac("sha256", process.env.AUTH_SECRET!)
      .update(encoded)
      .digest("hex");
    assert.equal(sig, expectedSig);

    const caller = await runWithRequestCookies({ [MEMBER_COOKIE_NAME]: token }, () =>
      getServerCaller()
    );
    assert.equal(caller.authenticated, true);
    assert.equal(caller.isAdmin, false);
    assert.equal(caller.memberCode, "CAP-M-4040");
    assert.equal(caller.email, "swimmer@example.com");
    assert.equal(caller.linkedFacilityId, "fac-1");
  });

  it("rejects tampered payloads, invalid signatures, malformed tokens, and expired tokens", async () => {
    const valid = buildMemberSessionCookieValue({
      memberCode: "CAP-M-1234",
      role: "coach",
    });
    const [encoded, sig] = valid.split(".");

    // Tampered payload
    const forgedPayload = Buffer.from(
      JSON.stringify({ memberCode: "CAP-M-9999", role: "super_admin", exp: Date.now() + 60_000 })
    ).toString("base64url");
    const tamperedPayloadCaller = await runWithRequestCookies(
      { [MEMBER_COOKIE_NAME]: `${forgedPayload}.${sig}` },
      () => getServerCaller()
    );
    assert.equal(tamperedPayloadCaller.authenticated, false);

    // Tampered signature
    const badSig = `${sig.slice(0, -1)}${sig.endsWith("0") ? "1" : "0"}`;
    const tamperedSigCaller = await runWithRequestCookies(
      { [MEMBER_COOKIE_NAME]: `${encoded}.${badSig}` },
      () => getServerCaller()
    );
    assert.equal(tamperedSigCaller.authenticated, false);

    // Malformed token
    const malformedCaller = await runWithRequestCookies(
      { [MEMBER_COOKIE_NAME]: "not-a-valid-token" },
      () => getServerCaller()
    );
    assert.equal(malformedCaller.authenticated, false);

    // Expired token signed with real secret
    const expiredPayload = Buffer.from(
      JSON.stringify({ memberCode: "CAP-M-1234", role: "adult_athlete", exp: Date.now() - 5_000 })
    ).toString("base64url");
    const expiredSig = crypto
      .createHmac("sha256", process.env.AUTH_SECRET!)
      .update(expiredPayload)
      .digest("hex");
    const expiredCaller = await runWithRequestCookies(
      { [MEMBER_COOKIE_NAME]: `${expiredPayload}.${expiredSig}` },
      () => getServerCaller()
    );
    assert.equal(expiredCaller.authenticated, false);
  });

  it("verifies signed admin cookie when CAPTENLY_ADMIN_KEY is configured", async () => {
    process.env.CAPTENLY_ADMIN_KEY = "admin-key-secret";
    const exp = Date.now() + 60_000;
    const sig = crypto
      .createHmac("sha256", process.env.AUTH_SECRET!)
      .update(`admin:${exp}`)
      .digest("hex");

    const adminCaller = await runWithRequestCookies(
      { [ADMIN_COOKIE_NAME]: `${exp}.${sig}` },
      () => getServerCaller()
    );
    assert.equal(adminCaller.authenticated, true);
    assert.equal(adminCaller.isAdmin, true);
    assert.equal(adminCaller.role, "super_admin");
  });

  it("fails closed in production when signing secret is missing", () => {
    const env = process.env as Record<string, string | undefined>;
    delete env.AUTH_SECRET;
    env.NODE_ENV = "production";

    assert.throws(
      () =>
        buildMemberSessionCookieValue({
          memberCode: "CAP-M-5555",
          role: "adult_athlete",
        }),
      /AUTH_SECRET_MISSING_IN_PRODUCTION/
    );

    const res = attachMemberSessionCookie(NextResponse.json({ ok: true }), {
      memberCode: "CAP-M-5555",
      role: "adult_athlete",
    });
    assert.equal(res.status, 503);
  });

  it("attaches and clears cookies and sanitizes filter tokens", () => {
    const res = NextResponse.json({ ok: true });
    attachMemberSessionCookie(res, {
      memberCode: "cap-m-7777",
      role: "parent",
    });
    const setCookie = res.cookies.get(MEMBER_COOKIE_NAME);
    assert.ok(setCookie?.value.includes("."));

    clearMemberSessionCookie(res);
    const cleared = res.cookies.get(MEMBER_COOKIE_NAME);
    assert.equal(cleared?.value, "");

    assert.equal(
      sanitizeFilterToken(" CAP-M-1234,or(id.eq.1);'\"\\*\r\n "),
      "CAP-M-1234orid.eq.1"
    );
    assert.equal(sanitizeFilterToken("A".repeat(200)).length, 120);
  });
});
