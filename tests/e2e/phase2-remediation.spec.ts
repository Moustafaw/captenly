import { test, expect } from "@playwright/test";
import crypto from "crypto";
import fs from "fs";
import path from "path";

function signTestSessionCookie(payload: {
  memberCode: string;
  role: "adult_athlete" | "parent" | "coach" | "facility_manager" | "super_admin";
  email?: string;
  linkedFacilityId?: string;
  linkedCoachId?: string;
}): string | null {
  let secret = (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.CAPTENLY_ADMIN_KEY || "").trim();
  if (!secret) {
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
        for (const line of lines) {
          const m = line.match(/^\s*(AUTH_SECRET|NEXTAUTH_SECRET|CAPTENLY_ADMIN_KEY)\s*=\s*(.+)\s*$/);
          if (m && m[2]) {
            secret = m[2].trim().replace(/^["']|["']$/g, "");
            break;
          }
        }
      }
    } catch {
      // ignore
    }
  }
  if (!secret) return null;
  const fullPayload = { ...payload, exp: Date.now() + 3600_000 };
  const encoded = Buffer.from(JSON.stringify(fullPayload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

test.describe("Phase 2 Remediation Verification (F-010..F-014, F-016, F-017)", () => {
  test("F-010: Unverified roster coaches display honest label, Law 3/1985 rejects medical claims, and public-supply rejects unauth writes", async ({
    request,
    page,
  }) => {
    const unauthSupply = await request.post("/api/supabase/public-supply", {
      data: {
        article: {
          id: "art-overwrite-test",
          titleAr: "مقال مخترق",
          authorEntityId: "fac-other",
        },
      },
    });
    expect(unauthSupply.status()).toBe(401);

    const unauthReg = await request.post("/api/supabase/register-facility", {
      data: {
        nameAr: "نادي اختبار",
        phone: "01000000010",
        locations: [
          {
            city: "القاهرة",
            governorate: "القاهرة",
            district: "المعادي",
            addressAr: "المعادي، القاهرة",
            coordinates: { lat: 29.96, lng: 31.25 },
          },
        ],
      },
    });
    expect(unauthReg.status()).toBe(401);

    // Authenticated non-admin checks (all rejected with 403/400 before DB mutation)
    const facCookie = signTestSessionCookie({
      memberCode: "CAP-F-9010",
      role: "facility_manager",
      email: "f010-test@captenly.local",
      linkedFacilityId: "fac-f010-test",
    });
    if (facCookie) {
      const spoofArticleRes = await request.post("/api/supabase/public-supply", {
        headers: { Cookie: `captenly_member_session=${facCookie}` },
        data: {
          article: {
            id: "art-non-owner-f010",
            titleAr: "محاولة انتحال",
            authorEntityId: "fac-unrelated-victim",
          },
        },
      });
      expect(spoofArticleRes.status()).toBe(403);

      const otherFacilityRes = await request.post("/api/supabase/public-supply", {
        headers: { Cookie: `captenly_member_session=${facCookie}` },
        data: {
          facility: {
            id: "fac-unrelated-victim",
            slug: "fac-unrelated-victim",
            nameAr: "منشأة أخرى",
            supplyStatus: "verified_active",
          },
        },
      });
      expect(otherFacilityRes.status()).toBe(403);

      const medicalRosterRes = await request.post("/api/supabase/public-supply", {
        headers: { Cookie: `captenly_member_session=${facCookie}` },
        data: {
          facility: {
            id: "fac-f010-test",
            slug: "fac-f010-test",
            nameAr: "أكاديمية اختبار",
            coachRoster: [
              {
                id: "rc-med-1",
                facilityId: "fac-f010-test",
                fullNameAr: "كابتن اختبار",
                roleTitleAr: "مدرب",
                specialtyAr: "علاج طبيعي",
                certificatesAr: ["شهادة علاج طبيعي"],
              },
            ],
          },
        },
      });
      expect(medicalRosterRes.status()).toBe(400);
      const medicalRosterJson = await medicalRosterRes.json();
      expect(medicalRosterJson.error).toBe("law_3_1985_prohibited_medical_claims");

      const medicalRegRes = await request.post("/api/supabase/register-facility", {
        headers: { Cookie: `captenly_member_session=${facCookie}` },
        data: {
          nameAr: "مركز علاج طبيعي للسباحة",
          phone: "01000009010",
          locations: [
            {
              city: "القاهرة",
              governorate: "القاهرة",
              district: "المعادي",
              addressAr: "المعادي، القاهرة",
              coordinates: { lat: 29.96, lng: 31.25 },
            },
          ],
        },
      });
      expect(medicalRegRes.status()).toBe(400);

      const medicalProfileRes = await request.post("/api/supabase/sync-profile", {
        headers: { Cookie: `captenly_member_session=${facCookie}` },
        data: {
          memberCode: "CAP-F-9010",
          fullNameAr: "مدير اختبار",
          bioAr: "أخصائي علاج طبيعي بدون ترخيص",
        },
      });
      expect(medicalProfileRes.status()).toBe(400);
    }

    // Seed local facility with unlinked manual coachRoster + manager persona
    await page.addInitScript(() => {
      const testFac = {
        id: "fac-f010-test",
        slug: "phase2-f010-test",
        nameAr: "أكاديمية اختبار التوثيق",
        nameEn: "Verification Test Academy",
        facilityType: "swimming_academy",
        sportSector: "swimming",
        governorate: "القاهرة",
        city: "القاهرة",
        district: "المعادي",
        addressAr: "المعادي، القاهرة",
        coordinates: { lat: 29.96, lng: 31.25 },
        instapayHandle: "",
        vodafoneCashNumber: "",
        supplyStatus: "self_listed_pending",
        subscriptionTier: "free_founding",
        isSponsored: false,
        priceLastVerifiedDaysAgo: 0,
        priceLastVerifiedDate: "مضافة حديثاً",
        avgReplyMinutes: 10,
        completenessScore: 80,
        rating: 4.5,
        reviewsCount: 3,
        heroImage: "",
        badges: [],
        specialtiesAr: ["تأسيس الأطفال"],
        pricePackages: [],
        schoolPrograms: [],
        coachRoster: [
          {
            id: "rc-f010-1",
            facilityId: "fac-f010-test",
            fullNameAr: "كابتن يدوي غير موثق",
            roleTitleAr: "مدرب تعليم",
            specialtyAr: "تأسيس سباحة",
            certificatesAr: ["شهادة داخلية مرفوعة من المنشأة"],
            addedDateAr: "مُضاف من إدارة المنشأة — قيد المراجعة",
          },
        ],
        affiliatedCoachIds: [],
        monthlyMetrics: {
          profileViews: 1,
          comparisonAppearances: 0,
          verifiedWhatsappLeads: 0,
          activeSessionLedgers: 0,
        },
      };
      const manager = {
        id: "user-f010-mgr",
        role: "facility_manager",
        linkedFacilityId: "fac-f010-test",
        memberCode: "CAP-F-9010",
        shortLabelAr: "مدير",
        fullNameAr: "مدير اختبار",
        personaTitleAr: "إدارة منشأة",
        city: "القاهرة",
        phone: "01000009010",
        descriptionAr: "",
        needsOnboarding: false,
      };
      localStorage.setItem(
        "captenly_platform_state_v6",
        JSON.stringify({
          personaId: "user-f010-mgr",
          allPersonas: [manager],
          facilities: [testFac],
        })
      );
    });

    await page.goto("/academy/phase2-f010-test", { waitUntil: "domcontentloaded" });
    const coachesTab = page.getByRole("button", { name: /الكباتن/i }).first();
    await coachesTab.waitFor({ state: "visible", timeout: 15_000 });
    await coachesTab.click();

    await expect(page.getByText(/مُضاف من إدارة المنشأة \(غير موثق بالمنصة بعد\)/)).toBeVisible();
    await expect(page.getByText("معتمد بالمنشأة")).toHaveCount(0);

    // Dashboard coach roster form: blocks uppercase English & Arabic Law 3/1985 claims, allows valid athletic coaching
    await page.goto("/dashboard/facility", { waitUntil: "domcontentloaded" });
    const rosterNameInput = page.getByPlaceholder(/كابتن تامر|اسم الكابتن/i).first();
    if (await rosterNameInput.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await rosterNameInput.fill("كابتن تأهيل");
      const certsInput = page.getByPlaceholder(/FINA|ASCA|شهادة/i).first();
      await certsInput.fill("Medical Therapy Rehabilitation");
      const submitRosterBtn = page.getByRole("button", { name: /إضافة.*مدرب|حفظ الكابتن/i }).first();
      await submitRosterBtn.click();
      await expect(page.getByText(/قانون 3 لسنة 1985/)).toBeVisible();

      // Legitimate swimming training description must succeed without false positive
      await rosterNameInput.fill("كابتن أسامة سباحة");
      await certsInput.fill("إنقاذ مائي معتمد وتأسيس الأطفال");
      await submitRosterBtn.click();
      await expect(page.getByText("كابتن أسامة سباحة").first()).toBeVisible();
    }
  });

  test("F-011: ResponsiveScreen mounts single DOM branch (h1Count === 1) across Desktop, Tablet, and Mobile", async ({
    page,
  }, testInfo) => {
    const routes = ["/", "/explore", "/compare", "/coaches", "/magazine"];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });
      const h1Count = await page.locator("h1").count();
      expect(h1Count, `Route ${route} should have exactly 1 <h1> in DOM (${testInfo.project.name})`).toBe(1);
    }

    if (testInfo.project.name === "desktop-chromium") {
      // Dynamic viewport resize transitions (Desktop -> Tablet -> Mobile -> Desktop)
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/explore", { waitUntil: "domcontentloaded" });
      for (const vp of [
        { width: 768, height: 1024 },
        { width: 390, height: 844 },
        { width: 1366, height: 900 },
      ]) {
        await page.setViewportSize(vp);
        await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });
        expect(await page.locator("h1").count(), `Single h1 at ${vp.width}x${vp.height}`).toBe(1);
      }
      expect(errors).toEqual([]);

      // Navigation link parity in desktop SiteHeader
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const headerNav = page.locator("header nav").first();
      await expect(headerNav.locator('a[href="/"]')).toBeVisible();
      await expect(headerNav.locator('a[href="/explore"]')).toBeVisible();
      await expect(headerNav.locator('a[href="/compare"]')).toBeVisible();
      await expect(headerNav.locator('a[href="/dashboard/ledger"]')).toBeVisible();
      await expect(headerNav.locator('a[href="/magazine"]')).toBeVisible();
    } else {
      // Mobile SiteDock link parity
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const dockNav = page.locator("nav.fixed.bottom-3").first();
      await expect(dockNav).toBeVisible();
      await expect(dockNav.locator('a[href="/"]')).toBeVisible();
      await expect(dockNav.locator('a[href="/explore"]')).toBeVisible();
      await expect(dockNav.locator('a[href="/compare"]')).toBeVisible();
      await expect(dockNav.locator('a[href="/dashboard/ledger"]')).toBeVisible();
    }
  });

  test("F-012: Academy page renders branded fallback map card, handles missing coordinates honestly, and scopes bar dismissal to session", async ({
    page,
    browser,
  }, testInfo) => {
    await page.addInitScript(() => {
      const fac = {
        id: "fac-f012-test",
        slug: "phase2-f012-academy",
        nameAr: "نادي المعادي للتدريب",
        nameEn: "Maadi Swim Club",
        facilityType: "swimming_academy",
        sportSector: "swimming",
        governorate: "القاهرة",
        city: "القاهرة",
        district: "المعادي",
        addressAr: "شارع 9، المعادي، القاهرة",
        coordinates: { lat: 29.9602, lng: 31.2569 },
        instapayHandle: "",
        vodafoneCashNumber: "",
        supplyStatus: "verified_active",
        subscriptionTier: "facility_pro",
        isSponsored: false,
        priceLastVerifiedDaysAgo: 5,
        priceLastVerifiedDate: "محدث",
        avgReplyMinutes: 5,
        completenessScore: 95,
        rating: 4.8,
        reviewsCount: 12,
        heroImage: "",
        badges: [],
        specialtiesAr: ["تأسيس الأطفال"],
        pricePackages: [],
        schoolPrograms: [
          {
            id: "prog-f012-1",
            trackType: "school",
            trackLabelAr: "مدرسة السباحة",
            titleAr: "الباقة الشهرية (8 حصص)",
            priceEgp: 900,
            scheduleAr: "الأحد والثلاثاء",
            sessionsPerMonth: 8,
            durationMinutes: 60,
          },
        ],
        affiliatedCoachIds: [],
        monthlyMetrics: {
          profileViews: 10,
          comparisonAppearances: 1,
          verifiedWhatsappLeads: 2,
          activeSessionLedgers: 1,
        },
      };
      const facNoCoords = {
        ...fac,
        id: "fac-f012-nocoords",
        slug: "phase2-f012-nocoords",
        nameAr: "أكاديمية بدون إحداثيات",
        addressAr: "",
        district: "",
        city: "",
        coordinates: { lat: 0, lng: 0 },
      };
      localStorage.setItem(
        "captenly_platform_state_v6",
        JSON.stringify({ facilities: [fac, facNoCoords] })
      );
    });

    await page.goto("/academy/phase2-f012-academy", { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });

    const fallbackMap = page.getByTestId("captenly-map-fallback-card").first();
    await fallbackMap.scrollIntoViewIfNeeded();
    await expect(fallbackMap).toBeVisible();
    const mapBox = await fallbackMap.boundingBox();
    expect(mapBox && mapBox.height).toBeGreaterThan(150);
    const mapLink = fallbackMap.getByRole("link", { name: /افتح الموقع في خرائط Google/i });
    await expect(mapLink).toBeVisible();
    await expect(mapLink).toHaveAttribute("href", /29\.960200.*31\.256900/);

    if (testInfo.project.name === "desktop-chromium") {
      const floatingBar = page.getByTestId("guest-floating-auth-bar");
      await expect(floatingBar).toBeVisible();
      await floatingBar.getByRole("button", { name: "إخفاء الشريط" }).click();
      await expect(floatingBar).toHaveCount(0);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("guest-floating-auth-bar")).toHaveCount(0);

      // Fresh browser session must show GuestFloatingAuthBar again (sessionStorage only)
      const freshCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      try {
        const freshPage = await freshCtx.newPage();
        await freshPage.addInitScript(() => {
          localStorage.setItem(
            "captenly_platform_state_v6",
            JSON.stringify({
              facilities: [
                {
                  id: "fac-f012-test",
                  slug: "phase2-f012-academy",
                  nameAr: "نادي المعادي للتدريب",
                  nameEn: "Maadi Swim Club",
                  facilityType: "swimming_academy",
                  sportSector: "swimming",
                  governorate: "القاهرة",
                  city: "القاهرة",
                  district: "المعادي",
                  addressAr: "شارع 9، المعادي، القاهرة",
                  coordinates: { lat: 29.9602, lng: 31.2569 },
                  instapayHandle: "",
                  vodafoneCashNumber: "",
                  supplyStatus: "verified_active",
                  subscriptionTier: "facility_pro",
                  isSponsored: false,
                  priceLastVerifiedDaysAgo: 5,
                  priceLastVerifiedDate: "محدث",
                  avgReplyMinutes: 5,
                  completenessScore: 95,
                  rating: 4.8,
                  reviewsCount: 12,
                  heroImage: "",
                  badges: [],
                  specialtiesAr: ["سباحة"],
                  pricePackages: [],
                  schoolPrograms: [],
                  affiliatedCoachIds: [],
                  monthlyMetrics: { profileViews: 1, comparisonAppearances: 0, verifiedWhatsappLeads: 0, activeSessionLedgers: 0 },
                },
              ],
            })
          );
        });
        await freshPage.goto("/academy/phase2-f012-academy", { waitUntil: "domcontentloaded" });
        await expect(freshPage.getByTestId("guest-floating-auth-bar")).toBeVisible();
      } finally {
        await freshCtx.close();
      }

      // Missing coordinates must NOT fabricate (0,0) or fake pin links
      await page.goto("/academy/phase2-f012-nocoords", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("الإحداثيات الدقيقة غير مضافة بعد")).toBeVisible();
    }
  });

  test("F-013: Header removes duplicate register CTA/dropdown caret; FilterModal has single clear CTA & LTR temperature", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop header check runs on desktop project");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });

    await expect(page.getByText("فلاتر ▾")).toHaveCount(0);
    await expect(page.getByText("سجّل للحصول على كود عضويتك")).toHaveCount(0);
    await expect(page.locator("header").getByRole("link", { name: "إنشاء حساب" })).toHaveCount(1);
    await expect(page.locator('header a[href="/explore?filters=1"]')).toContainText("الفلاتر");

    await page.goto("/explore?filters=1", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: "تصفية النتائج والخيارات" })).toBeVisible();
    await expect(page.getByRole("button", { name: "إعادة ضبط" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "مسح الكل" })).toHaveCount(1);

    const ltrTemp = page.locator('span[dir="ltr"]', { hasText: "(28°C–30°C)" });
    await expect(ltrTemp).toBeVisible();

    // Filter application & single "مسح الكل" reset works cleanly
    await page.locator('input[type="checkbox"]').first().check();
    await expect(page.getByText("1 نشطة")).toBeVisible();
    await page.getByRole("button", { name: "مسح الكل" }).click();
    await expect(page.getByText("1 نشطة")).toHaveCount(0);
  });

  test("F-014: Actual E2E distance filtering (2km vs 25km + API radius + clear + reload) and map SDK fallback/recovery", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop modal check runs on desktop project");
    test.setTimeout(75_000);

    // 1. Verify /api/places/search?radius=... enforces strict coordinates distance when radius param supplied
    const api2Km = await request.get("/api/places/search?city=%D8%A7%D9%84%D9%82%D8%A7%D9%87%D8%B1%D8%A9&lat=30.0444&lng=31.2357&radius=2");
    expect(api2Km.status()).toBe(200);
    const json2Km = await api2Km.json();

    const api25Km = await request.get("/api/places/search?city=%D8%A7%D9%84%D9%82%D8%A7%D9%87%D8%B1%D8%A9&lat=30.0444&lng=31.2357&radius=25");
    expect(api25Km.status()).toBe(200);
    const json25Km = await api25Km.json();
    expect((json25Km.places || []).length).toBeGreaterThanOrEqual((json2Km.places || []).length);

    // Seed controlled fixtures with known distances from Cairo center (30.0444, 31.2357):
    // - Near fixture: ~0.77 km away (should appear at BOTH 2 km and 25 km)
    // - Far fixture: ~12.8 km away (should be EXCLUDED at 2 km, INCLUDED at 25 km)
    await page.addInitScript(() => {
      const baseFac = {
        facilityType: "swimming_academy",
        sportSector: "swimming",
        governorate: "القاهرة",
        city: "القاهرة",
        district: "وسط البلد",
        addressAr: "القاهرة",
        instapayHandle: "",
        vodafoneCashNumber: "",
        supplyStatus: "verified_active",
        subscriptionTier: "facility_pro",
        isSponsored: false,
        priceLastVerifiedDaysAgo: 0,
        priceLastVerifiedDate: "اليوم",
        avgReplyMinutes: 5,
        completenessScore: 90,
        rating: 4.9,
        reviewsCount: 10,
        heroImage: "",
        badges: [],
        specialtiesAr: ["سباحة"],
        pricePackages: [],
        schoolPrograms: [],
        affiliatedCoachIds: [],
        monthlyMetrics: { profileViews: 10, comparisonAppearances: 0, verifiedWhatsappLeads: 0, activeSessionLedgers: 0 },
      };
      const nearFac = {
        ...baseFac,
        id: "fac-dist-near-1km",
        slug: "fac-dist-near-1km",
        nameAr: "مسبح التحرير القريب (1 كم)",
        nameEn: "Near Pool",
        coordinates: { lat: 30.050, lng: 31.240 },
      };
      const farFac = {
        ...baseFac,
        id: "fac-dist-far-12km",
        slug: "fac-dist-far-12km",
        nameAr: "نادي مصر الجديدة البعيد (12 كم)",
        nameEn: "Far Pool",
        coordinates: { lat: 30.145, lng: 31.300 },
      };
      if (!localStorage.getItem("captenly_platform_state_v6")) {
        localStorage.setItem(
          "captenly_platform_state_v6",
          JSON.stringify({ facilities: [nearFac, farFac] })
        );
      }
    });

    // Abort Google Maps SDK script to verify primary map failure -> fallback UI -> coordinate selection -> recovery
    let blockSdk = true;
    await page.route("https://maps.googleapis.com/**", (route) => {
      if (blockSdk) return route.abort();
      return route.continue();
    });

    const searchUrls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/places/search")) {
        searchUrls.push(req.url());
      }
    });

    await page.goto("/explore", { waitUntil: "load" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("header").getByRole("button", { name: /نطاق البحث:/i }).first().click();

    const locModal = page.getByTestId("location-modal");
    await expect(locModal.getByText("تحديد النطاق والموقع الجغرافي")).toBeVisible();
    await expect(locModal.getByTestId("location-autocomplete-quick-cities")).toHaveCount(0);
    await expect(
      locModal.getByTestId("quick-cities-grid").getByRole("button", { name: /المحلة الكبرى/ })
    ).toHaveCount(1);

    // Fallback coordinate panel must activate when SDK fails (timeout/abort) without any grey iframe
    await expect(locModal.locator("iframe")).toHaveCount(0);
    const fallbackPanel = locModal.getByTestId("interactive-map-fallback");
    await expect(fallbackPanel).toBeVisible({ timeout: 10_000 });

    // 1. Click a non-preset corner point on the interactive coordinate grid, save, and verify non-Cairo coords persist & drive search
    await locModal.getByRole("button", { name: /خريطة تفاعلية بديلة لتحديد الموقع/i }).click({
      position: { x: 35, y: 35 },
    });
    await locModal.getByRole("button", { name: "25 كم", exact: true }).click();
    await locModal.getByRole("button", { name: "تطبيق وحفظ النطاق", exact: true }).click();

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const raw = localStorage.getItem("captenly_platform_state_v6");
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return {
            isSpecified: parsed?.userLocation?.isSpecified,
            lat: parsed?.userLocation?.lat,
            lng: parsed?.userLocation?.lng,
            maxDistanceKm: parsed?.smartFilters?.maxDistanceKm,
          };
        });
      })
      .toMatchObject({ isSpecified: true, maxDistanceKm: 25 });

    const customPickedState = await page.evaluate(() => {
      const raw = localStorage.getItem("captenly_platform_state_v6");
      return raw ? JSON.parse(raw) : null;
    });
    expect(customPickedState?.userLocation?.isSpecified).toBe(true);
    const pickedLat = Number(customPickedState?.userLocation?.lat);
    const pickedLng = Number(customPickedState?.userLocation?.lng);
    expect(Number.isFinite(pickedLat)).toBe(true);
    expect(Number.isFinite(pickedLng)).toBe(true);
    expect(Math.abs(pickedLat - 30.0444) + Math.abs(pickedLng - 31.2357)).toBeGreaterThan(0.01);

    searchUrls.length = 0;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });
    await expect
      .poll(
        () =>
          searchUrls.find(
            (url) =>
              (url.includes(`lat=${pickedLat.toFixed(4)}`) ||
                url.includes(`lat=${pickedLat}`)) &&
              (url.includes(`lng=${pickedLng.toFixed(4)}`) ||
                url.includes(`lng=${pickedLng}`)) &&
              url.includes("radius=25")
          ) ?? null,
        { timeout: 10_000 }
      )
      .not.toBeNull();

    // 2. Test strict SDK recovery BEFORE selecting Cairo + 2 km vs 25 km
    const pickedCity = String(customPickedState?.userLocation?.city || "").trim();
    const escapedCity = pickedCity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const locBtnRegex = escapedCity
      ? new RegExp(`نطاق البحث:|محدد على الخريطة|${escapedCity}`, "i")
      : /نطاق البحث:|محدد على الخريطة/i;
    await page.locator("header").getByRole("button", { name: locBtnRegex }).first().click();
    const retryMapBtn = locModal.getByRole("button", { name: "إعادة تحميل الخريطة" });
    await expect(retryMapBtn).toBeVisible({ timeout: 10_000 });
    blockSdk = false;
    await retryMapBtn.click();
    await expect(retryMapBtn).toHaveCount(0, { timeout: 10_000 });
    await expect(locModal.getByText("انقر على الخريطة أو اسحب الدبوس لتحديد موقعك")).toBeVisible({
      timeout: 10_000,
    });

    // 3. Pick Cairo + 2 km radius and verify controlled fixture distance filtering
    await locModal.getByTestId("quick-cities-grid").getByRole("button", { name: /القاهرة/ }).click();
    await locModal.getByRole("button", { name: "2 كم", exact: true }).click();
    await locModal.getByRole("button", { name: "تطبيق وحفظ النطاق", exact: true }).click();

    // Verify 2 km actually excludes the 12.8 km facility while keeping the 0.77 km facility
    await expect(page.getByText("مسبح التحرير القريب (1 كم)").first()).toBeVisible();
    await expect(page.getByText("نادي مصر الجديدة البعيد (12 كم)")).toHaveCount(0);

    // Expand radius to 25 km -> 12.8 km facility now becomes visible!
    await page.locator("header").getByRole("button", { name: /القاهرة، القاهرة|نطاق البحث:/i }).first().click();
    await locModal.getByRole("button", { name: "25 كم", exact: true }).click();
    await locModal.getByRole("button", { name: "تطبيق وحفظ النطاق", exact: true }).click();
    await expect(page.getByText("مسبح التحرير القريب (1 كم)").first()).toBeVisible();
    await expect(page.getByText("نادي مصر الجديدة البعيد (12 كم)").first()).toBeVisible();

    // Reload page -> restored radius preference keeps 25 km & both facilities
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });
    await expect(page.getByText("نادي مصر الجديدة البعيد (12 كم)").first()).toBeVisible();

    // Reset to All Egypt and verify cleared location & default 30 km
    await page.locator("header").getByRole("button", { name: /القاهرة، القاهرة|نطاق البحث:/i }).first().click();
    await locModal.getByRole("button", { name: "عرض كل مصر (إلغاء النطاق)" }).click();

    const resetState = await page.evaluate(() => {
      const raw = localStorage.getItem("captenly_platform_state_v6");
      return raw ? JSON.parse(raw) : null;
    });
    expect(resetState?.userLocation?.isSpecified).toBe(false);
    expect(resetState?.smartFilters?.maxDistanceKm).toBe(30);
  });

  test("F-016: Missing package nameAr does not crash trim(), and /api/places/search strips raw Google Plus Codes", async ({
    request,
    page,
  }) => {
    const placesRes = await request.get("/api/places/search?city=%D8%A7%D9%84%D9%85%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D9%83%D8%A8%D8%B1%D9%89");
    expect(placesRes.status()).toBe(200);
    const placesJson = await placesRes.json();
    const plusCodeRegex = /\b[2-9CFGHJMPQRVWX]{4,8}\+[2-9CFGHJMPQRVWX]{2,4}\b/i;
    for (const fac of placesJson.places || []) {
      expect(plusCodeRegex.test(fac.addressAr || "")).toBe(false);
      expect(plusCodeRegex.test(fac.district || "")).toBe(false);
      expect(plusCodeRegex.test(fac.publicDescriptionAr || "")).toBe(false);
    }

    const runtimeErrors: string[] = [];
    page.on("pageerror", (err) => runtimeErrors.push(err.message));

    await page.addInitScript(() => {
      const fac = {
        id: "fac-f016-nullpkg",
        slug: "phase2-f016-nullpkg",
        nameAr: "نادي اختبار نقص اسم الباقة",
        nameEn: "Null Pkg Test",
        facilityType: "swimming_academy",
        sportSector: "swimming",
        governorate: "القاهرة",
        city: "القاهرة",
        district: "المعادي",
        addressAr: "المعادي، القاهرة",
        coordinates: { lat: 29.96, lng: 31.25 },
        instapayHandle: "",
        vodafoneCashNumber: "",
        supplyStatus: "verified_active",
        subscriptionTier: "free_founding",
        isSponsored: false,
        priceLastVerifiedDaysAgo: 0,
        priceLastVerifiedDate: "محدث",
        avgReplyMinutes: 10,
        completenessScore: 80,
        rating: 4.5,
        reviewsCount: 1,
        heroImage: "",
        badges: [],
        specialtiesAr: ["سباحة"],
        pricePackages: [
          {
            id: "pkg-corrupt",
            nameAr: undefined,
            sessionsPerWeek: 2,
            sessionsCount: 8,
            durationMinutes: 60,
            baseMonthlyEgp: 750,
            assessmentFeeEgp: 0,
            membershipCardFeeEgp: 0,
            mandatoryKitFeeEgp: 0,
            companionFeeEgp: 0,
          },
        ],
        schoolPrograms: [
          {
            id: "prog-corrupt",
            trackType: "school",
            titleAr: null,
            priceEgp: 850,
            scheduleAr: "السبت",
          },
        ],
        affiliatedCoachIds: [],
        monthlyMetrics: {
          profileViews: 1,
          comparisonAppearances: 0,
          verifiedWhatsappLeads: 0,
          activeSessionLedgers: 0,
        },
      };
      localStorage.setItem(
        "captenly_platform_state_v6",
        JSON.stringify({ facilities: [fac] })
      );
    });

    await page.goto("/academy/phase2-f016-nullpkg", { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });
    await expect(page.getByText(/850\s*ج\.م/).first()).toBeVisible();
    await page.goto("/explore", { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });
    expect(runtimeErrors).toEqual([]);
  });

  test("F-017: Complete Pool Gate Kiosk workflow on 390x844 (camera error recovery, scan, 3h duplicate, expired renewal, >=48px targets, no overlays)", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/supabase/session-ledgers*", async (route) => {
      if (route.request().method() === "POST") {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = (route.request().postDataJSON() as Record<string, unknown>) || {};
        } catch {
          parsed = {};
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            persisted: true,
            ledger: parsed.ledger || null,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ persisted: true, ledgers: [], hasMore: false }),
      });
    });
    await page.route("**/api/supabase/notifications*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, persisted: true, notifications: [] }),
      });
    });
    await page.addInitScript(() => {
      const fac1 = {
        id: "fac-gate-p2",
        slug: "fac-gate-p2",
        nameAr: "نادي بوابة الاختبار",
        nameEn: "Gate Test Club",
        facilityType: "swimming_academy",
        sportSector: "swimming",
        governorate: "القاهرة",
        city: "القاهرة",
        district: "المعادي",
        addressAr: "المعادي، القاهرة",
        coordinates: { lat: 29.96, lng: 31.25 },
        instapayHandle: "",
        vodafoneCashNumber: "",
        supplyStatus: "verified_active",
        subscriptionTier: "facility_pro",
        isSponsored: false,
        priceLastVerifiedDaysAgo: 0,
        priceLastVerifiedDate: "اليوم",
        avgReplyMinutes: 10,
        completenessScore: 90,
        rating: 4.8,
        reviewsCount: 5,
        heroImage: "",
        badges: [],
        specialtiesAr: ["سباحة"],
        pricePackages: [],
        affiliatedCoachIds: [],
        monthlyMetrics: {
          profileViews: 1,
          comparisonAppearances: 0,
          verifiedWhatsappLeads: 0,
          activeSessionLedgers: 0,
        },
      };
      const fac2 = { ...fac1, id: "fac-gate-p2-cmp", slug: "fac-gate-p2-cmp", nameAr: "نادي مقارن" };
      const mgr = {
        id: "user-f017-mgr",
        role: "facility_manager",
        linkedFacilityId: "fac-gate-p2",
        memberCode: "CAP-F-9017",
        shortLabelAr: "مشغّل",
        fullNameAr: "مشغل بوابة 1",
        personaTitleAr: "مدير المنشأة",
        city: "القاهرة",
        phone: "01000009017",
        descriptionAr: "",
        needsOnboarding: false,
      };
      const ledgers = [
        {
          id: "led-gate-p2-active",
          ledgerCode: "CAP-SUB-9017",
          subscriptionCode: "CAP-SUB-9017",
          memberCode: "CAP-M-9100",
          athleteId: "ath-gate-1",
          athleteNameAr: "سباح نشط بوابة",
          coachId: "coach-1",
          coachNameAr: "كابتن حسام",
          facilityId: "fac-gate-p2",
          facilityNameAr: "نادي بوابة الاختبار",
          sportSector: "swimming",
          packageTitleAr: "باقة 8 حصص",
          totalSessions: 8,
          completedSessions: 2,
          pinCode: "9017",
          status: "active",
          startedDateAr: "اليوم",
          checkins: [],
          receipts: [],
        },
        {
          id: "led-gate-p2-expired",
          ledgerCode: "CAP-SUB-9099",
          subscriptionCode: "CAP-SUB-9099",
          memberCode: "CAP-M-9099",
          athleteId: "ath-gate-2",
          athleteNameAr: "سباح منتهي الباقة",
          coachId: "coach-1",
          coachNameAr: "كابتن حسام",
          facilityId: "fac-gate-p2",
          facilityNameAr: "نادي بوابة الاختبار",
          sportSector: "swimming",
          packageTitleAr: "باقة 8 حصص",
          totalSessions: 8,
          completedSessions: 8,
          pinCode: "9099",
          status: "expired",
          startedDateAr: "الشهر الماضي",
          checkins: [],
          receipts: [],
        },
      ];
      localStorage.setItem(
        "captenly_platform_state_v6",
        JSON.stringify({
          personaId: "user-f017-mgr",
          allPersonas: [mgr],
          facilities: [fac1, fac2],
          sessionLedgers: ledgers,
          compareFacilityIds: ["fac-gate-p2", "fac-gate-p2-cmp"],
          offlineMode: true,
        })
      );
    });

    await page.goto("/dashboard/facility/gate", { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });

    // SiteDock and FloatingCompareDrawer must NOT overlap inside kiosk
    await expect(page.locator("nav.fixed.bottom-3")).toHaveCount(0);
    await expect(page.getByText(/قارن الآن/)).toHaveCount(0);

    // Explicit exit link to facility dashboard must exist and be >= 48px tall
    const backLink = page.getByRole("link", { name: /عودة للوحة المنشأة/ });
    await expect(backLink).toBeVisible();
    const backBox = await backLink.boundingBox();
    expect(backBox && backBox.height, `Back link height (${testInfo.project.name})`).toBeGreaterThanOrEqual(48);

    // Camera initialization in headless/no-camera browser handles permission/hardware unavailability cleanly without breaking keypad
    const camBtn = page.getByRole("button", { name: "تشغيل الكاميرا" });
    await expect(camBtn).toBeVisible();
    await camBtn.click();
    await expect(page.getByText(/لم نتمكن من فتح الكاميرا|الكاميرا غير متاحة/)).toBeVisible();

    // Scan QR payload via manual keypad input -> attendance check-in processed (3 / 8)
    const codeInput = page.getByPlaceholder(/اكتب كود الاشتراك/).first();
    await codeInput.fill("CAP-SUB-9017");
    await page.getByRole("button", { name: "فحص وتسجيل دخول" }).click();
    await expect(page.getByText("سباح نشط بوابة").first()).toBeVisible();
    await expect(page.getByText(/3\s*\/\s*8/).first()).toBeVisible();

    // Immediate second scan triggers 3-hour duplicate protection + accessible override button (>=48px)
    await codeInput.fill("CAP-SUB-9017");
    await page.getByRole("button", { name: "فحص وتسجيل دخول" }).click();
    const overrideBtn = page.getByRole("button", { name: /تسجيل استثنائي وتجاوز قفل الـ 3 ساعات/ });
    await expect(overrideBtn).toBeVisible();
    const overrideBox = await overrideBtn.boundingBox();
    expect(overrideBox && overrideBox.height).toBeGreaterThanOrEqual(48);

    // Expired subscription scan reveals renewal link + WhatsApp link (no overlap)
    await codeInput.fill("CAP-SUB-9099");
    await page.getByRole("button", { name: "فحص وتسجيل دخول" }).click();
    await expect(page.getByRole("link", { name: /تجديد الاشتراك/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /إرسال تنبيه تجديد/ })).toBeVisible();

    // Check every primary visible button inside kiosk header & main meets >= 48px touch target
    const buttons = page.getByTestId("pool-gate-kiosk").locator("button:visible");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(2);
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      const label = (await btn.innerText()).trim();
      if (box && label) {
        expect(box.height, `Button "${label}" height must be >= 48px`).toBeGreaterThanOrEqual(48);
      }
    }

    // Exit navigation back to facility dashboard remains accessible even without SiteDock
    await backLink.click();
    await page.waitForURL(/\/dashboard\/facility(?:\?|$)/, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
  });
});
