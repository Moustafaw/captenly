"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getFacilityBookablePackages, toLedgerSessionBucket } from "@/lib/facilityPricing";
import {
  buildAcademySettlementSummary,
  calculateEnrollmentBreakdown,
  getFacilityPoolDeskConfig,
  toPricingSnapshot,
} from "@/lib/poolDeskPricing";
import type {
  Coach,
  Facility,
  FacilityDiscountType,
  FacilityLinkedEntity,
  MemberRegistryEntry,
  SessionLedger,
} from "@/types/captenly";

const TRACK_OPTIONS: {
  id: "school" | "buds" | "prep" | "team" | "ladies";
  labelAr: string;
}[] = [
  { id: "school", labelAr: "مدارس السباحة" },
  { id: "buds", labelAr: "البراعم والتأسيس" },
  { id: "prep", labelAr: "التجهيزي والمهارات" },
  { id: "team", labelAr: "الفرق والبطولات" },
  { id: "ladies", labelAr: "مواعيد السيدات" },
];

interface FacilitySubscribersTabProps {
  facility: Facility;
  ledgers: SessionLedger[];
  facilityLinks: FacilityLinkedEntity[];
  coaches: Coach[];
  memberRegistry: MemberRegistryEntry[];
  isStaffMode: boolean;
  staffRole: string | null;
  onOpenScanner: () => void;
  onSyncCloud: () => Promise<void>;
  onManualSubCheckin: (subCode: string, noteAr: string) => void;
  onConfirmReceipt: (ledgerId: string, receiptId: string) => void;
  onEnroll: (payload: {
    memberCode: string;
    athleteNameAr: string;
    trackType: "school" | "buds" | "prep" | "team" | "ladies";
    packageTitleAr: string;
    totalSessions: 8 | 12 | 24;
    amountEgp: number;
    linkedEntityId?: string;
    linkedEntityNameAr?: string;
    agreementTypeAtEnroll?: "per_swimmer_water" | "fixed_monthly";
    pricingSnapshot?: ReturnType<typeof toPricingSnapshot>;
    promoCodeUsed?: string;
  }) => { ok: boolean; msg: string };
  onLedgerCheckin: (ledgerId: string, pinCode: string) => void;
  onRenewLedger: (ledger: SessionLedger) => void;
  onRecordPBAndSkills: (payload: {
    athleteId: string;
    swimmerNameAr: string;
    eventTitleAr: string;
    currentValue: number;
    unitAr: string;
    scores: [number, number, number, number, number];
  }) => void;
  onGoToSettings: () => void;
  prefillMemberCode?: string;
  prefillAthleteName?: string;
}

/**
 * Screen 3: المشتركون والتسعير الديناميكي والخصومات وحساب المية
 * Preserves ALL existing Facility Subscriber features (manual code, InstaPay confirmation,
 * track filters, renewals, and PB evaluation) inside Option B luxury layout.
 */
export function FacilitySubscribersTab({
  facility,
  ledgers,
  facilityLinks,
  memberRegistry,
  isStaffMode,
  staffRole,
  onOpenScanner,
  onSyncCloud,
  onManualSubCheckin,
  onConfirmReceipt,
  onEnroll,
  onLedgerCheckin,
  onRenewLedger,
  onRecordPBAndSkills,
  onGoToSettings,
  prefillMemberCode,
  prefillAthleteName,
}: FacilitySubscribersTabProps) {
  const poolConfig = getFacilityPoolDeskConfig(facility);
  const bookablePackages = useMemo(() => getFacilityBookablePackages(facility), [facility]);

  const approvedEntities = useMemo(() => {
    const merged = new Map<string, FacilityLinkedEntity>();
    for (const e of poolConfig.linkedEntities) {
      if (e.status === "approved") merged.set(e.id, e);
    }
    for (const e of facilityLinks) {
      if (e.facilityId === facility.id && e.status === "approved") merged.set(e.id, e);
    }
    return Array.from(merged.values());
  }, [poolConfig.linkedEntities, facilityLinks, facility.id]);

  // Manual code strip state
  const [manualSubCode, setManualSubCode] = useState("");
  const [manualSubNote, setManualSubNote] = useState("");
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [showReceiptsDrawer, setShowReceiptsDrawer] = useState(false);

  // Enrollment + Dynamic Pricing + Discounts Form State
  const [athleteNameInput, setAthleteNameInput] = useState(prefillAthleteName || "");
  const [memberCodeInput, setMemberCodeInput] = useState(prefillMemberCode || "");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("direct");
  const [selectedTrack, setSelectedTrack] = useState<"school" | "buds" | "prep" | "team" | "ladies">("school");
  const [pkgTitleInput, setPkgTitleInput] = useState("");
  const [sessionsCount, setSessionsCount] = useState<8 | 12 | 24>(12);
  const [waterFeeOverride, setWaterFeeOverride] = useState<string>(
    String(poolConfig.waterFeePerSessionEgp || 0)
  );
  const [trainingFeeInput, setTrainingFeeInput] = useState<string>("0");

  // Discount controls
  const [discountMode, setDiscountMode] = useState<"none" | "promo_code" | "open_manual">("none");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [openDiscountType, setOpenDiscountType] = useState<FacilityDiscountType>("percent");
  const [openDiscountValue, setOpenDiscountValue] = useState<string>("0");
  const [openDiscountReason, setOpenDiscountReason] = useState<string>(
    poolConfig.openDiscountReasonsAr?.[0] || "خصم إخوة"
  );
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Roster filters
  const [trackFilter, setTrackFilter] = useState<"all" | "school" | "buds" | "prep" | "team" | "ladies">("all");
  const [subSearchQuery, setSubSearchQuery] = useState("");

  // Preserved PB & 5-Skills logger drawer
  const [showPbForm, setShowPbForm] = useState(false);
  const [pbAthleteId, setPbAthleteId] = useState("");
  const [pbSwimmerName, setPbSwimmerName] = useState("");
  const [pbEventTitle, setPbEventTitle] = useState("50م حرة (سباق سرعة)");
  const [pbCurrentValue, setPbCurrentValue] = useState("");
  const [pbUnitAr, setPbUnitAr] = useState("ثانية");
  const [skillScores, setSkillScores] = useState<[number, number, number, number, number]>([4, 4, 4, 4, 4]);

  React.useEffect(() => {
    if (prefillMemberCode) setMemberCodeInput(prefillMemberCode);
    if (prefillAthleteName) setAthleteNameInput(prefillAthleteName);
  }, [prefillMemberCode, prefillAthleteName]);

  React.useEffect(() => {
    const entity = approvedEntities.find((e) => e.id === selectedEntityId);
    const rate =
      entity?.customWaterFeePerSessionEgp !== undefined
        ? entity.customWaterFeePerSessionEgp
        : poolConfig.waterFeePerSessionEgp;
    setWaterFeeOverride(String(rate));
  }, [selectedEntityId, approvedEntities, poolConfig.waterFeePerSessionEgp]);

  const matchedMember = useMemo(
    () =>
      memberRegistry.find(
        (m) => m.memberCode.toUpperCase() === memberCodeInput.trim().toUpperCase()
      ),
    [memberRegistry, memberCodeInput]
  );

  const selectedEntity = useMemo(
    () => approvedEntities.find((e) => e.id === selectedEntityId),
    [approvedEntities, selectedEntityId]
  );

  const matchedPromo = useMemo(() => {
    const clean = promoCodeInput.trim().toUpperCase();
    if (!clean) return null;
    return poolConfig.promoCodes.find((p) => p.code.toUpperCase() === clean) || null;
  }, [poolConfig.promoCodes, promoCodeInput]);

  const pricingCalc = useMemo(
    () =>
      calculateEnrollmentBreakdown({
        totalSessions: sessionsCount,
        waterFeePerSessionEgp: Math.max(0, Number(waterFeeOverride) || 0),
        trainingFeeEgp: Math.max(0, Number(trainingFeeInput) || 0),
        agreementType: selectedEntity?.agreementType || "per_swimmer_water",
        discountMode,
        promoCode: matchedPromo,
        openDiscountType,
        openDiscountValue: Number(openDiscountValue) || 0,
        openDiscountReasonAr: openDiscountReason,
      }),
    [
      sessionsCount,
      waterFeeOverride,
      trainingFeeInput,
      selectedEntity?.agreementType,
      discountMode,
      matchedPromo,
      openDiscountType,
      openDiscountValue,
      openDiscountReason,
    ]
  );

  const allReceipts = useMemo(
    () => ledgers.flatMap((l) => (l.receipts || []).map((r) => ({ ledger: l, receipt: r }))),
    [ledgers]
  );
  const pendingReceipts = useMemo(
    () => allReceipts.filter((x) => !x.receipt.confirmedByProvider),
    [allReceipts]
  );

  const settlementRows = useMemo(
    () => buildAcademySettlementSummary(facility, ledgers),
    [facility, ledgers]
  );

  const filteredLedgers = useMemo(() => {
    return ledgers.filter((l) => {
      if (trackFilter !== "all" && (l.trackType || "school") !== trackFilter) return false;
      if (subSearchQuery.trim()) {
        const q = subSearchQuery.trim().toLowerCase();
        const hay = `${l.athleteNameAr} ${l.subscriptionCode || ""} ${l.ledgerCode} ${l.memberCode || ""} ${l.packageTitleAr} ${l.linkedEntityNameAr || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ledgers, trackFilter, subSearchQuery]);

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEnrolling) return;
    setIsEnrolling(true);
    try {
      const trackObj = TRACK_OPTIONS.find((t) => t.id === selectedTrack) || TRACK_OPTIONS[0];
      const snapshot = toPricingSnapshot(
        pricingCalc,
        discountMode === "promo_code"
          ? matchedPromo?.discountType
          : discountMode === "open_manual"
          ? openDiscountType
          : undefined,
        discountMode === "promo_code"
          ? matchedPromo?.value
          : discountMode === "open_manual"
          ? Number(openDiscountValue) || 0
          : undefined,
        "paid"
      );

      const res = onEnroll({
        memberCode: memberCodeInput.trim() || `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`,
        athleteNameAr: athleteNameInput.trim() || matchedMember?.fullNameAr || "سباح مشترك",
        trackType: selectedTrack,
        packageTitleAr: pkgTitleInput.trim() || `${trackObj.labelAr} — ${sessionsCount} حصص`,
        totalSessions: sessionsCount,
        amountEgp: pricingCalc.netTotalEgp,
        linkedEntityId: selectedEntity?.id,
        linkedEntityNameAr: selectedEntity?.displayNameAr,
        agreementTypeAtEnroll: selectedEntity?.agreementType,
        pricingSnapshot: snapshot,
        promoCodeUsed: pricingCalc.promoCodeUsed,
      });

      if (res.ok) {
        setAthleteNameInput("");
        setMemberCodeInput("");
        setPromoCodeInput("");
        setOpenDiscountValue("0");
      }
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-captenly-enter">
      {/* Top Dual Operational Strip: Manual Check-in + Pending Receipts Alert */}
      <div className="rounded-2xl bg-white p-4 border border-[#E2E8F0] shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {(!isStaffMode || staffRole !== "accounts_manager") && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualSubCode.trim()) return;
              onManualSubCheckin(
                manualSubCode.trim(),
                manualSubNote.trim() || "خصم حصة بإدخال كود الاشتراك يدوياً من لوحة المشتركين"
              );
              setManualSubCode("");
              setManualSubNote("");
            }}
            className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-2"
          >
            <button
              type="button"
              onClick={onOpenScanner}
              className="px-3.5 py-2.5 rounded-xl bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/25 text-xs font-extrabold inline-flex items-center gap-1.5 hover:bg-[#DCEEF5] shrink-0"
            >
              <Icon name="qr_code_scanner" className="text-[17px]" />
              <span>كاميرا QR</span>
            </button>
            <input
              required
              value={manualSubCode}
              onChange={(e) => setManualSubCode(e.target.value)}
              placeholder="إدخال كود الاشتراك يدوياً SUB-XXXX-XX..."
              className="flex-1 min-w-[170px] rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs font-mono text-[#0F172A] border border-[#E2E8F0] focus:border-[#1D6E7D] outline-none"
            />
            <input
              value={manualSubNote}
              onChange={(e) => setManualSubNote(e.target.value)}
              placeholder="ملاحظة (اختياري)"
              className="w-full sm:w-40 rounded-xl bg-[#F7F9FA] px-3 py-2.5 text-xs text-[#0F172A] border border-[#E2E8F0] focus:border-[#1D6E7D] outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-xs shrink-0 transition-colors"
            >
              خصم حصة ✓
            </button>
          </form>
        )}

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {allReceipts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReceiptsDrawer((v) => !v)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-colors ${
                pendingReceipts.length > 0
                  ? "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100"
                  : "bg-[#F7F9FA] border-[#E2E8F0] text-[#0F172A]"
              }`}
            >
              <Icon name="receipt_long" className="text-[16px]" />
              <span>
                إيصالات الدفع المباشر ({pendingReceipts.length} بانتظار التأكيد)
              </span>
            </button>
          )}
          <button
            type="button"
            disabled={syncingCloud}
            onClick={async () => {
              setSyncingCloud(true);
              await onSyncCloud();
              setSyncingCloud(false);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-[#F7F9FA] hover:bg-[#EAF4F8] text-[#0F172A] border border-[#E2E8F0] text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Icon name="sync" className={`text-[15px] ${syncingCloud ? "animate-spin" : ""}`} />
            <span>مزامنة</span>
          </button>
        </div>
      </div>

      {/* Expandable Pending InstaPay / Vodafone Cash Confirmation Panel */}
      {showReceiptsDrawer && allReceipts.length > 0 && (
        <section className="bg-white rounded-3xl p-5 border border-[#E2E8F0] shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
              <Icon name="receipt_long" className="text-[19px] text-[#1D6E7D]" />
              <span>مراجعة وتأكيد إيصالات الدفع المباشر (InstaPay / فودافون كاش)</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowReceiptsDrawer(false)}
              className="text-xs font-bold text-[#64748B] hover:text-[#0F172A]"
            >
              إخفاء
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allReceipts.map(({ ledger: l, receipt: r }) => (
              <div
                key={r.id}
                className="rounded-xl bg-[#F7F9FA] p-3.5 border border-[#E2E8F0] flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-[#0F172A] truncate">
                    {l.athleteNameAr} • {r.amountEgp} ج.م ({r.channel})
                  </div>
                  <div className="text-[11px] font-mono text-[#64748B] mt-0.5">
                    مرجع: {r.referenceNumber} • {r.uploadedDateAr}
                  </div>
                </div>
                {r.confirmedByProvider ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold shrink-0">
                    مؤكد ✓
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onConfirmReceipt(l.id, r.id)}
                    className="px-3.5 py-1.5 rounded-full bg-[#1D6E7D] text-white text-[11px] font-bold shrink-0 hover:bg-[#155460]"
                  >
                    تأكيد الاستلام ✓
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Card 1: Enrollment & Live Dynamic Water+Discount Calculator */}
      {(!isStaffMode || staffRole !== "accounts_manager") && (
        <form
          onSubmit={handleEnrollSubmit}
          className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E2E8F0] shadow-[0_4px_24px_rgba(15,23,42,0.03)] grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Right 7 Cols: Swimmer & Track/Academy Form */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h2 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                  <Icon name="person_add" className="text-[20px] text-[#1D6E7D]" />
                  <span>تسجيل أو تجديد مشترك (حسبة تلقائية للمية والخصم)</span>
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  تُحفظ الفاتورة بسعر التعاقد الحالي دون تأثر الاشتراكات السابقة بأي تعديل أسعار مستقبلي.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#0F172A]">اسم السبّاح / المشترك *</label>
                <input
                  required={!matchedMember}
                  value={athleteNameInput}
                  onChange={(e) => setAthleteNameInput(e.target.value)}
                  placeholder={matchedMember?.fullNameAr || "اسم السباح ثلاثياً"}
                  className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs text-[#0F172A] border border-[#E2E8F0] focus:border-[#1D6E7D] outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#0F172A]">
                  كود حساب السباح أو الابن (اختياري)
                </label>
                <input
                  value={memberCodeInput}
                  onChange={(e) => setMemberCodeInput(e.target.value)}
                  placeholder="CAP-M-XXXX أو CAP-JR-XXXX"
                  className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 font-mono text-xs text-[#0F172A] border border-[#E2E8F0] focus:border-[#1D6E7D] outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#0F172A]">
                  التبعية (النادي أم أكاديمية مستضيفة)
                </label>
                <select
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                  className="rounded-xl bg-[#F7F9FA] px-3 py-2.5 text-xs font-bold text-[#0F172A] border border-[#E2E8F0] outline-none"
                >
                  <option value="direct">مدارس النادي المباشرة ({facility.nameAr})</option>
                  {approvedEntities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.displayNameAr} (
                      {e.agreementType === "fixed_monthly" ? "تعاقد ثابت" : "محاسبة مية بالحصة"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#0F172A]">المسار التدريبي *</label>
                <select
                  value={selectedTrack}
                  onChange={(e) => {
                    const val = e.target.value as typeof selectedTrack;
                    setSelectedTrack(val);
                    const found = TRACK_OPTIONS.find((t) => t.id === val);
                    if (found) setPkgTitleInput(`${found.labelAr} — ${sessionsCount} حصص`);
                  }}
                  className="rounded-xl bg-[#F7F9FA] px-3 py-2.5 text-xs font-bold text-[#0F172A] border border-[#E2E8F0] outline-none"
                >
                  {TRACK_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.labelAr}
                    </option>
                  ))}
                </select>
              </div>

              {bookablePackages.length > 0 && (
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-[#1D6E7D]">
                    استيراد من باقات المنشأة المنشورة (تعبئة تلقائية — اختياري)
                  </label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const found = bookablePackages.find((p) => p.id === e.target.value);
                      if (!found) return;
                      setSelectedTrack(found.trackType);
                      setPkgTitleInput(found.nameAr);
                      const bucket = toLedgerSessionBucket(found.sessionsCount);
                      setSessionsCount(bucket);
                      const waterPart =
                        selectedEntity?.agreementType === "fixed_monthly"
                          ? 0
                          : bucket * Math.max(0, Number(waterFeeOverride) || 0);
                      const trainPart = Math.max(0, found.baseMonthlyEgp - waterPart);
                      setTrainingFeeInput(String(trainPart));
                    }}
                    className="rounded-xl bg-[#EAF4F8]/70 px-3 py-2.5 text-xs font-bold text-[#0F172A] border border-[#1D6E7D]/25 outline-none"
                  >
                    <option value="">-- اختر باقة منشورة أو حدّد الحصص والسعر بالأسفل --</option>
                    {bookablePackages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameAr} — {p.sessionsCount} حصة ({p.baseMonthlyEgp} ج.م)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#0F172A]">مسمى الباقة / المواعيد</label>
                <input
                  value={pkgTitleInput}
                  onChange={(e) => setPkgTitleInput(e.target.value)}
                  placeholder="مثلاً: مدارس السباحة 5:00 م"
                  className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs text-[#0F172A] border border-[#E2E8F0] outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-[#0F172A]">الحصص</label>
                  <select
                    value={sessionsCount}
                    onChange={(e) => setSessionsCount(Number(e.target.value) as 8 | 12 | 24)}
                    className="rounded-xl bg-[#F7F9FA] px-2 py-2.5 text-xs font-bold border border-[#E2E8F0] outline-none"
                  >
                    <option value={8}>8 حصص</option>
                    <option value={12}>12 حصة</option>
                    <option value={24}>24 حصة</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-[#0F172A]">المية/حصة</label>
                  <input
                    type="number"
                    min={0}
                    value={waterFeeOverride}
                    onChange={(e) => setWaterFeeOverride(e.target.value)}
                    disabled={selectedEntity?.agreementType === "fixed_monthly"}
                    className="rounded-xl bg-[#F7F9FA] px-2.5 py-2.5 text-xs font-bold border border-[#E2E8F0] outline-none disabled:opacity-50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-[#0F172A]">التدريب ج.م</label>
                  <input
                    type="number"
                    min={0}
                    value={trainingFeeInput}
                    onChange={(e) => setTrainingFeeInput(e.target.value)}
                    className="rounded-xl bg-[#F7F9FA] px-2.5 py-2.5 text-xs font-bold border border-[#E2E8F0] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Left 5 Cols: Deep Lagoon Financial Breakdown & Discount Engine */}
          <div className="lg:col-span-5 rounded-2xl bg-[#F7F9FA] border border-[#1D6E7D]/20 p-4 sm:p-5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#0F172A]">حاسبة المية والخصومات</span>
              <button
                type="button"
                onClick={onGoToSettings}
                className="px-2.5 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-[11px] font-bold hover:bg-[#DCEEF5]"
              >
                {poolConfig.waterFeePerSessionEgp > 0
                  ? `سعر المية: ${poolConfig.waterFeePerSessionEgp} ج/حصة • تعديل`
                  : "ضبط الأسعار والأكواد ⚙"}
              </button>
            </div>

            {/* Discount Mode Selector */}
            <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-[#E2E8F0] text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setDiscountMode("none")}
                className={`py-1.5 rounded-lg transition-colors ${
                  discountMode === "none" ? "bg-[#1D6E7D] text-white" : "text-[#64748B]"
                }`}
              >
                بدون خصم
              </button>
              <button
                type="button"
                onClick={() => setDiscountMode("promo_code")}
                className={`py-1.5 rounded-lg transition-colors ${
                  discountMode === "promo_code" ? "bg-[#1D6E7D] text-white" : "text-[#64748B]"
                }`}
              >
                بكود خصم
              </button>
              <button
                type="button"
                disabled={!poolConfig.allowOpenManualDiscount}
                onClick={() => setDiscountMode("open_manual")}
                title={
                  poolConfig.allowOpenManualDiscount
                    ? "خصم مباشر بدون كود"
                    : "معطّل من إعدادات المنشأة"
                }
                className={`py-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                  discountMode === "open_manual" ? "bg-[#1D6E7D] text-white" : "text-[#64748B]"
                }`}
              >
                خصم مفتوح
              </button>
            </div>

            {discountMode === "promo_code" && (
              <div className="flex flex-col gap-1.5">
                <input
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  placeholder="أدخل كود الخصم (مثلاً: SUMMER20)"
                  className="rounded-xl bg-white px-3 py-2 font-mono text-xs border border-[#E2E8F0] focus:border-[#1D6E7D] outline-none uppercase"
                />
                {promoCodeInput.trim() && (
                  <div
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                      pricingCalc.promoValidationErrorAr
                        ? "bg-red-50 text-red-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {pricingCalc.promoValidationErrorAr
                      ? pricingCalc.promoValidationErrorAr
                      : `✓ ${pricingCalc.discountReasonAr} — خصم ${pricingCalc.discountAmountEgp} ج.م`}
                  </div>
                )}
              </div>
            )}

            {discountMode === "open_manual" && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-1.5">
                  <select
                    value={openDiscountType}
                    onChange={(e) => setOpenDiscountType(e.target.value as FacilityDiscountType)}
                    className="rounded-xl bg-white px-2.5 py-2 text-xs font-bold border border-[#E2E8F0] outline-none"
                  >
                    <option value="percent">نسبة %</option>
                    <option value="fixed_egp">مبلغ ج.م</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={openDiscountValue}
                    onChange={(e) => setOpenDiscountValue(e.target.value)}
                    placeholder="قيمة الخصم"
                    className="w-24 rounded-xl bg-white px-2.5 py-2 text-xs font-bold border border-[#E2E8F0] outline-none"
                  />
                  <input
                    value={openDiscountReason}
                    onChange={(e) => setOpenDiscountReason(e.target.value)}
                    placeholder="السبب (خصم إخوة...)"
                    className="flex-1 min-w-0 rounded-xl bg-white px-2.5 py-2 text-xs border border-[#E2E8F0] outline-none"
                  />
                </div>
              </div>
            )}

            {/* Itemized Receipt Box */}
            <div className="rounded-2xl bg-gradient-to-br from-[#0F4C5C] to-[#1D6E7D] text-white p-4 flex flex-col gap-2 text-xs shadow-sm">
              <div className="flex items-center justify-between text-white/80">
                <span>
                  {selectedEntity?.agreementType === "fixed_monthly"
                    ? "اشتراك المية (مشمول بعقد الأكاديمية)"
                    : `اشتراك المية (${sessionsCount} × ${pricingCalc.waterFeePerSessionEgp} ج.م)`}
                </span>
                <span className="font-bold">{pricingCalc.waterTotalEgp} ج.م</span>
              </div>
              <div className="flex items-center justify-between text-white/80">
                <span>اشتراك التدريب / الباقة</span>
                <span className="font-bold">{pricingCalc.trainingFeeEgp} ج.م</span>
              </div>
              {pricingCalc.discountAmountEgp > 0 && (
                <div className="flex items-center justify-between text-emerald-200 font-bold">
                  <span>{pricingCalc.discountReasonAr || "الخصم المطبق"}</span>
                  <span>- {pricingCalc.discountAmountEgp} ج.م</span>
                </div>
              )}
              <div className="h-px bg-white/20 my-0.5" />
              <div className="flex items-center justify-between">
                <span className="font-extrabold">الصافي المستحق للتحصيل</span>
                <span className="text-xl font-black">{pricingCalc.netTotalEgp} ج.م</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isEnrolling}
              className="w-full py-3 px-4 rounded-xl bg-[#1D6E7D] hover:bg-[#155460] text-white font-extrabold text-xs shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
            >
              <Icon name="qr_code_2" className="text-[18px]" />
              <span>تفعيل وإصدار كود الاشتراك والـ QR فوراً ✓</span>
            </button>
          </div>
        </form>
      )}

      {/* Card 2: Monthly Water-Fee Settlement by Academy */}
      <section className="bg-white rounded-3xl p-5 border border-[#E2E8F0] shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col gap-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-sm text-[#0F172A]">
              مستحقات وتوريدات المية حسب الأكاديميات ومدارس النادي
            </h3>
            <p className="text-[11px] text-[#64748B]">
              تجميع تلقائي لاشتراكات المية وفق نوع التعاقد المعتمد لكل أكاديمية.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToSettings}
            className="text-xs font-bold text-[#1D6E7D] hover:underline"
          >
            إدارة الأكاديميات والتسعير ←
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {settlementRows.map((row) => {
            const pct =
              row.dueAmountEgp > 0
                ? Math.min(100, Math.round((row.collectedAmountEgp / row.dueAmountEgp) * 100))
                : 100;
            return (
              <div
                key={row.entityId}
                className="rounded-2xl bg-[#F7F9FA] p-4 border border-[#E2E8F0] flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-[#0F172A] truncate">
                    {row.displayNameAr}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      row.remainingAmountEgp === 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {row.remainingAmountEgp === 0
                      ? "مسدد ✓"
                      : `متبقي ${row.remainingAmountEgp} ج.م`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>
                    {row.agreementType === "fixed_monthly" ? "تعاقد شهري ثابت" : "محاسبة بالحصة"} •{" "}
                    {row.swimmersCount} سبّاح
                  </span>
                  <span className="font-black text-[#0F172A]">{row.dueAmountEgp} ج.م</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1D6E7D]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Card 3: Subscribers & Teams Roster + Preserved PB Quick Toggle */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E2E8F0] shadow-[0_4px_24px_rgba(15,23,42,0.03)] flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-[#0F172A]">
              قائمة المشتركين والفرق ({filteredLedgers.length})
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              يعرض كل مشترك برمز الاشتراك المتجدد وحالة المية والخصم المطبق مع إمكانية الخصم أو التجديد.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#F7F9FA] rounded-full px-3.5 py-2 border border-[#E2E8F0] w-full sm:w-64">
              <Icon name="search" className="text-[#64748B] text-[16px] ml-2 shrink-0" />
              <input
                value={subSearchQuery}
                onChange={(e) => setSubSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم أو كود SUB-..."
                className="w-full bg-transparent text-xs outline-none text-[#0F172A]"
              />
            </div>

            {(!isStaffMode || staffRole !== "accounts_manager") && (
              <button
                type="button"
                onClick={() => setShowPbForm((v) => !v)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 ${
                  showPbForm
                    ? "bg-[#1D6E7D] text-white border-[#1D6E7D]"
                    : "bg-[#EAF4F8] text-[#1D6E7D] border-[#1D6E7D]/25"
                }`}
              >
                <Icon name="speed" className="text-[16px]" />
                <span>تقييم PB والمهارات</span>
              </button>
            )}
          </div>
        </div>

        {/* Preserved Track Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setTrackFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              trackFilter === "all"
                ? "bg-[#1D6E7D] text-white"
                : "bg-[#F7F9FA] text-[#64748B] border border-[#E2E8F0]"
            }`}
          >
            الكل ({ledgers.length})
          </button>
          {TRACK_OPTIONS.map((t) => {
            const count = ledgers.filter((l) => (l.trackType || "school") === t.id).length;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTrackFilter(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  trackFilter === t.id
                    ? "bg-[#1D6E7D] text-white"
                    : "bg-[#F7F9FA] text-[#64748B] border border-[#E2E8F0]"
                }`}
              >
                {t.labelAr} ({count})
              </button>
            );
          })}
        </div>

        {/* Collapsible Preserved PB & 5-Point Skill Assessment Logger */}
        {showPbForm && (!isStaffMode || staffRole !== "accounts_manager") && (
          <div className="rounded-2xl bg-[#F7F9FA] p-4 sm:p-5 border border-[#1D6E7D]/25 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-[#0F172A]">
                تسجيل رقم قياسي (PB) والتقييم الفني للسبّاح
              </h4>
              <button
                type="button"
                onClick={() => setShowPbForm(false)}
                className="text-xs font-bold text-[#64748B]"
              >
                إغلاق
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <select
                value={pbAthleteId}
                onChange={(e) => {
                  const val = e.target.value;
                  setPbAthleteId(val);
                  const found = ledgers.find((l) => l.id === val);
                  if (found) setPbSwimmerName(found.athleteNameAr);
                }}
                className="rounded-xl bg-white px-3 py-2 text-xs font-bold border border-[#E2E8F0] outline-none"
              >
                <option value="">-- اختر مشتركاً أو اكتب الاسم --</option>
                {ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.athleteNameAr} ({l.subscriptionCode || l.ledgerCode})
                  </option>
                ))}
              </select>
              <input
                value={pbSwimmerName}
                onChange={(e) => setPbSwimmerName(e.target.value)}
                placeholder="اسم السباح *"
                className="rounded-xl bg-white px-3 py-2 text-xs font-bold border border-[#E2E8F0] outline-none"
              />
              <input
                value={pbEventTitle}
                onChange={(e) => setPbEventTitle(e.target.value)}
                placeholder="السباق (مثلاً 50م حرة)"
                className="rounded-xl bg-white px-3 py-2 text-xs font-bold border border-[#E2E8F0] outline-none"
              />
              <div className="flex gap-1.5">
                <input
                  value={pbCurrentValue}
                  onChange={(e) => setPbCurrentValue(e.target.value)}
                  placeholder="الزمن (31.4)"
                  className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-bold border border-[#E2E8F0] outline-none"
                />
                <input
                  value={pbUnitAr}
                  onChange={(e) => setPbUnitAr(e.target.value)}
                  className="w-16 rounded-xl bg-white px-2 py-2 text-xs font-bold border border-[#E2E8F0] text-center outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {["الطفو (/5)", "التنفس (/5)", "الحرّة (/5)", "الظهر (/5)", "الانطلاق (/5)"].map(
                (label, idx) => (
                  <label
                    key={label}
                    className="rounded-xl bg-white p-2 border border-[#E2E8F0] flex flex-col gap-1 font-bold text-[#0F172A]"
                  >
                    <span className="text-[10px] text-[#64748B]">{label}</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={skillScores[idx]}
                      onChange={(e) => {
                        const next = [...skillScores] as [number, number, number, number, number];
                        next[idx] = Math.min(5, Math.max(1, Number(e.target.value) || 1));
                        setSkillScores(next);
                      }}
                      className="rounded-lg bg-[#F7F9FA] px-2 py-1 text-xs border border-[#E2E8F0]"
                    />
                  </label>
                )
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const selectedLedger = ledgers.find((l) => l.id === pbAthleteId);
                const name = pbSwimmerName.trim() || selectedLedger?.athleteNameAr || "";
                const numVal = Number(pbCurrentValue.trim());
                if (!name || !pbEventTitle.trim() || !Number.isFinite(numVal) || numVal <= 0) {
                  return;
                }
                onRecordPBAndSkills({
                  athleteId: selectedLedger?.athleteId || "persona-athlete",
                  swimmerNameAr: name,
                  eventTitleAr: pbEventTitle.trim(),
                  currentValue: numVal,
                  unitAr: pbUnitAr.trim() || "ثانية",
                  scores: skillScores,
                });
                setPbCurrentValue("");
                setShowPbForm(false);
              }}
              className="self-start px-5 py-2.5 rounded-full bg-[#1D6E7D] text-white text-xs font-bold hover:bg-[#155460]"
            >
              حفظ الرقم القياسي والتقييم ✓
            </button>
          </div>
        )}

        {filteredLedgers.length === 0 ? (
          <div className="rounded-2xl bg-[#F7F9FA] p-8 text-center text-xs text-[#64748B] border border-[#E2E8F0]">
            لا يوجد مشتركون مسجلون في هذا القسم حالياً. استخدم نموذج التسجيل أعلاه لإضافة أول سبّاح وإصدار كوده.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredLedgers.map((l) => {
              const isExpired = Boolean(
                l.isCodeExpired || l.status === "completed" || l.completedSessions >= l.totalSessions
              );
              const subCode = l.subscriptionCode || l.ledgerCode;
              const pct = Math.min(100, Math.round((l.completedSessions / l.totalSessions) * 100));
              const paidNet =
                l.pricingSnapshot?.netTotalEgp ?? (l.receipts[0]?.amountEgp || 0);

              return (
                <div
                  key={l.id}
                  className={`rounded-2xl p-4 border flex flex-col justify-between gap-3 transition-all ${
                    isExpired
                      ? "bg-[#F7F9FA]/70 border-red-200"
                      : "bg-[#F7F9FA] border-[#E2E8F0] hover:border-[#1D6E7D]/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#0F172A]">{l.athleteNameAr}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-md font-mono text-[11px] font-black border ${
                            isExpired
                              ? "bg-red-50 text-red-700 border-red-200 line-through"
                              : "bg-[#EAF4F8] text-[#1D6E7D] border-[#1D6E7D]/25"
                          }`}
                        >
                          {subCode}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] text-[10px] font-bold text-[#64748B]">
                          {l.linkedEntityNameAr || l.trackLabelAr || "مدارس السباحة"}
                        </span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-1">
                        {l.packageTitleAr} • {l.startedDateAr}
                      </div>
                      {(paidNet > 0 || l.pricingSnapshot) && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] font-bold">
                          <span className="px-2 py-0.5 rounded-md bg-white border border-[#E2E8F0] text-[#0F172A]">
                            الصافي: {paidNet} ج.م
                          </span>
                          {l.pricingSnapshot && l.pricingSnapshot.discountAmountEgp > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              خصم {l.pricingSnapshot.discountAmountEgp} ج.م
                              {l.pricingSnapshot.promoCode ? ` (${l.pricingSnapshot.promoCode})` : ""}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${
                        isExpired
                          ? "bg-red-100 text-red-800"
                          : l.status === "renewal_due"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-[#EAF4F8] text-[#1D6E7D]"
                      }`}
                    >
                      {isExpired
                        ? "منتهي الصلاحية"
                        : l.status === "renewal_due"
                        ? `متبقي ${l.totalSessions - l.completedSessions}`
                        : "ساري ✓"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#0F172A]">
                        الحصص المنفذة: {l.completedSessions} من {l.totalSessions}
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        متبقي {Math.max(0, l.totalSessions - l.completedSessions)} حصة
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isExpired
                            ? "bg-red-500"
                            : l.status === "renewal_due"
                            ? "bg-amber-500"
                            : "bg-[#1D6E7D]"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0]">
                    <div className="flex items-center gap-2">
                      {!isExpired && (!isStaffMode || staffRole !== "accounts_manager") && (
                        <button
                          type="button"
                          onClick={() => onLedgerCheckin(l.id, l.pinCode)}
                          className="px-3.5 py-2 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold transition-colors"
                        >
                          خصم حصة ({l.completedSessions + 1}/{l.totalSessions}) ✓
                        </button>
                      )}
                      {(!isStaffMode || staffRole !== "accounts_manager") && (
                        <button
                          type="button"
                          onClick={() => onRenewLedger(l)}
                          className={`px-3 py-2 rounded-full text-xs font-bold border ${
                            isExpired
                              ? "bg-[#1D6E7D] text-white border-[#1D6E7D]"
                              : "bg-white text-[#0F172A] border-[#E2E8F0] hover:bg-[#EAF4F8]"
                          }`}
                        >
                          تجديد ↻
                        </button>
                      )}
                    </div>

                    <Link
                      href={`/dashboard/ledger?id=${l.id}`}
                      className="text-[11px] font-bold text-[#1D6E7D] hover:underline"
                    >
                      السجل والكارت ←
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
