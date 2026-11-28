import { expect, test } from "@playwright/test";

const SEED_ATHLETE_PERSONA = {
  id: "user-reg-ath",
  role: "adult_athlete",
  memberCode: "CAP-M-7101",
  email: "reg-athlete@example.com",
  shortLabelAr: "سيف",
  fullNameAr: "سيف محمود",
  personaTitleAr: "سبّاح",
  city: "طنطا",
  phone: "01012345678",
  descriptionAr: "",
  needsOnboarding: false,
};

const SEED_FACILITY_MANAGER = {
  id: "user-reg-facmgr",
  role: "facility_manager",
  memberCode: "CAP-M-7102",
  linkedFacilityId: "fac-reg-pool",
  email: "reg-facmgr@example.com",
  shortLabelAr: "طارق",
  fullNameAr: "طارق حسن",
  personaTitleAr: "مدير منشأة",
  city: "طنطا",
  phone: "01022345678",
  descriptionAr: "",
  needsOnboarding: false,
};

const SEED_FACILITY = {
  id: "fac-reg-pool",
  slug: "qa-pluscode-pool",
  nameAr: "أكاديمية الدلتا للسباحة",
  nameEn: "Delta Swim Academy",
  facilityType: "swimming_academy",
  sportSector: "swimming",
  governorate: "الغربية",
  city: "طنطا",
  district: "الاستاد",
  addressAr: "X529+F73، شارع البحر، طنطا",
  coordinates: { lat: 30.7865, lng: 31.0004 },
  locations: [
    {
      id: "loc-reg-1",
      labelAr: "فرع الاستاد",
      governorate: "الغربية",
      city: "طنطا",
      district: "الاستاد",
      addressAr: "شارع الجيشX529+F73طنطا",
      coordinates: { lat: 30.7865, lng: 31.0004 },
    },
  ],
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
  pricePackages: [
    {
      id: "pkg-reg-1",
      nameAr: "8 حصص تأسيس",
      sessionsCount: 8,
      sessionsPerWeek: 2,
      durationMinutes: 60,
      baseMonthlyEgp: 900,
      assessmentFeeEgp: 0,
      membershipCardFeeEgp: 0,
      mandatoryKitFeeEgp: 0,
      companionFeeEgp: 0,
    },
  ],
  affiliatedCoachIds: [],
  poolDeskConfig: { waterFeePerSessionEgp: 70 },
  monthlyMetrics: {
    profileViews: 10,
    comparisonAppearances: 5,
    verifiedWhatsappLeads: 2,
    activeSessionLedgers: 1,
  },
};

const SEED_LEDGER = {
  id: "led-reg-1",
  ledgerCode: "SUB-7101-A1",
  subscriptionCode: "SUB-7101-A1",
  memberCode: "CAP-M-7101",
  athleteId: "user-reg-ath",
  athleteNameAr: "سيف محمود",
  coachId: "coach-reg-1",
  coachNameAr: "كابتن شريف",
  facilityId: "fac-reg-pool",
  facilityNameAr: "أكاديمية الدلتا للسباحة",
  sportSector: "swimming",
  packageTitleAr: "باقة 8 حصص تأسيس",
  totalSessions: 8,
  completedSessions: 3,
  pinCode: "4829",
  status: "active",
  isCodeExpired: false,
  startedDateAr: "اليوم",
  checkins: [],
  receipts: [
    {
      id: "rcp-reg-1",
      referenceNumber: "INSTA-9901",
      channel: "إنستاباي (InstaPay)",
      amountEgp: 900,
      uploadedDateAr: "اليوم",
      confirmedByProvider: true,
      packageTitleAr: "باقة 8 حصص تأسيس",
    },
  ],
};

test.describe("Remediation Regression Suite (GAP-001..GAP-021 & GAP-008)", () => {
  test("1. /pools renders single <main> landmark and zero horizontal overflow", async ({ page }) => {
    await page.goto("/pools", { waitUntil: "domcontentloaded" });
    await page.locator("main").first().waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });

    const mainCount = await page.locator("main").count();
    expect(mainCount).toBe(1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("2. /academy/* strips raw Plus Code X529+F73 from rendered address", async ({ page }) => {
    await page.addInitScript(
      ({ persona, facilities }) => {
        localStorage.setItem(
          "captenly_platform_state_v6",
          JSON.stringify({
            personaId: persona.id,
            allPersonas: [persona],
            facilities,
          })
        );
      },
      { persona: SEED_ATHLETE_PERSONA, facilities: [SEED_FACILITY] }
    );

    await page.goto("/academy/qa-pluscode-pool", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /أكاديمية الدلتا للسباحة/i })
    ).toBeVisible({ timeout: 15_000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("X529+F73");
    expect(bodyText).toContain("طنطا");
  });

  test("3. Logged-in desktop SiteHeader keeps /coaches navigation visible (GAP-019)", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "Desktop SiteHeader check");

    await page.addInitScript(
      ({ persona, facilities }) => {
        localStorage.setItem(
          "captenly_platform_state_v6",
          JSON.stringify({
            personaId: persona.id,
            allPersonas: [persona],
            facilities,
          })
        );
      },
      { persona: SEED_ATHLETE_PERSONA, facilities: [SEED_FACILITY] }
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const coachesLink = page.locator('header nav a[href="/coaches"]');
    await expect(coachesLink).toBeVisible({ timeout: 15_000 });

    const box = await coachesLink.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(20);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1366);
  });

  test("4. /dashboard/athlete/settings/history opens accessible receipt modal without window.alert (GAP-018)", async ({
    page,
  }) => {
    const dialogs: string[] = [];
    page.on("dialog", (d) => {
      dialogs.push(`${d.type()}:${d.message()}`);
      void d.dismiss();
    });

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
      { persona: SEED_ATHLETE_PERSONA, facilities: [SEED_FACILITY], ledger: SEED_LEDGER }
    );

    await page.goto("/dashboard/athlete/settings/history", { waitUntil: "domcontentloaded" });
    const viewBtn = page.getByRole("button", { name: "عرض الإيصال" }).first();
    await expect(viewBtn).toBeVisible({ timeout: 15_000 });
    await viewBtn.click();

    const dialog = page.getByRole("dialog", { name: "إيصال دفع موثق" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("INSTA-9901")).toBeVisible();
    expect(dialogs).toEqual([]);

    await dialog.getByRole("button", { name: "إغلاق", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("5a. Mobile /dashboard/ledger (P5) shows swimmer's own 4-digit PIN (GAP-002)", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Mobile P5 swimmer PIN visibility check");

    await page.route("**/api/supabase/session-ledgers**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ persisted: true, ledgers: [SEED_LEDGER], hasMore: false }),
      });
    });

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
      { persona: SEED_ATHLETE_PERSONA, facilities: [SEED_FACILITY], ledger: SEED_LEDGER }
    );

    await page.goto("/dashboard/ledger", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("PIN 4829").first()).toBeVisible({ timeout: 15_000 });
  });

  test("5b. Desktop Gate Kiosk accepts 4-digit PIN online & surfaces truthful failure + retry badge on 403/500 (GAP-001, GAP-002)", async ({
    page,
    context,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "Desktop Gate Kiosk check");

    await page.route("**/api/supabase/session-ledgers**", async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            persisted: true,
            ledgers: [{ ...SEED_LEDGER, pinCode: "****" }],
            hasMore: false,
          }),
        });
        return;
      }
      const postBody = request.postDataJSON() as { action?: string; pinCode?: string };
      if (postBody?.action === "pin_checkin" && postBody?.pinCode === "4829") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            persisted: true,
            ledger: { ...SEED_LEDGER, pinCode: "****", completedSessions: 4 },
            messageAr: "تم خصم الحصة رقم (4 من 8) للمشترك سيف محمود عبر الـ PIN بنجاح",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          persisted: false,
          error: "forbidden",
          messageAr: "لا تملك صلاحية مزامنة هذه الحصة على السيرفر.",
        }),
      });
    });

    await page.route("**/api/supabase/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, persisted: true }),
      });
    });

    await page.addInitScript(
      ({ persona, facilities, ledger }) => {
        localStorage.setItem(
          "captenly_platform_state_v6",
          JSON.stringify({
            personaId: persona.id,
            allPersonas: [persona],
            facilities,
            sessionLedgers: [{ ...ledger, pinCode: "****" }],
            offlineQueue: [
              {
                id: "oq-fail-1",
                clientEventId: "evt-fail-1",
                kind: "checkin",
                ledgerId: ledger.id,
                athleteNameAr: ledger.athleteNameAr,
                sessionNumber: 4,
                method: "offline_sync",
                syncStatus: "pending",
                retryCount: 0,
                coachNoteAr: "حضور أوفلاين",
                queuedAtIso: new Date().toISOString(),
                synced: false,
              },
            ],
          })
        );
      },
      { persona: SEED_FACILITY_MANAGER, facilities: [SEED_FACILITY], ledger: SEED_LEDGER }
    );

    await page.goto("/dashboard/facility/gate", { waitUntil: "domcontentloaded" });
    await page.getByTestId("pool-gate-kiosk").waitFor({ state: "visible", timeout: 15_000 });

    // Auto-sync hits mocked 403 and surfaces failed retry badge + truthful error banner
    await expect(
      page.getByRole("button", { name: /إعادة محاولة \(1\) عملية متعثرة/ })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/لا تملك صلاحية مزامنة هذه الحصة/).first()).toBeVisible();

    // Online 4-digit PIN check-in succeeds via server action="pin_checkin" even though client PIN was masked
    const input = page.getByPlaceholder(/اكتب كود الاشتراك.*PIN/);
    await input.fill("4829");
    await page.getByRole("button", { name: "فحص وتسجيل دخول" }).click();
    await expect(page.getByText(/دخول مسموح — تم خصم الحصة بالـ PIN بنجاح/)).toBeVisible({
      timeout: 15_000,
    });

    // Offline toggle shows truthful offline banner when PIN is attempted offline
    await context.setOffline(true);
    await expect(page.getByText(/وضع البوابة أوفلاين/)).toBeVisible({ timeout: 10_000 });
    await input.fill("4829");
    await page.getByRole("button", { name: "فحص وتسجيل دخول" }).click();
    await expect(page.getByText(/التحقق برمز الـ PIN يتطلب اتصالاً بالإنترنت/).first()).toBeVisible();
    await context.setOffline(false);
  });

  test("6. /admin Simulation Lab does not crash when sessionLedgers is empty (GAP-016)", async ({
    page,
  }) => {
    await page.route("**/api/auth/admin-verify", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ configured: true, authorized: true }),
      });
    });
    await page.route("**/api/supabase/role-claims**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, claims: [] }),
      });
    });
    await page.route("**/api/supabase/demand-radar**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, items: [], totalCount: 0 }),
      });
    });

    await page.addInitScript(
      ({ persona, facilities }) => {
        localStorage.setItem(
          "captenly_platform_state_v6",
          JSON.stringify({
            personaId: persona.id,
            allPersonas: [persona],
            facilities,
            sessionLedgers: [],
          })
        );
      },
      { persona: SEED_ATHLETE_PERSONA, facilities: [SEED_FACILITY] }
    );

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/معمل المحاكاة التفاعلي/)).toBeVisible({ timeout: 15_000 });

    const simBtn = page.getByRole("button", { name: /تشغيل.*7/i }).first();
    if (await simBtn.isVisible().catch(() => false)) {
      await simBtn.click();
      await expect(page.getByText(/لا توجد دفاتر حصص نشطة حالياً للمحاكاة/)).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test("7. AthleteProfileSocialEditor shows Law 3/1985 error instead of 'تم الحفظ ✓' on prohibited bio (GAP-010)", async ({
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
          })
        );
      },
      { persona: SEED_ATHLETE_PERSONA, facilities: [SEED_FACILITY] }
    );

    await page.goto("/dashboard/athlete/settings", { waitUntil: "domcontentloaded" });
    const bioTextarea = page.getByPlaceholder(/سبّاح حرة وفراشة/);
    await expect(bioTextarea).toBeVisible({ timeout: 15_000 });
    await bioTextarea.fill("أخصائي علاج طبيعي وتأهيل إصابات طبية");

    await page.getByRole("button", { name: /حفظ النبذة وروابط التواصل/ }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("تم الحفظ ✓")).toHaveCount(0);
  });

  test("8. /dashboard/athlete/settings/notifications loads WhatsApp status, test action & delivery log", async ({
    page,
  }) => {
    await page.route("**/api/notifications/whatsapp**", async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            providerStatus: {
              configured: false,
              provider: "meta_whatsapp_cloud",
              mode: "test_sandbox",
              templateLang: "ar",
              webhookConfigured: false,
              cronConfigured: false,
              freeTierNoteAr: "محرك إشعارات واتساب وسجلات الإرسال مفعّل على الخادم.",
            },
            dispatches: [
              {
                id: "wa-1",
                dedupeKey: "attendance_checkin:CAP-M-7701:led-1:2026-11-28",
                eventType: "attendance_checkin",
                recipientMemberCode: "CAP-M-7701",
                recipientPhoneMasked: "****5678",
                messagePreviewAr: "كابتنلي: تم تسجيل حضور السبّاح سيف محمود في أكاديمية الموج الأزرق",
                deliveryStatus: "delivered",
                attemptCount: 1,
                createdAt: "2026-11-28T10:00:00.000Z",
              },
            ],
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          deliveryStatus: "sent",
          messageAr: "تم إرسال إشعار واتساب عبر الخادم بنجاح ✓",
        }),
      });
    });

    await page.addInitScript(
      ({ persona, facilities }) => {
        localStorage.setItem(
          "captenly_platform_state_v6",
          JSON.stringify({
            personaId: persona.id,
            allPersonas: [persona],
            facilities,
          })
        );
      },
      { persona: SEED_ATHLETE_PERSONA, facilities: [SEED_FACILITY] }
    );

    await page.goto("/dashboard/athlete/settings/notifications", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("سجل إشعارات واتساب وحالة التسليم")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("تم التسليم ✓")).toBeVisible();

    await page.getByRole("button", { name: "إرسال رسالة تجريبية" }).click();
    await expect(page.getByText("تم إرسال إشعار واتساب عبر الخادم بنجاح ✓")).toBeVisible();
  });

  test("9. /magazine persists newsletter subscription to /api/supabase/newsletter (GAP-017)", async ({
    page,
  }) => {
    let submittedEmail = "";
    await page.route("**/api/supabase/newsletter", async (route, request) => {
      const payload = request.postDataJSON() as { email?: string };
      submittedEmail = payload?.email || "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          persisted: true,
          messageAr: "تم تسجيل بريدك الإلكتروني بنجاح في قائمة نشرة كابتنلي الرياضية ✓",
        }),
      });
    });

    await page.goto("/magazine", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    const emailInput = page.getByPlaceholder("أدخل بريدك الإلكتروني...");
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
    await emailInput.fill("swimmer.test@example.com");
    await page.getByRole("button", { name: "حفظ البريد للتحديثات المستقبلية" }).click();

    await expect(
      page.getByText(/تم تسجيل بريدك الإلكتروني بنجاح في قائمة نشرة كابتنلي الرياضية/)
    ).toBeVisible({ timeout: 10_000 });
    expect(submittedEmail).toBe("swimmer.test@example.com");
  });
});
