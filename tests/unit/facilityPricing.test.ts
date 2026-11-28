import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getFacilityBookablePackages,
  getFacilityStartingPriceEgp,
  resolveGovernorateFromCity,
  schoolProgramToPricePackage,
  toLedgerSessionBucket,
} from "@/lib/facilityPricing";

describe("facilityPricing: packages, starting price, hidden fees & buckets", () => {
  it("computes lowest positive monthly price across schoolPrograms and pricePackages", () => {
    const starting = getFacilityStartingPriceEgp({
      schoolPrograms: [
        {
          id: "sp-1",
          trackType: "buds",
          trackLabelAr: "البراعم",
          titleAr: "تأسيس",
          priceEgp: 0,
          scheduleAr: "السبت",
        },
        {
          id: "sp-2",
          trackType: "school",
          trackLabelAr: "مدرسة",
          titleAr: "مدرسة 8 حصص",
          priceEgp: 750,
          scheduleAr: "الأحد",
        },
      ],
      pricePackages: [
        {
          id: "pk-1",
          nameAr: "باقة التجهيزي",
          sessionsCount: 12,
          sessionsPerWeek: 3,
          durationMinutes: 60,
          baseMonthlyEgp: 680,
          assessmentFeeEgp: 50,
          membershipCardFeeEgp: 100,
          mandatoryKitFeeEgp: 0,
          companionFeeEgp: 25,
        },
      ],
    });
    assert.equal(starting, 680);

    assert.equal(
      getFacilityStartingPriceEgp({ schoolPrograms: [], pricePackages: [] }),
      0
    );
  });

  it("unifies and deduplicates schoolPrograms and pricePackages while auditing hidden fees", () => {
    const unified = getFacilityBookablePackages({
      schoolPrograms: [
        {
          id: "sp-1",
          trackType: "ladies",
          trackLabelAr: "",
          titleAr: "  سباحة سيدات 8 حصص ",
          sessionsPerMonth: 8,
          durationMinutes: 45,
          priceEgp: 900,
          scheduleAr: "الإثنين والأربعاء",
        },
      ],
      pricePackages: [
        {
          id: "pk-dup",
          nameAr: "سباحة سيدات 8 حصص",
          sessionsCount: 8,
          sessionsPerWeek: 2,
          durationMinutes: 45,
          baseMonthlyEgp: 900,
          assessmentFeeEgp: 100,
          membershipCardFeeEgp: 50,
          mandatoryKitFeeEgp: 200,
          companionFeeEgp: 30,
        },
        {
          id: "pk-unique",
          nameAr: "باقة البطولات",
          sessionsCount: 24,
          sessionsPerWeek: 6,
          durationMinutes: 90,
          baseMonthlyEgp: 1650,
          assessmentFeeEgp: -10,
          membershipCardFeeEgp: 120,
          mandatoryKitFeeEgp: 350,
          companionFeeEgp: 40,
        },
      ],
    });

    assert.equal(unified.length, 2);
    assert.equal(unified[0].source, "schoolProgram");
    assert.equal(unified[0].trackLabelAr, "مواعيد السيدات");
    assert.equal(unified[0].nameAr, "سباحة سيدات 8 حصص");

    assert.equal(unified[1].source, "pricePackage");
    assert.equal(unified[1].trackLabelAr, "باقة منشأة");
    assert.equal(unified[1].assessmentFeeEgp, 0);
    assert.equal(unified[1].membershipCardFeeEgp, 120);
    assert.equal(unified[1].mandatoryKitFeeEgp, 350);
    assert.equal(unified[1].companionFeeEgp, 40);
  });

  it("converts schoolProgram to PricePackage and maps session buckets & governorates", () => {
    const pkg = schoolProgramToPricePackage({
      id: "sp-9",
      trackType: "prep",
      trackLabelAr: "التجهيزي",
      titleAr: "تجهيزي 12 حصة",
      sessionsPerMonth: 12,
      durationMinutes: 20,
      priceEgp: 1100,
      scheduleAr: "الثلاثاء والخميس",
    });
    assert.equal(pkg.id, "pkg_prog_sp-9");
    assert.equal(pkg.sessionsCount, 12);
    assert.equal(pkg.sessionsPerWeek, 3);
    assert.equal(pkg.durationMinutes, 30);
    assert.equal(pkg.baseMonthlyEgp, 1100);

    assert.equal(toLedgerSessionBucket(4), 8);
    assert.equal(toLedgerSessionBucket(10), 12);
    assert.equal(toLedgerSessionBucket(19), 12);
    assert.equal(toLedgerSessionBucket(20), 24);
    assert.equal(toLedgerSessionBucket(24), 24);

    assert.equal(resolveGovernorateFromCity("طنطا"), "الغربية");
    assert.equal(resolveGovernorateFromCity("مدينة نصر الجديدة"), "القاهرة");
    assert.equal(resolveGovernorateFromCity("كل مصر"), "مصر");
    assert.equal(resolveGovernorateFromCity("غير معروفة", "افتراضي"), "افتراضي");
  });
});
