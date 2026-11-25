import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SAMPLE_FACILITY_1 = {
  id: "fac-f027-1",
  slug: "fac-f027-1",
  nameAr: "نادي النيل الأولمبي للسباحة والتدريب المائي",
  nameEn: "Nile Olympic Swim Club",
  facilityType: "swimming_academy",
  sportSector: "swimming",
  governorate: "القاهرة",
  city: "مدينة نصر",
  district: "الحي السابع",
  addressAr: "شارع الطيران",
  coordinates: { lat: 30.056, lng: 31.344 },
  supplyStatus: "verified_active",
  subscriptionTier: "pro",
  isFeaturedTier: true,
  isSponsored: false,
  priceLastVerifiedDaysAgo: 0,
  priceLastVerifiedDate: "اليوم",
  avgReplyMinutes: 10,
  completenessScore: 95,
  rating: 4.9,
  reviewsCount: 22,
  heroImage: "/screens/20b781f698f9.jpg",
  badges: [],
  specialtiesAr: ["تأسيس أطفال", "إعداد بطولات"],
  pricePackages: [{ id: "pkg-1", titleAr: "8 حصص", baseMonthlyEgp: 950, sessionsPerMonth: 8 }],
  affiliatedCoachIds: [],
  poolDeskConfig: { waterFeePerSessionEgp: 75 },
  monthlyMetrics: {
    profileViews: 10,
    comparisonAppearances: 4,
    verifiedWhatsappLeads: 2,
    activeSessionLedgers: 1,
  },
};

const SAMPLE_FACILITY_2 = {
  ...SAMPLE_FACILITY_1,
  id: "fac-f027-2",
  slug: "fac-f027-2",
  nameAr: "أكاديمية الدلتا المائية",
  nameEn: "Delta Aquatics",
  city: "طنطا",
  governorate: "الغربية",
  isFeaturedTier: false,
};

const FACILITY_MANAGER_PERSONA = {
  id: "user-f027-mgr",
  role: "facility_manager",
  memberCode: "CAP-M-9201",
  linkedFacilityId: "fac-f027-1",
  email: "mgr-f027@example.com",
  shortLabelAr: "أحمد",
  fullNameAr: "أحمد فؤاد",
  personaTitleAr: "مدير منشأة",
  city: "القاهرة",
  phone: "01099887766",
  descriptionAr: "",
  needsOnboarding: false,
};

const STAFF_MEMBER_PERSONA = {
  id: "user-f027-staff",
  role: "adult_athlete",
  memberCode: "CAP-M-9202",
  email: "staff-f027@example.com",
  shortLabelAr: "كريم",
  fullNameAr: "كريم نبيل",
  personaTitleAr: "عضو",
  city: "القاهرة",
  phone: "01055443322",
  descriptionAr: "",
  needsOnboarding: false,
};

test.describe("Phase 4 F-027: Homepage & UX Remediation", () => {
  test("F-027 (a,b,c): Adaptive homepage grid + CTA card, accurate counts (no 0 flash), 3-step offline QR journey, single h1 & zero axe critical/serious", async ({
    page,
  }, testInfo) => {
    // Intercept live network discovery to test deterministic 1-item & 2-item states without DB interference
    await page.route("**/api/supabase/public-supply*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, facilities: [SAMPLE_FACILITY_1], coaches: [], articles: [] }),
      });
    });
    await page.route("**/api/places/search*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, places: [] }),
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 });

    // No initial "(0)" flash on category filter or browse link
    await expect(page.getByText(/\(0\s*مسبح/)).toHaveCount(0);
    await expect(page.getByText(/الكل \(0\)/)).toHaveCount(0);

    // 1 facility state: accurate Arabic count + CTA registration card fills empty slot
    await expect(page.getByText(/منشأة واحدة/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/يتم عرض أقرب 3 مسابح/)).toHaveCount(0);
    await expect(page.getByText(/تظهر 3 منشآت/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /سجّل ووثّق منشأتك الآن/ })).toBeVisible();

    // 3-Step Visual Offline QR Ledger Journey visible on both desktop and mobile
    await expect(
      page.getByRole("heading", { name: "كيف يعمل دفتر الحصص QR أوفلاين في 3 خطوات؟" })
    ).toBeVisible();
    await expect(page.getByText("سجّل واستلم كود عضويتك وبطاقة QR")).toBeVisible();
    await expect(page.getByText("فعّل باقتك مع الكابتن أو إدارة المسبح").or(page.getByText("فعّل باقتك مع الكابتن أو المسبح بـ 0% عمولة"))).toBeVisible();
    await expect(page.getByText("امسح الحضور أوفلاين عند بوابة المسبح").or(page.getByText("امسح الحضور أوفلاين عند البوابة بمزامنة تلقائية"))).toBeVisible();
    await expect(page.getByRole("link", { name: /افتح دفتر الحصص الآن/ })).toBeVisible();

    // Single <h1> and zero horizontal overflow
    expect(await page.locator("h1:visible").count()).toBe(1);
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 4
    );
    expect(hasOverflow, `Overflow on ${testInfo.project.name}`).toBeFalsy();

    // Zero critical/serious axe violations
    const axe = await new AxeBuilder({ page }).analyze();
    const severe = axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(severe).toEqual([]);

    // 2 facilities state on desktop: grid-cols-3 with 2 cards + 1 CTA card and "منشأتين" subtitle
    if (testInfo.project.name === "desktop-chromium") {
      await page.route("**/api/supabase/public-supply*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            facilities: [SAMPLE_FACILITY_1, SAMPLE_FACILITY_2],
            coaches: [],
            articles: [],
          }),
        });
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(/منشأتين/)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("link", { name: /سجّل ووثّق منشأتك الآن/ })).toBeVisible();
    }
  });

  test("F-027 (d): PoolDesk promo expiry uses localized Arabic DD/MM/YYYY input while preserving ISO YYYY-MM-DD", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ persona, facility }) => {
        localStorage.setItem(
          "captenly_platform_state_v6",
          JSON.stringify({
            personaId: persona.id,
            allPersonas: [persona],
            facilities: [facility],
          })
        );
      },
      { persona: FACILITY_MANAGER_PERSONA, facility: SAMPLE_FACILITY_1 }
    );

    await page.goto("/dashboard/facility?tab=desk_settings", { waitUntil: "domcontentloaded" });
    const expiryInput = page.locator("#promo-expiry-input");
    await expect(expiryInput).toBeVisible({ timeout: 15_000 });
    await expect(expiryInput).toHaveAttribute("type", "text");
    await expect(page.getByText(/يوم\/شهر\/سنة/).first()).toBeVisible();
    await expect(page.getByText(/mm\/dd\/yyyy/i)).toHaveCount(0);

    // Invalid calendar date rejected cleanly in Arabic
    await page.locator('input[placeholder="SIBLING20"]').fill("POOL20");
    await expiryInput.fill("31/02/2026");
    await page.getByRole("button", { name: /\+ إنشاء وحفظ كود الخصم/ }).click();
    await expect(page.getByText(/يرجى إدخال تاريخ انتهاء صحيح بصيغة يوم\/شهر\/سنة/).first()).toBeVisible();

    // Valid DD/MM/YYYY date saves ISO YYYY-MM-DD and displays DD/MM/YYYY
    await expiryInput.fill("31/12/2026");
    await page.getByRole("button", { name: /\+ إنشاء وحفظ كود الخصم/ }).click();
    await expect(page.getByText("POOL20", { exact: true })).toBeVisible();
    await expect(page.getByText("31/12/2026").first()).toBeVisible();

    const storedIso = await page.evaluate(() => {
      const raw = localStorage.getItem("captenly_platform_state_v6");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const fac = (parsed.facilities || []).find((f: { id: string }) => f.id === "fac-f027-1");
      return fac?.poolDeskConfig?.promoCodes?.find((p: { code: string }) => p.code === "POOL20")?.expiresAtIso || null;
    });
    expect(storedIso).toBe("2026-12-31");
  });

  test("F-027 (e): SiteHeader shortens staff nav tab and truncates staff role/facility pill cleanly", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "SiteHeader is desktop-only");

    const facilityWithStaff = {
      ...SAMPLE_FACILITY_1,
      staffMembers: [
        {
          id: "staff-f027-1",
          facilityId: "fac-f027-1",
          facilityNameAr: SAMPLE_FACILITY_1.nameAr,
          fullNameAr: "كريم نبيل",
          linkedMemberCode: "CAP-M-9202",
          role: "subscriptions_manager",
          roleTitleAr: "مسؤول اشتراكات وبوابة",
          invitationStatus: "accepted",
          isActive: true,
        },
      ],
    };

    await page.addInitScript(
      ({ persona, facility }) => {
        localStorage.setItem(
          "captenly_platform_state_v6",
          JSON.stringify({
            personaId: persona.id,
            allPersonas: [persona],
            facilities: [facility],
            activeStaffAssignmentId: "staff-f027-1",
          })
        );
      },
      { persona: STAFF_MEMBER_PERSONA, facility: facilityWithStaff }
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const header = page.locator("header").first();
    await expect(header.getByRole("link", { name: "لوحة المنشأة" })).toBeVisible({ timeout: 15_000 });
    await expect(header.getByText(/لوحة نادي النيل الأولمبي/)).toHaveCount(0);

    const staffBadge = header.locator('a[title*="وضع موظف"]');
    await expect(staffBadge).toBeVisible();
    await expect(staffBadge).toContainText("مسؤول اشتراكات وبوابة • نادي النيل الأولمبي");

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 4
    );
    expect(hasOverflow).toBeFalsy();
  });
});
