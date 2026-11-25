import type {
  AcademyAgreementType,
  Facility,
  FacilityDiscountType,
  FacilityLinkedEntity,
  FacilityPoolDeskConfig,
  FacilityPromoCode,
  LedgerPricingSnapshot,
  SessionCheckin,
  SessionLedger,
} from "@/types/captenly";

export const DEFAULT_OPEN_DISCOUNT_REASONS = [
  "خصم إخوة",
  "منحة رياضية",
  "تعويض حصة",
  "خصم خاص من الإدارة",
];

export const DUPLICATE_SCAN_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Returns normalized Pool Desk configuration for any facility without hardcoding fixed prices.
 */
export function getFacilityPoolDeskConfig(facility?: Partial<Facility> | null): FacilityPoolDeskConfig {
  const cfg = facility?.poolDeskConfig;
  return {
    waterFeePerSessionEgp: Math.max(0, Number(cfg?.waterFeePerSessionEgp ?? 0)),
    allowOpenManualDiscount: cfg?.allowOpenManualDiscount ?? true,
    openDiscountReasonsAr:
      Array.isArray(cfg?.openDiscountReasonsAr) && cfg.openDiscountReasonsAr.length > 0
        ? cfg.openDiscountReasonsAr
        : DEFAULT_OPEN_DISCOUNT_REASONS,
    promoCodes: Array.isArray(cfg?.promoCodes) ? cfg.promoCodes : [],
    linkedEntities: Array.isArray(cfg?.linkedEntities) ? cfg.linkedEntities : [],
    lastUpdatedIso: cfg?.lastUpdatedIso,
    lastShiftPreppedAtIso: cfg?.lastShiftPreppedAtIso,
  };
}

export interface EnrollmentCalculationInput {
  totalSessions: number;
  waterFeePerSessionEgp: number;
  trainingFeeEgp: number;
  agreementType?: AcademyAgreementType;
  discountMode: "none" | "promo_code" | "open_manual";
  promoCode?: FacilityPromoCode | null;
  openDiscountType?: FacilityDiscountType;
  openDiscountValue?: number;
  openDiscountReasonAr?: string;
}

export interface EnrollmentCalculationResult {
  waterFeePerSessionEgp: number;
  waterTotalEgp: number;
  trainingFeeEgp: number;
  grossTotalEgp: number;
  discountSource: "promo_code" | "open_manual" | "none";
  discountAmountEgp: number;
  netTotalEgp: number;
  promoCodeUsed?: string;
  discountReasonAr?: string;
  promoValidationErrorAr?: string;
}

/**
 * Computes transparent dynamic subscription breakdown:
 * (Sessions x Facility Water Fee + Training Fee) - Discount = Net Total.
 */
export function calculateEnrollmentBreakdown(
  input: EnrollmentCalculationInput
): EnrollmentCalculationResult {
  const sessions = Math.max(1, Number(input.totalSessions || 8));
  const unitWater = Math.max(0, Number(input.waterFeePerSessionEgp || 0));
  const waterTotalEgp =
    input.agreementType === "fixed_monthly" ? 0 : Math.round(sessions * unitWater);
  const trainingFeeEgp = Math.max(0, Math.round(Number(input.trainingFeeEgp || 0)));
  const grossTotalEgp = waterTotalEgp + trainingFeeEgp;

  let discountSource: "promo_code" | "open_manual" | "none" = "none";
  let discountAmountEgp = 0;
  let promoCodeUsed: string | undefined;
  let discountReasonAr: string | undefined;
  let promoValidationErrorAr: string | undefined;

  if (input.discountMode === "promo_code") {
    const promo = input.promoCode;
    if (!promo) {
      promoValidationErrorAr = "كود الخصم غير موجود في إعدادات هذه المنشأة.";
    } else if (!promo.isActive) {
      promoValidationErrorAr = `كود الخصم (${promo.code}) متوقف حالياً.`;
    } else if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      promoValidationErrorAr = `وصل كود الخصم (${promo.code}) للحد الأقصى للاستخدام.`;
    } else if (promo.expiresAtIso && new Date(`${promo.expiresAtIso}T23:59:59`).getTime() < Date.now()) {
      promoValidationErrorAr = `انتهت صلاحية كود الخصم (${promo.code}).`;
    } else {
      discountSource = "promo_code";
      promoCodeUsed = promo.code;
      discountAmountEgp =
        promo.discountType === "percent"
          ? Math.round((grossTotalEgp * Math.min(100, Math.max(0, promo.value))) / 100)
          : Math.round(Math.max(0, promo.value));
      discountReasonAr = `كود ${promo.code} (${
        promo.discountType === "percent" ? `${promo.value}%` : `${promo.value} ج.م`
      })`;
    }
  } else if (input.discountMode === "open_manual") {
    const rawVal = Math.max(0, Number(input.openDiscountValue || 0));
    if (rawVal > 0) {
      discountSource = "open_manual";
      discountAmountEgp =
        input.openDiscountType === "percent"
          ? Math.round((grossTotalEgp * Math.min(100, rawVal)) / 100)
          : Math.round(rawVal);
      discountReasonAr = input.openDiscountReasonAr?.trim() || "خصم مفتوح من الإدارة";
    }
  }

  discountAmountEgp = Math.min(grossTotalEgp, Math.max(0, discountAmountEgp));
  const netTotalEgp = Math.max(0, grossTotalEgp - discountAmountEgp);

  return {
    waterFeePerSessionEgp: unitWater,
    waterTotalEgp,
    trainingFeeEgp,
    grossTotalEgp,
    discountSource,
    discountAmountEgp,
    netTotalEgp,
    promoCodeUsed,
    discountReasonAr,
    promoValidationErrorAr,
  };
}

export function toPricingSnapshot(
  calc: EnrollmentCalculationResult,
  discountType?: FacilityDiscountType,
  discountInputValue?: number,
  waterPaidStatus: "paid" | "partial" | "pending" = "paid"
): LedgerPricingSnapshot {
  return {
    waterFeePerSessionEgp: calc.waterFeePerSessionEgp,
    waterTotalEgp: calc.waterTotalEgp,
    trainingFeeEgp: calc.trainingFeeEgp,
    grossTotalEgp: calc.grossTotalEgp,
    discountSource: calc.discountSource,
    promoCode: calc.promoCodeUsed,
    discountType,
    discountInputValue,
    discountAmountEgp: calc.discountAmountEgp,
    discountReasonAr: calc.discountReasonAr,
    netTotalEgp: calc.netTotalEgp,
    waterPaidStatus,
    capturedAtIso: new Date().toISOString(),
  };
}

export function isSameLocalCalendarDay(isoA?: string, now = new Date()): boolean {
  if (!isoA) return false;
  const d = new Date(isoA);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export type GateScanVerdict = "valid" | "last_session" | "expired" | "duplicate_3h";

export function evaluateLedgerGateStatus(
  ledger: SessionLedger,
  nowMs = Date.now()
): {
  verdict: GateScanVerdict;
  minutesSinceLastScan?: number;
  remainingSessions: number;
  lastCheckin?: SessionCheckin;
} {
  const remaining = Math.max(0, ledger.totalSessions - ledger.completedSessions);
  const lastCheckin =
    ledger.checkins && ledger.checkins.length > 0
      ? ledger.checkins[ledger.checkins.length - 1]
      : undefined;

  if (
    ledger.completedSessions >= ledger.totalSessions ||
    ledger.status === "completed" ||
    ledger.isCodeExpired
  ) {
    return { verdict: "expired", remainingSessions: 0, lastCheckin };
  }

  if (lastCheckin?.scannedAtIso) {
    const diffMs = nowMs - new Date(lastCheckin.scannedAtIso).getTime();
    if (Number.isFinite(diffMs) && diffMs >= 0 && diffMs < DUPLICATE_SCAN_WINDOW_MS) {
      return {
        verdict: "duplicate_3h",
        minutesSinceLastScan: Math.max(1, Math.round(diffMs / 60000)),
        remainingSessions: remaining,
        lastCheckin,
      };
    }
  }

  if (remaining <= 1 || ledger.status === "renewal_due") {
    return { verdict: "last_session", remainingSessions: remaining, lastCheckin };
  }

  return { verdict: "valid", remainingSessions: remaining, lastCheckin };
}

export interface AcademyWaterSettlementRow {
  entityId: string;
  displayNameAr: string;
  agreementType: AcademyAgreementType;
  swimmersCount: number;
  completedSessionsCount: number;
  dueAmountEgp: number;
  collectedAmountEgp: number;
  remainingAmountEgp: number;
  compliancePct: number;
}

/**
 * Aggregates real water-fee dues & today's attendance per linked academy or direct facility schools.
 */
export function buildAcademySettlementSummary(
  facility: Facility,
  ledgers: SessionLedger[]
): AcademyWaterSettlementRow[] {
  const config = getFacilityPoolDeskConfig(facility);
  const rows: AcademyWaterSettlementRow[] = [];

  for (const entity of config.linkedEntities.filter((e) => e.status === "approved")) {
    const matching = ledgers.filter(
      (l) =>
        l.linkedEntityId === entity.id ||
        (entity.linkedCoachId && l.coachId === entity.linkedCoachId) ||
        l.linkedEntityNameAr === entity.displayNameAr
    );
    const waterRate =
      entity.customWaterFeePerSessionEgp !== undefined
        ? entity.customWaterFeePerSessionEgp
        : config.waterFeePerSessionEgp;

    const totalSessionsSold = matching.reduce((s, l) => s + l.totalSessions, 0);
    const completed = matching.reduce((s, l) => s + l.completedSessions, 0);
    const snapshotWaterTotal = matching.reduce(
      (s, l) => s + (l.pricingSnapshot?.waterTotalEgp ?? l.totalSessions * waterRate),
      0
    );

    const dueAmountEgp =
      entity.agreementType === "fixed_monthly"
        ? Math.max(0, Number(entity.fixedMonthlyAmountEgp || 0))
        : snapshotWaterTotal;

    const confirmedReceipts = matching.reduce(
      (s, l) =>
        s +
        l.receipts
          .filter((r) => r.confirmedByProvider)
          .reduce((rs, r) => rs + Number(r.amountEgp || 0), 0),
      0
    );

    const collectedAmountEgp = Math.min(
      dueAmountEgp,
      Math.max(Number(entity.collectedMonthlyEgp || 0), confirmedReceipts)
    );
    const remainingAmountEgp = Math.max(0, dueAmountEgp - collectedAmountEgp);
    const todayCheckins = matching.filter((l) =>
      l.checkins.some((c) => isSameLocalCalendarDay(c.scannedAtIso))
    ).length;
    const denominator = Math.max(1, matching.length || entity.swimmersCountEstimate || 1);
    const compliancePct = Math.min(100, Math.round((todayCheckins / denominator) * 100));

    rows.push({
      entityId: entity.id,
      displayNameAr: entity.displayNameAr,
      agreementType: entity.agreementType,
      swimmersCount: matching.length || Number(entity.swimmersCountEstimate || 0) || (totalSessionsSold > 0 ? 1 : 0),
      completedSessionsCount: completed,
      dueAmountEgp,
      collectedAmountEgp,
      remainingAmountEgp,
      compliancePct,
    });
  }

  // Always include Direct Facility Schools row if there are non-academy ledgers
  const linkedIds = new Set(config.linkedEntities.map((e) => e.id));
  const linkedCoachIds = new Set(
    config.linkedEntities.map((e) => e.linkedCoachId).filter(Boolean) as string[]
  );
  const directLedgers = ledgers.filter(
    (l) =>
      (!l.linkedEntityId || !linkedIds.has(l.linkedEntityId)) &&
      !linkedCoachIds.has(l.coachId)
  );
  if (directLedgers.length > 0 || rows.length === 0) {
    const directNetTotal = directLedgers.reduce((sum, l) => {
      if (l.pricingSnapshot) return sum + l.pricingSnapshot.netTotalEgp;
      return sum + l.receipts.reduce((rs, r) => rs + Number(r.amountEgp || 0), 0);
    }, 0);
    const directCompleted = directLedgers.reduce((s, l) => s + l.completedSessions, 0);
    const todayDirect = directLedgers.filter((l) =>
      l.checkins.some((c) => isSameLocalCalendarDay(c.scannedAtIso))
    ).length;

    rows.push({
      entityId: "direct-club-schools",
      displayNameAr: "مدارس واشتراكات النادي المباشرة",
      agreementType: "per_swimmer_water",
      swimmersCount: directLedgers.length,
      completedSessionsCount: directCompleted,
      dueAmountEgp: directNetTotal,
      collectedAmountEgp: directNetTotal,
      remainingAmountEgp: 0,
      compliancePct: directLedgers.length
        ? Math.min(100, Math.round((todayDirect / directLedgers.length) * 100))
        : 0,
    });
  }

  return rows;
}

export function resolveCoachScanPermission(params: {
  facility?: Facility | null;
  coachId?: string;
  coachMemberCode?: string;
  linkedEntity?: FacilityLinkedEntity | null;
}): {
  isLinked: boolean;
  canScanGroupQr: boolean;
  linkEntry?: FacilityLinkedEntity;
} {
  if (params.linkedEntity) {
    return {
      isLinked: params.linkedEntity.status === "approved",
      canScanGroupQr:
        params.linkedEntity.status === "approved" && Boolean(params.linkedEntity.canScanGroupQr),
      linkEntry: params.linkedEntity,
    };
  }
  const config = getFacilityPoolDeskConfig(params.facility);
  const codeUpper = (params.coachMemberCode || "").trim().toUpperCase();
  const match = config.linkedEntities.find(
    (e) =>
      e.status === "approved" &&
      ((params.coachId && e.linkedCoachId === params.coachId) ||
        (codeUpper && e.linkedMemberCode?.toUpperCase() === codeUpper))
  );
  if (!match) {
    return { isLinked: false, canScanGroupQr: false };
  }
  return {
    isLinked: true,
    canScanGroupQr: Boolean(match.canScanGroupQr),
    linkEntry: match,
  };
}
