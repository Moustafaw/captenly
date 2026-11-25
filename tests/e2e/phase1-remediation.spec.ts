import { test, expect } from "@playwright/test";

test.describe("Phase 1 Security & Functional Remediation Verification", () => {
  test("F-001 & F-002: Google OAuth bypass and unauthenticated account purge return 401/403", async ({
    request,
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    const statusRes = await request.get("/api/auth/google-status");
    expect(statusRes.status()).toBe(200);
    const statusJson = await statusRes.json();
    expect(statusJson.previewAllowed).toBe(false);

    const previewLoginRes = await request.post("/api/auth/member-auth", {
      data: {
        action: "google_login",
        email: "attacker@example.com",
        isSimulatedPreview: true,
      },
    });
    expect(previewLoginRes.status()).toBe(401);
    const previewJson = await previewLoginRes.json();
    expect(previewJson.reason).toBe("preview_disabled");

    const unauthGoogleRes = await request.post("/api/auth/member-auth", {
      data: {
        action: "google_login",
        email: "victim@example.com",
      },
    });
    expect(unauthGoogleRes.status()).toBe(401);
    const unauthJson = await unauthGoogleRes.json();
    expect(unauthJson.reason).toBe("oauth_session_required");

    const purgeRes = await request.post("/api/auth/member-auth", {
      data: { action: "purge_non_owner_accounts" },
    });
    expect(purgeRes.status()).toBe(403);

    // UI verification: Google button must never open client-side simulated preview modal
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    const googleBtn = page.getByRole("button", { name: /Google/i }).first();
    await googleBtn.waitFor({ state: "visible", timeout: 15_000 });
    await googleBtn.click();
    await expect(page.locator("[data-google-modal='true']")).toHaveCount(0);
    if (statusJson.configured) {
      await page.waitForURL(/accounts\.google\.com/, {
        waitUntil: "commit",
        timeout: 45_000,
      });
    } else {
      await expect(page.getByText(/يتطلب تفعيل مفاتيح OAuth الحقيقية/i)).toBeVisible();
    }
  });

  test("F-002: LocalStorage preserves multiple real member accounts without hardcoded owner cleanup", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const state = {
        personaId: "user-cap-m-7711",
        allPersonas: [
          {
            id: "persona-guest",
            role: "guest",
            shortLabelAr: "زائر",
            fullNameAr: "زائر كابتنلي",
            personaTitleAr: "ضيف",
            city: "كل مصر",
            phone: "",
            descriptionAr: "",
          },
          {
            id: "user-cap-m-7711",
            role: "adult_athlete",
            memberCode: "CAP-M-7711",
            email: "user-one@example.com",
            shortLabelAr: "أحمد",
            fullNameAr: "أحمد الأول",
            personaTitleAr: "سباح",
            city: "القاهرة",
            phone: "01000000001",
            descriptionAr: "",
            needsOnboarding: false,
          },
          {
            id: "user-cap-m-7722",
            role: "parent",
            memberCode: "CAP-M-7722",
            email: "user-two@example.com",
            shortLabelAr: "سارة",
            fullNameAr: "سارة الثانية",
            personaTitleAr: "ولية أمر",
            city: "طنطا",
            phone: "01000000002",
            descriptionAr: "",
            needsOnboarding: false,
          },
        ],
      };
      localStorage.setItem("captenly_platform_state_v6", JSON.stringify(state));
      localStorage.removeItem("captenly_single_owner_cleanup_v1");
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem("captenly_platform_state_v6");
      return {
        parsed: raw ? JSON.parse(raw) : null,
        cleanupFlag: localStorage.getItem("captenly_single_owner_cleanup_v1"),
      };
    });
    expect(saved.cleanupFlag).toBeNull();
    expect(saved.parsed?.personaId).toBe("user-cap-m-7711");
    const codes = (saved.parsed?.allPersonas || []).map((p: { memberCode?: string }) => p.memberCode);
    expect(codes).toContain("CAP-M-7711");
    expect(codes).toContain("CAP-M-7722");
  });

  test("F-003 & F-006: Pool gate kiosk accepts CAP-SUB-*, SUB-*, CAP-M-*, CAP-JR-* & enforces 3h duplicate guard", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const facility = {
        id: "fac-phase1-test",
        slug: "fac-phase1-test",
        nameAr: "نادي النخبة للاختبار",
        nameEn: "Elite Test Club",
        facilityType: "swimming_academy",
        sportSector: "swimming",
        governorate: "القاهرة",
        city: "مدينة نصر",
        district: "الحي السابع",
        addressAr: "شارع الاختبار",
        coordinates: { lat: 30.05, lng: 31.33 },
        supplyStatus: "verified_active",
        subscriptionTier: "pro",
        isFeaturedTier: true,
        isSponsored: false,
        priceLastVerifiedDaysAgo: 0,
        priceLastVerifiedDate: "اليوم",
        avgReplyMinutes: 10,
        completenessScore: 95,
        rating: 4.9,
        reviewsCount: 12,
        heroImage: "/screens/20b781f698f9.jpg",
        badges: [],
        specialtiesAr: ["سباحة"],
        pricePackages: [],
        affiliatedCoachIds: [],
        monthlyMetrics: {
          profileViews: 10,
          comparisonAppearances: 2,
          verifiedWhatsappLeads: 3,
          activeSessionLedgers: 3,
        },
      };
      const managerPersona = {
        id: "user-fac-phase1",
        role: "facility_manager",
        memberCode: "CAP-F-1001",
        linkedFacilityId: "fac-phase1-test",
        shortLabelAr: "مدير",
        fullNameAr: "مدير نادي النخبة",
        personaTitleAr: "إدارة المنشأة",
        city: "القاهرة",
        phone: "01000000010",
        descriptionAr: "",
        needsOnboarding: false,
      };
      const ledgers = [
        {
          id: "led-sub-cap",
          ledgerCode: "CAP-SUB-2410",
          subscriptionCode: "CAP-SUB-2410",
          memberCode: "CAP-M-9001",
          athleteId: "ath-1",
          athleteNameAr: "سليم كابتن ساب",
          coachId: "coach-1",
          coachNameAr: "كابتن حسام",
          facilityId: "fac-phase1-test",
          facilityNameAr: "نادي النخبة للاختبار",
          sportSector: "swimming",
          packageTitleAr: "باقة 8 حصص",
          totalSessions: 8,
          completedSessions: 2,
          pinCode: "1122",
          status: "active",
          startedDateAr: "اليوم",
          checkins: [],
          receipts: [],
        },
        {
          id: "led-jr-mem",
          ledgerCode: "SUB-7788",
          subscriptionCode: "SUB-7788",
          memberCode: "CAP-JR-3311",
          athleteId: "ath-jr",
          athleteNameAr: "زين الصغير",
          coachId: "coach-1",
          coachNameAr: "كابتن حسام",
          facilityId: "fac-phase1-test",
          facilityNameAr: "نادي النخبة للاختبار",
          sportSector: "swimming",
          packageTitleAr: "باقة 12 حصة",
          totalSessions: 12,
          completedSessions: 1,
          pinCode: "3344",
          status: "active",
          startedDateAr: "اليوم",
          checkins: [],
          receipts: [],
        },
        {
          id: "led-adult-mem",
          ledgerCode: "CAP-SUB-5502",
          subscriptionCode: "CAP-SUB-5502",
          memberCode: "CAP-M-5502",
          athleteId: "ath-5502",
          athleteNameAr: "يوسف البالغ",
          coachId: "coach-1",
          coachNameAr: "كابتن حسام",
          facilityId: "fac-phase1-test",
          facilityNameAr: "نادي النخبة للاختبار",
          sportSector: "swimming",
          packageTitleAr: "باقة 8 حصص",
          totalSessions: 8,
          completedSessions: 0,
          pinCode: "5566",
          status: "active",
          startedDateAr: "اليوم",
          checkins: [],
          receipts: [],
        },
      ];
      localStorage.setItem(
        "captenly_platform_state_v6",
        JSON.stringify({
          personaId: "user-fac-phase1",
          allPersonas: [managerPersona],
          facilities: [facility],
          sessionLedgers: ledgers,
          offlineMode: true,
        })
      );
    });

    await page.goto("/dashboard/facility/gate", { waitUntil: "domcontentloaded" });
    const codeInput = page.locator("input[placeholder*='SUB-']").first();
    await codeInput.waitFor({ state: "visible", timeout: 15_000 });

    // 1. Scan CAP-SUB-2410 (exact full prefix must be preserved, not sliced to SUB-2410)
    await codeInput.fill("CAP-SUB-2410");
    await codeInput.press("Enter");
    await expect(page.getByText(/دخول مسموح — تم خصم الحصة بنجاح/)).toBeVisible();
    await expect(page.getByText(/الحصة رقم \(3 من 8\)/).first()).toBeVisible();

    // 2. Re-scan same code immediately -> 3h duplicate guard activates cleanly
    await codeInput.fill("CAP-SUB-2410");
    await codeInput.press("Enter");
    await expect(page.getByText(/تنبيه تكرار المسح \(حماية 3 ساعات\)/)).toBeVisible();

    // 3. Scan member QR URL/prefix CAP-MEMBER:CAP-JR-3311
    await codeInput.fill("https://captenly.vercel.app/dashboard/ledger?qr=CAP-MEMBER%3ACAP-JR-3311");
    await codeInput.press("Enter");
    await expect(page.getByText(/دخول مسموح — تم خصم الحصة بنجاح/)).toBeVisible();
    await expect(page.getByText(/زين الصغير/).first()).toBeVisible();

    // 4. Scan raw adult member code CAP-M-5502
    await codeInput.fill("CAP-M-5502");
    await codeInput.press("Enter");
    await expect(page.getByText(/دخول مسموح — تم خصم الحصة بنجاح/)).toBeVisible();
    await expect(page.getByText(/يوسف البالغ/).first()).toBeVisible();
  });

  test("F-004: Coach profile hides verified badge when badges are empty or unverified", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const coaches = [
        {
          id: "coach-unverified-p1",
          slug: "unverified-phase1-test",
          SingleCoachId: "CAP-C-9901",
          fullNameAr: "كابتن اختبار غير موثق",
          titleAr: "مدرب تحت المراجعة",
          city: "القاهرة",
          governorate: "القاهرة",
          sportSector: "swimming",
          trustTier: "self_registered",
          isVerifiedCoach: false,
          rating: 0,
          reviewsCount: 0,
          yearsExperience: 2,
          bioAr: "مدرب تجريبي",
          whatsappNumber: "01000000099",
          specialties: [{ nameAr: "تعليم سباحة", tierAr: "مبتدئ" }],
          badges: [],
          affiliations: [],
          price8SessionsEgp: 1200,
          price12SessionsEgp: 1600,
        },
        {
          id: "coach-verified-p1",
          slug: "verified-phase1-test",
          SingleCoachId: "CAP-C-9902",
          fullNameAr: "كابتن اختبار موثق",
          titleAr: "كابتن إنقاذ وتدريب",
          city: "الجيزة",
          governorate: "الجيزة",
          sportSector: "swimming",
          trustTier: "verified",
          isVerifiedCoach: true,
          rating: 4.9,
          reviewsCount: 15,
          yearsExperience: 8,
          bioAr: "مدرب معتمد",
          whatsappNumber: "01000000098",
          specialties: [{ nameAr: "إنقاذ وتأهيل", tierAr: "متقدم" }],
          badges: [
            {
              code: "BADGE_01_WSC_RESCUE",
              titleAr: "شارة الإنقاذ والإسعاف المائي",
              authorityAr: "الاتحاد المصري للسباحة",
              descriptionAr: "معتمدة",
              status: "active",
            },
          ],
          affiliations: [],
          price8SessionsEgp: 1800,
          price12SessionsEgp: 2400,
        },
      ];
      localStorage.setItem("captenly_platform_state_v6", JSON.stringify({ coaches }));
    });

    await page.goto("/c/unverified-phase1-test", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "كابتن اختبار غير موثق" }).waitFor({
      state: "visible",
      timeout: 15_000,
    });
    await expect(page.getByText("كابتن مسجّل — بانتظار التوثيق")).toBeVisible();
    await expect(page.getByText("كابتن موثق رسمياً")).toHaveCount(0);

    await page.goto("/c/verified-phase1-test", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "كابتن اختبار موثق" }).waitFor({
      state: "visible",
      timeout: 15_000,
    });
    await expect(page.getByText("كابتن موثق رسمياً")).toBeVisible();
  });

  test("F-005, F-007, F-008 & F-009: API PII stripping, auth isolation, Open Redirect & SSRF blocks", async ({
    request,
  }) => {
    // F-005: public-supply strips staffMembers & ownerMemberCode when unauthenticated
    const supplyRes = await request.get("/api/supabase/public-supply");
    expect(supplyRes.status()).toBe(200);
    const supplyJson = await supplyRes.json();
    if (Array.isArray(supplyJson.facilities)) {
      for (const fac of supplyJson.facilities) {
        expect(fac.staffMembers).toBeUndefined();
        expect(fac.ownerMemberCode).toBeUndefined();
      }
    }

    // F-007 & F-008: unauthenticated requests rejected cleanly with 401
    const ledgersGet = await request.get("/api/supabase/session-ledgers?memberCode=CAP-M-1000");
    expect(ledgersGet.status()).toBe(401);

    const userStateGet = await request.get(
      "/api/supabase/user-state?memberCode=CAP-M-1000&athleteIds=ath-1,ath-2"
    );
    expect(userStateGet.status()).toBe(401);

    // F-009: Open Redirect blocked with 400
    const openRedirectRes = await request.get("/api/places/photo?img=https://example.com/evil-logo.png", {
      maxRedirects: 0,
    });
    expect(openRedirectRes.status()).toBe(400);
    const openRedirectJson = await openRedirectRes.json();
    expect(openRedirectJson.error).toBe("untrusted_image_host");

    // F-009: SSRF bypasses blocked with 400
    for (const ssrfUrl of [
      "http://0.0.0.0:3000/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::ffff:127.0.0.1]/",
      "http://2130706433/",
    ]) {
      const imgRes = await request.get(
        `/api/places/photo?img=${encodeURIComponent(ssrfUrl)}`,
        { maxRedirects: 0 }
      );
      expect(imgRes.status(), `img SSRF check for ${ssrfUrl}`).toBe(400);

      const siteRes = await request.get(
        `/api/places/photo?website=${encodeURIComponent(ssrfUrl)}`,
        { maxRedirects: 0 }
      );
      expect(siteRes.status(), `website SSRF check for ${ssrfUrl}`).toBe(400);
    }

    // F-009: Trusted allowlisted Wikimedia image preserves 302 redirect
    const trustedRes = await request.get(
      "/api/places/photo?img=https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg",
      { maxRedirects: 0 }
    );
    expect(trustedRes.status()).toBe(302);
    expect(trustedRes.headers()["location"]).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg"
    );
  });

  test("F-015: Printable CR80 swimmer card escapes HTML/XSS payloads and enforces CSP", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // Capture window.open document.write buffer safely without closing
      (window as unknown as { __capturedPrintHtml?: string }).__capturedPrintHtml = "";
      window.open = (() => {
        return {
          focus: () => {},
          print: () => {},
          document: {
            open: () => {},
            write: (html: string) => {
              (window as unknown as { __capturedPrintHtml?: string }).__capturedPrintHtml += html;
            },
            close: () => {},
          },
        } as unknown as Window;
      }) as typeof window.open;

      const xssSwimmer = {
        id: "user-xss-p1",
        role: "adult_athlete",
        memberCode: "CAP-M-8888",
        shortLabelAr: "اختبار",
        fullNameAr: '<img src=x onerror="window.__xssFired=true">',
        personaTitleAr: "سباح",
        city: "القاهرة",
        phone: "01000000088",
        descriptionAr: "",
        needsOnboarding: false,
      };
      const xssLedger = {
        id: "led-xss-p1",
        ledgerCode: "CAP-SUB-8888",
        subscriptionCode: "CAP-SUB-8888",
        memberCode: "CAP-M-8888",
        athleteId: "user-xss-p1",
        athleteNameAr: '<img src=x onerror="window.__xssFired=true">',
        coachId: "coach-1",
        coachNameAr: '<script>window.__xssFired=true</script>',
        facilityId: "fac-1",
        facilityNameAr: '<b>نادي"اختبار</b>',
        sportSector: "swimming",
        packageTitleAr: "باقة 8 حصص",
        totalSessions: 8,
        completedSessions: 1,
        pinCode: "8888",
        status: "active",
        startedDateAr: "اليوم",
        checkins: [],
        receipts: [],
      };
      localStorage.setItem(
        "captenly_platform_state_v6",
        JSON.stringify({
          personaId: "user-xss-p1",
          allPersonas: [xssSwimmer],
          sessionLedgers: [xssLedger],
        })
      );
    });

    await page.goto("/dashboard/ledger", { waitUntil: "domcontentloaded" });
    const openCardBtn = page.getByRole("button", { name: /طباعة \/ تحميل كارت الحقيبة/i }).first();
    await openCardBtn.waitFor({ state: "visible", timeout: 15_000 });
    await openCardBtn.click();

    const printBtn = page.getByRole("button", { name: /طباعة \/ تحميل PDF للكارت/i }).first();
    await printBtn.waitFor({ state: "visible", timeout: 10_000 });
    await printBtn.click();

    const result = await page.evaluate(() => ({
      html: (window as unknown as { __capturedPrintHtml?: string }).__capturedPrintHtml || "",
      xssFired: Boolean((window as unknown as { __xssFired?: boolean }).__xssFired),
    }));

    expect(result.xssFired).toBe(false);
    expect(result.html).toContain('http-equiv="Content-Security-Policy"');
    expect(result.html).toContain("&lt;img src=x onerror=&quot;window.__xssFired=true&quot;&gt;");
    expect(result.html).toContain("&lt;script&gt;window.__xssFired=true&lt;/script&gt;");
    expect(result.html).not.toContain("<script>");
  });
});
