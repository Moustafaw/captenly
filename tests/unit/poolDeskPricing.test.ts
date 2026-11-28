import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAcademySettlementSummary,
  calculateEnrollmentBreakdown,
  DEFAULT_OPEN_DISCOUNT_REASONS,
  DUPLICATE_SCAN_WINDOW_MS,
  evaluateLedgerGateStatus,
  getFacilityPoolDeskConfig,
  resolveCoachScanPermission,
  toPricingSnapshot,
} from "@/lib/poolDeskPricing";
import type { Facility, FacilityPromoCode, SessionLedger } from "@/types/captenly";

function makePromo(overrides: Partial<FacilityPromoCode> = {}): FacilityPromoCode {
  return {
    id: "promo-1",
    code: "SWIM20",
    discountType: "percent",
    value: 20,
    isActive: true,
    usedCount: 0,
    createdAtIso: "2026-11-27T08:00:00Z",
    ...overrides,
  };
}

function makeLedger(overrides: Partial<SessionLedger> = {}): SessionLedger {
  return {
    id: "led-1",
    ledgerCode: "SUB-1001-A1",
    subscriptionCode: "SUB-1001-A1",
    memberCode: "CAP-M-1001",
    athleteId: "ath-1",
    athleteNameAr: "يوسف طارق",
    isMinor: false,
    coachId: "coach-1",
    coachNameAr: "كابتن شريف",
    facilityId: "fac-1",
    facilityNameAr: "نادي الموج الأزرق",
    sportSector: "swimming",
    packageTitleAr: "باقة 8 حصص",
    totalSessions: 8,
    completedSessions: 2,
    pinCode: "4829",
    status: "active",
    isCodeExpired: false,
    startedDateAr: "اليوم",
    checkins: [],
    receipts: [],
    ...overrides,
  };
}

describe("poolDeskPricing: enrollment pricing, promos, gate status & settlements", () => {
  it("normalizes missing facility poolDeskConfig safely", () => {
    const cfg = getFacilityPoolDeskConfig(null);
    assert.equal(cfg.waterFeePerSessionEgp, 0);
    assert.equal(cfg.allowOpenManualDiscount, true);
    assert.deepEqual(cfg.openDiscountReasonsAr, DEFAULT_OPEN_DISCOUNT_REASONS);
    assert.deepEqual(cfg.promoCodes, []);
    assert.deepEqual(cfg.linkedEntities, []);

    const negCfg = getFacilityPoolDeskConfig({
      poolDeskConfig: {
        waterFeePerSessionEgp: -50,
        allowOpenManualDiscount: false,
        promoCodes: [],
        linkedEntities: [],
      },
    });
    assert.equal(negCfg.waterFeePerSessionEgp, 0);
    assert.equal(negCfg.allowOpenManualDiscount, false);
  });

  it("computes per-swimmer water fee vs fixed_monthly agreement", () => {
    const perSwimmer = calculateEnrollmentBreakdown({
      totalSessions: 8,
      waterFeePerSessionEgp: 75,
      trainingFeeEgp: 600,
      agreementType: "per_swimmer_water",
      discountMode: "none",
    });
    assert.equal(perSwimmer.waterTotalEgp, 600);
    assert.equal(perSwimmer.trainingFeeEgp, 600);
    assert.equal(perSwimmer.grossTotalEgp, 1200);
    assert.equal(perSwimmer.netTotalEgp, 1200);

    const fixedMonthly = calculateEnrollmentBreakdown({
      totalSessions: 12,
      waterFeePerSessionEgp: 75,
      trainingFeeEgp: 900,
      agreementType: "fixed_monthly",
      discountMode: "none",
    });
    assert.equal(fixedMonthly.waterTotalEgp, 0);
    assert.equal(fixedMonthly.grossTotalEgp, 900);
    assert.equal(fixedMonthly.netTotalEgp, 900);
  });

  it("applies valid percent and fixed promo codes and clamps over-100% / over-gross values", () => {
    const pct = calculateEnrollmentBreakdown({
      totalSessions: 8,
      waterFeePerSessionEgp: 50,
      trainingFeeEgp: 600,
      discountMode: "promo_code",
      promoCode: makePromo({ code: "SAVE25", discountType: "percent", value: 25 }),
    });
    assert.equal(pct.discountSource, "promo_code");
    assert.equal(pct.discountAmountEgp, 250);
    assert.equal(pct.netTotalEgp, 750);
    assert.equal(pct.promoCodeUsed, "SAVE25");
    assert.equal(pct.promoValidationErrorAr, undefined);

    const overPct = calculateEnrollmentBreakdown({
      totalSessions: 8,
      waterFeePerSessionEgp: 50,
      trainingFeeEgp: 600,
      discountMode: "promo_code",
      promoCode: makePromo({ code: "MAX", discountType: "percent", value: 150 }),
    });
    assert.equal(overPct.discountAmountEgp, 1000);
    assert.equal(overPct.netTotalEgp, 0);

    const fixed = calculateEnrollmentBreakdown({
      totalSessions: 8,
      waterFeePerSessionEgp: 50,
      trainingFeeEgp: 400,
      discountMode: "promo_code",
      promoCode: makePromo({ code: "FLAT200", discountType: "fixed_egp", value: 200 }),
    });
    assert.equal(fixed.discountAmountEgp, 200);
    assert.equal(fixed.netTotalEgp, 600);
  });

  it("rejects missing, inactive, maxUses-exhausted, and expired promo codes", () => {
    const missing = calculateEnrollmentBreakdown({
      totalSessions: 8,
      waterFeePerSessionEgp: 50,
      trainingFeeEgp: 500,
      discountMode: "promo_code",
      promoCode: null,
    });
    assert.equal(missing.discountSource, "none");
    assert.ok(missing.promoValidationErrorAr);

    const inactive = calculateEnrollmentBreakdown({
      totalSessions: 8,
      waterFeePerSessionEgp: 50,
      trainingFeeEgp: 500,
      discountMode: "promo_code",
      promoCode: makePromo({ isActive: false }),
    });
    assert.equal(inactive.discountSource, "none");
    assert.match(inactive.promoValidationErrorAr || "", /متوقف/);

    const exhausted = calculateEnrollmentBreakdown({
      totalSessions: 8,
      waterFeePerSessionEgp: 50,
      trainingFeeEgp: 500,
      discountMode: "promo_code",
      promoCode: makePromo({ maxUses: 5, usedCount: 5 }),
    });
    assert.equal(exhausted.discountSource, "none");
    assert.match(exhausted.promoValidationErrorAr || "", /للحد الأقصى/);

    const expired = calculateEnrollmentBreakdown({
      totalSessions: 8,
      waterFeePerSessionEgp: 50,
      trainingFeeEgp: 500,
      discountMode: "promo_code",
      promoCode: makePromo({ expiresAtIso: "2020-01-15" }),
    });
    assert.equal(expired.discountSource, "none");
    assert.match(expired.promoValidationErrorAr || "", /انتهت صلاحية/);

    const futureValid = calculateEnrollmentBreakdown({
      totalSessions: 8,
      waterFeePerSessionEgp: 50,
      trainingFeeEgp: 500,
      discountMode: "promo_code",
      promoCode: makePromo({ expiresAtIso: "2099-12-31", maxUses: 10, usedCount: 9 }),
    });
    assert.equal(futureValid.discountSource, "promo_code");
    assert.equal(futureValid.promoValidationErrorAr, undefined);
  });

  it("handles open manual discounts and pricing snapshot conversion", () => {
    const open = calculateEnrollmentBreakdown({
      totalSessions: 8,
      waterFeePerSessionEgp: 50,
      trainingFeeEgp: 400,
      discountMode: "open_manual",
      openDiscountType: "fixed_egp",
      openDiscountValue: 150,
      openDiscountReasonAr: "   ",
    });
    assert.equal(open.discountSource, "open_manual");
    assert.equal(open.discountAmountEgp, 150);
    assert.equal(open.netTotalEgp, 650);
    assert.equal(open.discountReasonAr, "خصم مفتوح من الإدارة");

    const zeroOpen = calculateEnrollmentBreakdown({
      totalSessions: 8,
      waterFeePerSessionEgp: 50,
      trainingFeeEgp: 400,
      discountMode: "open_manual",
      openDiscountType: "fixed_egp",
      openDiscountValue: 0,
    });
    assert.equal(zeroOpen.discountSource, "none");
    assert.equal(zeroOpen.discountAmountEgp, 0);

    const snap = toPricingSnapshot(open, "fixed_egp", 150, "partial");
    assert.equal(snap.netTotalEgp, 650);
    assert.equal(snap.waterPaidStatus, "partial");
    assert.ok(!Number.isNaN(Date.parse(snap.capturedAtIso)));
  });

  it("evaluates gate scan verdicts: valid, last_session, duplicate_3h, expired", () => {
    const now = Date.parse("2026-11-27T12:00:00Z");

    const valid = evaluateLedgerGateStatus(
      makeLedger({
        totalSessions: 8,
        completedSessions: 2,
        checkins: [
          {
            sessionNumber: 2,
            dateAr: "أمس",
            method: "qr_scan",
            verifiedByAr: "البوابة",
            coachNoteAr: "",
            wasOffline: false,
            scannedAtIso: new Date(now - DUPLICATE_SCAN_WINDOW_MS - 60_000).toISOString(),
          },
        ],
      }),
      now
    );
    assert.equal(valid.verdict, "valid");
    assert.equal(valid.remainingSessions, 6);

    const dup = evaluateLedgerGateStatus(
      makeLedger({
        totalSessions: 8,
        completedSessions: 2,
        checkins: [
          {
            sessionNumber: 2,
            dateAr: "منذ ساعة",
            method: "qr_scan",
            verifiedByAr: "البوابة",
            coachNoteAr: "",
            wasOffline: false,
            scannedAtIso: new Date(now - 30 * 60_000).toISOString(),
          },
        ],
      }),
      now
    );
    assert.equal(dup.verdict, "duplicate_3h");
    assert.equal(dup.minutesSinceLastScan, 30);

    const last = evaluateLedgerGateStatus(
      makeLedger({ totalSessions: 8, completedSessions: 7, status: "renewal_due" }),
      now
    );
    assert.equal(last.verdict, "last_session");
    assert.equal(last.remainingSessions, 1);

    const expired = evaluateLedgerGateStatus(
      makeLedger({ totalSessions: 8, completedSessions: 8, status: "completed", isCodeExpired: true }),
      now
    );
    assert.equal(expired.verdict, "expired");
    assert.equal(expired.remainingSessions, 0);
  });

  it("builds academy settlement summary and resolves coach scan permission", () => {
    const facility = {
      id: "fac-1",
      nameAr: "نادي النيل",
      poolDeskConfig: {
        waterFeePerSessionEgp: 60,
        allowOpenManualDiscount: true,
        promoCodes: [],
        linkedEntities: [
          {
            id: "link-1",
            facilityId: "fac-1",
            facilityNameAr: "نادي النيل",
            entityKind: "academy",
            linkedCoachId: "coach-a",
            linkedMemberCode: "CAP-C-100",
            displayNameAr: "أكاديمية الدلفين",
            agreementType: "per_swimmer_water",
            customWaterFeePerSessionEgp: 80,
            direction: "added_by_facility",
            status: "approved",
            canScanGroupQr: true,
            collectedMonthlyEgp: 200,
            createdAtAr: "اليوم",
            createdAtIso: "2026-11-27T08:00:00Z",
          },
          {
            id: "link-2",
            facilityId: "fac-1",
            facilityNameAr: "نادي النيل",
            entityKind: "academy",
            linkedCoachId: "coach-b",
            displayNameAr: "أكاديمية ثابتة",
            agreementType: "fixed_monthly",
            fixedMonthlyAmountEgp: 5000,
            collectedMonthlyEgp: 3000,
            direction: "added_by_facility",
            status: "approved",
            canScanGroupQr: false,
            createdAtAr: "اليوم",
            createdAtIso: "2026-11-27T08:00:00Z",
          },
        ],
      },
    } as unknown as Facility;

    const ledgers = [
      makeLedger({
        id: "l1",
        linkedEntityId: "link-1",
        coachId: "coach-a",
        totalSessions: 8,
        completedSessions: 3,
      }),
      makeLedger({
        id: "l2",
        coachId: "coach-direct",
        totalSessions: 8,
        completedSessions: 1,
        pricingSnapshot: {
          waterFeePerSessionEgp: 60,
          waterTotalEgp: 480,
          trainingFeeEgp: 520,
          grossTotalEgp: 1000,
          discountSource: "none",
          discountAmountEgp: 0,
          netTotalEgp: 1000,
          waterPaidStatus: "paid",
          capturedAtIso: "2026-11-27T08:00:00Z",
        },
      }),
    ];

    const summary = buildAcademySettlementSummary(facility, ledgers);
    assert.equal(summary.length, 3);
    assert.equal(summary[0].entityId, "link-1");
    assert.equal(summary[0].dueAmountEgp, 640);
    assert.equal(summary[0].collectedAmountEgp, 200);
    assert.equal(summary[0].remainingAmountEgp, 440);
    assert.equal(summary[1].dueAmountEgp, 5000);
    assert.equal(summary[1].remainingAmountEgp, 2000);
    assert.equal(summary[2].entityId, "direct-club-schools");
    assert.equal(summary[2].dueAmountEgp, 1000);

    assert.deepEqual(
      resolveCoachScanPermission({ facility, coachMemberCode: "cap-c-100" }),
      {
        isLinked: true,
        canScanGroupQr: true,
        linkEntry: facility.poolDeskConfig!.linkedEntities[0],
      }
    );
    assert.deepEqual(resolveCoachScanPermission({ facility, coachId: "coach-b" }), {
      isLinked: true,
      canScanGroupQr: false,
      linkEntry: facility.poolDeskConfig!.linkedEntities[1],
    });
    assert.deepEqual(resolveCoachScanPermission({ facility, coachId: "coach-unknown" }), {
      isLinked: false,
      canScanGroupQr: false,
    });
  });
});
