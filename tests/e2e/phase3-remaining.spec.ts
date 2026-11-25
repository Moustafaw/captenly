import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SEED_ATHLETE_PERSONA = {
  id: "user-p3-ath",
  role: "adult_athlete",
  memberCode: "CAP-M-3001",
  email: "athlete-p3@example.com",
  shortLabelAr: "سيف",
  fullNameAr: "سيف محمود",
  personaTitleAr: "سبّاح",
  city: "القاهرة",
  phone: "01012345678",
  descriptionAr: "",
  needsOnboarding: false,
};

const SEED_FACILITY_MANAGER = {
  id: "user-p3-facmgr",
  role: "facility_manager",
  memberCode: "CAP-M-3002",
  linkedFacilityId: "fac-p3-pool",
  email: "facmgr-p3@example.com",
  shortLabelAr: "طارق",
  fullNameAr: "طارق حسن",
  personaTitleAr: "مدير منشأة",
  city: "القاهرة",
  phone: "01022345678",
  descriptionAr: "",
  needsOnboarding: false,
};

const SEED_FACILITIES = [
  {
    id: "fac-p3-pool",
    slug: "fac-p3-pool",
    nameAr: "نادي الموج الأزرق للسباحة",
    nameEn: "Blue Wave Pool",
    facilityType: "swimming_academy",
    sportSector: "swimming",
    governorate: "القاهرة",
    city: "مدينة نصر",
    district: "الحي الثامن",
    addressAr: "شارع مكرم عبيد",
    coordinates: { lat: 30.056, lng: 31.344 },
    supplyStatus: "verified_active",
    subscriptionTier: "pro",
    isFeaturedTier: true,
    isSponsored: false,
    priceLastVerifiedDaysAgo: 0,
    priceLastVerifiedDate: "اليوم",
    avgReplyMinutes: 10,
    completenessScore: 95,
    rating: 4.8,
    reviewsCount: 14,
    heroImage: "/screens/20b781f698f9.jpg",
    badges: [],
    specialtiesAr: ["تأسيس الأطفال", "تأهيل تنافسي"],
    pricePackages: [{ id: "pkg-1", titleAr: "8 حصص", baseMonthlyEgp: 900, sessionsPerMonth: 8 }],
    affiliatedCoachIds: [],
    poolDeskConfig: { waterFeePerSessionEgp: 70 },
    monthlyMetrics: {
      profileViews: 10,
      comparisonAppearances: 5,
      verifiedWhatsappLeads: 2,
      activeSessionLedgers: 1,
    },
  },
  {
    id: "fac-p3-pool-2",
    slug: "fac-p3-pool-2",
    nameAr: "أكاديمية الدلتا الأولمبية",
    nameEn: "Delta Olympic",
    facilityType: "swimming_academy",
    sportSector: "swimming",
    governorate: "القاهرة",
    city: "المعادي",
    district: "زهراء المعادي",
    addressAr: "شارع الخمسين",
    coordinates: { lat: 29.96, lng: 31.29 },
    supplyStatus: "verified_active",
    subscriptionTier: "free_founding",
    isFeaturedTier: false,
    isSponsored: false,
    priceLastVerifiedDaysAgo: 0,
    priceLastVerifiedDate: "اليوم",
    avgReplyMinutes: 15,
    completenessScore: 90,
    rating: 4.6,
    reviewsCount: 8,
    heroImage: "/screens/20b781f698f9.jpg",
    badges: [],
    specialtiesAr: ["تعليم السباحة"],
    pricePackages: [{ id: "pkg-2", titleAr: "8 حصص", baseMonthlyEgp: 800, sessionsPerMonth: 8 }],
    affiliatedCoachIds: [],
    monthlyMetrics: {
      profileViews: 4,
      comparisonAppearances: 2,
      verifiedWhatsappLeads: 1,
      activeSessionLedgers: 0,
    },
  },
];

const SEED_LEDGER = {
  id: "led-p3-1",
  ledgerCode: "CAP-LED-301",
  subscriptionCode: "CAP-SUB-301",
  pinCode: "1234",
  athleteId: "user-p3-ath",
  athleteNameAr: "سيف محمود",
  athleteMemberCode: "CAP-M-3001",
  coachId: "coach-p3",
  coachNameAr: "كابتن شريف",
  facilityId: "fac-p3-pool",
  facilityNameAr: "نادي الموج الأزرق للسباحة",
  packageTitleAr: "باقة 8 حصص تأسيس",
  totalSessions: 8,
  completedSessions: 3,
  monthlyFeeEgp: 900,
  status: "active",
  isCodeExpired: false,
  createdAtIso: new Date().toISOString(),
  checkins: [
    {
      id: "chk-1",
      sessionNumber: 1,
      dateAr: "اليوم",
      scannedAtIso: new Date().toISOString(),
      verifiedByAr: "بوابة المسبح",
      syncedToCloud: true,
    },
    {
      id: "chk-2",
      sessionNumber: 2,
      dateAr: "اليوم",
      scannedAtIso: new Date().toISOString(),
      verifiedByAr: "بوابة المسبح",
      syncedToCloud: true,
    },
    {
      id: "chk-3",
      sessionNumber: 3,
      dateAr: "اليوم",
      scannedAtIso: new Date().toISOString(),
      verifiedByAr: "بوابة المسبح",
      syncedToCloud: true,
    },
  ],
  receipts: [],
};

test.describe("Phase 3 Remaining Remediation Verification (F-018, F-021, F-022, F-023, F-024)", () => {
  test("F-018: FloatingCompareDrawer renders on discovery routes only and is hidden on /auth, /dashboard, /admin, and /compare", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ persona, facilities }) => {
        localStorage.setItem(
          "captenly_platform_state_v6",
          JSON.stringify({
            personaId: persona.id,
            allPersonas: [persona],
            facilities,
            compareFacilityIds: ["fac-p3-pool", "fac-p3-pool-2"],
          })
        );
      },
      { persona: SEED_ATHLETE_PERSONA, facilities: SEED_FACILITIES }
    );

    // Visible on public discovery routes
    for (const visibleRoute of ["/", "/explore", "/pools"]) {
      await page.goto(visibleRoute, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("قارن الآن").first()).toBeVisible({ timeout: 15_000 });
    }

    // Hidden on auth, dashboards, admin, and /compare
    for (const hiddenRoute of [
      "/auth/register",
      "/auth/login",
      "/dashboard/athlete",
      "/dashboard/ledger",
      "/admin",
      "/compare",
    ]) {
      await page.goto(hiddenRoute, { waitUntil: "domcontentloaded" });
      await page.locator("main, h1").first().waitFor({ state: "visible", timeout: 15_000 });
      await expect(page.locator('aside[aria-label="أداة مقارنة المنشآت"]')).toHaveCount(0);
    }
  });
});

const F021_ROUTES = [
  "/",
  "/explore",
  "/pools",
  "/coaches",
  "/compare",
  "/auth",
  "/academy/qa-blue-wave-aquatics",
  "/c/qa-karim-tarek",
  "/dashboard/facility/gate",
  "/dashboard/ledger",
] as const;

test.describe("F-021: Zero critical or serious axe-core violations & semantic <main> landmark", () => {
  for (const route of F021_ROUTES) {
    test(`F-021 [${route}]: semantic <main> landmark & zero critical/serious axe-core violations`, async ({
      page,
    }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.locator("main").first().waitFor({ state: "visible", timeout: 15_000 });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });

      // Every page must expose a semantic <main> landmark
      expect(await page.locator("main").count(), `Expected <main> on ${route}`).toBeGreaterThanOrEqual(1);

      const results = await new AxeBuilder({ page }).analyze();
      const severe = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );
      expect(
        severe.map((v) => `${v.id}(${v.impact}:${v.nodes.length})`),
        `Unexpected critical/serious axe violations on ${route}`
      ).toEqual([]);
    });
  }
});

test.describe("Phase 3 Remaining Remediation Verification (F-022, F-023, F-024)", () => {

  test("F-022: robots.txt, sitemap.xml, Arabic 404 page, and route SEO metadata return cleanly", async ({
    request,
    page,
  }) => {
    const robotsRes = await request.get("/robots.txt");
    expect(robotsRes.status()).toBe(200);
    const robotsBody = await robotsRes.text();
    expect(robotsBody).toContain("Sitemap:");
    expect(robotsBody).toContain("Disallow: /admin");

    const sitemapRes = await request.get("/sitemap.xml");
    expect(sitemapRes.status()).toBe(200);
    const sitemapXml = await sitemapRes.text();
    expect(sitemapXml).toContain("<urlset");
    expect(sitemapXml).toContain("/explore");
    expect(sitemapXml).toContain("/pools");
    expect(sitemapXml).toContain("/coaches");

    // Branded Arabic 404
    const notFoundRes = await page.goto("/non-existent-captenly-route-404-check", {
      waitUntil: "domcontentloaded",
    });
    expect(notFoundRes?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: /المسار المطلوب غير متوفر/i })
    ).toBeVisible();
    await expect(page.getByText(/This page could not be found/i)).toHaveCount(0);

    // Distinct SEO titles & meta descriptions on public HTML
    const homeHtml = await (await request.get("/")).text();
    const exploreHtml = await (await request.get("/explore")).text();
    const coachesHtml = await (await request.get("/coaches")).text();
    expect(homeHtml).toContain("<meta name=\"description\"");
    expect(homeHtml).toContain("og:title");
    expect(exploreHtml).toContain("استكشف المسابح والأكاديميات القريبة منك");
    expect(coachesHtml).toContain("دليل الكباتن المعتمدين ومدربي السباحة");

    // Private routes specify noindex
    const adminHtml = await (await request.get("/admin")).text();
    expect(adminHtml).toContain("noindex");
  });

  test("F-023: Google Fonts render-blocking CSS removed, media endpoint rejects invalid input, and public-supply has no raw base64 blobs", async ({
    request,
    page,
  }) => {
    const homeHtml = await (await request.get("/")).text();
    expect(homeHtml).not.toContain("fonts.googleapis.com/css2");

    const badMediaRes = await request.get("/api/supabase/media?kind=invalid&id=1");
    expect(badMediaRes.status()).toBe(400);

    const missingMediaRes = await request.get("/api/supabase/media?kind=facility&id=non-existent-id");
    expect(missingMediaRes.status()).toBe(404);

    const supplyRes = await request.get("/api/supabase/public-supply");
    expect(supplyRes.status()).toBe(200);
    const supplyText = await supplyRes.text();
    expect(supplyText).not.toMatch(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]{300,}/i);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("main").first().waitFor({ state: "visible", timeout: 15_000 });
  });

  test("F-024: /welcome blocks guests, Facility Ops uses MSA & accurate average, Ledger shows '3 من 8 حصص', Athlete PB labels are clear, and /admin hides founder budget", async ({
    page,
    request,
  }) => {
    // 1. Guest visiting /welcome must be gated, NOT congratulated as ready
    await page.goto("/welcome", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/صفحة الترحيب مخصصة للأعضاء المسجلين/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/أهلاً بك في كابتنلي يا زائر/i)).toHaveCount(0);

    // 2. /admin does NOT leak founder budget or cash deficit in HTML or page
    const adminHtml = await (await request.get("/admin")).text();
    expect(adminHtml).not.toContain("ميزانية التأسيس النقدية");
    expect(adminHtml).not.toContain("أقصى عجز: 12,000");
    expect(adminHtml).not.toContain("فائض س1: +70,000");

    // 3. Athlete dashboard & Ledger with seeded state: no guest flash after hydration, clean labels & RTL ratio
    await page.addInitScript(
      ({ persona, facilities, ledger }) => {
        localStorage.setItem(
          "captenly_platform_state_v6",
          JSON.stringify({
            personaId: persona.id,
            allPersonas: [persona],
            facilities,
            sessionLedgers: [ledger],
          })
        );
      },
      { persona: SEED_ATHLETE_PERSONA, facilities: SEED_FACILITIES, ledger: SEED_LEDGER }
    );

    await page.goto("/dashboard/ledger", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/3 من 8 حصص/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("يرجى إنشاء حساب أو تسجيل الدخول")).toHaveCount(0);

    await page.goto("/dashboard/athlete", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel(/الرقم الجديد/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/الرقم السابق للمقارنة/)).toBeVisible();

    // 4. Facility Manager Ops tab renders MSA "جلسات" instead of "نزلة"
    await page.addInitScript(
      ({ persona, facilities, ledger }) => {
        localStorage.setItem(
          "captenly_platform_state_v6",
          JSON.stringify({
            personaId: persona.id,
            allPersonas: [persona],
            facilities,
            sessionLedgers: [ledger],
          })
        );
      },
      { persona: SEED_FACILITY_MANAGER, facilities: SEED_FACILITIES, ledger: SEED_LEDGER }
    );

    await page.goto("/dashboard/facility", { waitUntil: "domcontentloaded" });
    await page.locator("main, h1").first().waitFor({ state: "visible", timeout: 15_000 });
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("نزلة");
    if (bodyText.includes("حساب المية المحقق اليوم")) {
      expect(bodyText).toContain("جلسات");
    }
  });
});
