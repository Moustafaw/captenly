import { expect, test } from "@playwright/test";

test.describe("Phase 3 F-019 & F-020 Verification (Headers, CORS, Health, Next 15.5.29 Compatibility)", () => {
  test("F-019: Security headers & CSP present on HTML/API, no wildcard ACAO, no HSTS on local HTTP, and /health hides internal counts from non-admins", async ({
    request,
    baseURL,
  }) => {
    const homeRes = await request.get("/");
    expect(homeRes.status()).toBe(200);
    const homeHeaders = homeRes.headers();
    expect(homeHeaders["content-security-policy"]).toContain("default-src 'self'");
    expect(homeHeaders["content-security-policy"]).toContain("https://maps.googleapis.com");
    expect(homeHeaders["content-security-policy"]).toContain("https://accounts.google.com");
    expect(homeHeaders["x-frame-options"]).toBe("DENY");
    expect(homeHeaders["x-content-type-options"]).toBe("nosniff");
    expect(homeHeaders["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(homeHeaders["permissions-policy"]).toContain("camera=(self)");
    expect(homeHeaders["permissions-policy"]).toContain("geolocation=(self)");
    expect(homeHeaders["access-control-allow-origin"]).not.toBe("*");
    expect(homeHeaders["strict-transport-security"]).toBeUndefined();

    // Unauthenticated /api/supabase/health must NOT leak counts, adminConfigured, or setup notes
    const healthPublic = await request.get("/api/supabase/health");
    expect(healthPublic.status()).toBe(200);
    const healthHeaders = healthPublic.headers();
    expect(healthHeaders["x-content-type-options"]).toBe("nosniff");
    expect(healthHeaders["access-control-allow-origin"]).not.toBe("*");
    const healthJson = await healthPublic.json();
    expect(healthJson.counts).toBeUndefined();
    expect(healthJson.adminConfigured).toBeUndefined();
    expect(healthJson.publicConfigured).toBeUndefined();
    expect(healthJson.note).toBeUndefined();
    expect(["healthy", "degraded", "unconfigured"]).toContain(healthJson.status);

    // Same-origin CORS works cleanly without wildcard *
    const sameOrigin = new URL(baseURL || "http://127.0.0.1:3199").origin;
    const sameOriginRes = await request.get("/api/auth/google-status", {
      headers: { Origin: sameOrigin },
    });
    expect(sameOriginRes.status()).toBe(200);
    expect(sameOriginRes.headers()["access-control-allow-origin"]).toBe(sameOrigin);
    expect(sameOriginRes.headers()["vary"]).toContain("Origin");

    // Untrusted external Origin on /api/* is blocked with 403 and no ACAO *
    const evilOriginRes = await request.get("/api/auth/google-status", {
      headers: { Origin: "https://evil-attacker.example" },
    });
    expect(evilOriginRes.status()).toBe(403);
    const evilJson = await evilOriginRes.json();
    expect(evilJson.error).toBe("forbidden_cors_origin");
    expect(evilOriginRes.headers()["access-control-allow-origin"]).toBeUndefined();

    const evilPreflight = await request.fetch("/api/supabase/public-supply", {
      method: "OPTIONS",
      headers: { Origin: "https://evil-attacker.example" },
    });
    expect(evilPreflight.status()).toBe(403);
  });

  test("F-020: Dynamic [slug], searchParams, redirects, SSR, cookies & auth endpoints work cleanly on Next.js 15.5.29", async ({
    page,
    request,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // 1. Dynamic /f/[slug] Server Component async params redirect -> /academy/[slug]
    const fRedirectRes = await request.get("/f/qa-blue-wave-aquatics", { maxRedirects: 0 });
    expect([307, 308, 302, 301]).toContain(fRedirectRes.status());
    expect(fRedirectRes.headers()["location"]).toContain("/academy/qa-blue-wave-aquatics");

    // 2. Dynamic /c/[slug] Client Component (useParams on React 18 + Next 15.5.29)
    await page.goto("/c/qa-karim-tarek", { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });
    expect(await page.locator("h1").count()).toBe(1);

    // 3. Dynamic /claim/[slug] & /claim?mode=coach (async params & searchParams)
    await page.goto("/claim/qa-blue-wave-aquatics", { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });

    await page.goto("/claim?mode=coach", { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });

    // 4. /explore?fallback=1 (async searchParams)
    await page.goto("/explore?fallback=1", { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });
    expect(await page.locator("h1").count()).toBe(1);

    // 5. Auth endpoints & cookies remain operational
    const googleStatus = await request.get("/api/auth/google-status");
    expect(googleStatus.status()).toBe(200);
    const gJson = await googleStatus.json();
    expect(gJson.previewAllowed).toBe(false);

    const adminVerify = await request.get("/api/auth/admin-verify");
    expect(adminVerify.status()).toBe(200);

    expect(pageErrors).toEqual([]);
  });
});
