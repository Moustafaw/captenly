"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import {
  calculateEnrollmentBreakdown,
  DEFAULT_OPEN_DISCOUNT_REASONS,
  getFacilityPoolDeskConfig,
} from "@/lib/poolDeskPricing";
import {
  getFacilityRoleCapabilities,
  resolveFacilityUiAccessRole,
} from "@/lib/facilityPermissions";
import type {
  AcademyAgreementType,
  Coach,
  Facility,
  FacilityDiscountType,
  FacilityLinkedEntity,
  FacilityPoolDeskConfig,
  FacilityPromoCode,
  FacilityStaffMember,
  FacilityStaffRole,
  MemberRegistryEntry,
} from "@/types/captenly";

function isoToDdMmYyyy(iso?: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function parseArabicDateToIso(raw: string): { valid: boolean; iso: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, iso: "" };

  let day = 0;
  let month = 0;
  let year = 0;

  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(trimmed);
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else if (ymd) {
    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);
  } else {
    return { valid: false, iso: "" };
  }

  if (year < 2024 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, iso: "" };
  }
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return { valid: false, iso: "" };
  }
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return { valid: true, iso: `${year}-${pad2(month)}-${pad2(day)}` };
}

interface StaffCandidateItem {
  memberCode: string;
  fullNameAr: string;
  phone?: string;
  city?: string;
  role?: string;
}

interface FacilitySettingsDeskTabProps {
  facility: Facility;
  facilityLinks: FacilityLinkedEntity[];
  coaches: Coach[];
  memberRegistry: MemberRegistryEntry[];
  staffRole: FacilityStaffRole | null;
  isStaffMode: boolean;
  initialFocusSection?: "all" | "pricing" | "academies" | "staff";
  onSavePoolDeskConfig: (
    patch: Partial<FacilityPoolDeskConfig>
  ) => { ok: boolean; messageAr: string };
  onSavePromoCode: (
    promo: Omit<FacilityPromoCode, "id" | "usedCount" | "createdAtIso"> & { id?: string }
  ) => { ok: boolean; messageAr: string };
  onTogglePromoCode: (promoId: string) => void;
  onRemovePromoCode: (promoId: string) => void;
  onAddDirectLinkedEntity: (payload: {
    displayNameAr: string;
    entityKind: "academy" | "coach";
    ownerNameAr?: string;
    phone?: string;
    agreementType: AcademyAgreementType;
    fixedMonthlyAmountEgp?: number;
    customWaterFeePerSessionEgp?: number;
    canScanGroupQr?: boolean;
    linkedMemberCode?: string;
    groupLabelAr?: string;
    swimmersCountEstimate?: number;
  }) => Promise<{ ok: boolean; link?: FacilityLinkedEntity; messageAr: string }>;
  onReviewLinkedEntity: (
    linkId: string,
    patch: {
      status?: "approved" | "rejected" | "pending";
      agreementType?: AcademyAgreementType;
      fixedMonthlyAmountEgp?: number;
      customWaterFeePerSessionEgp?: number;
      canScanGroupQr?: boolean;
      collectedMonthlyEgp?: number;
    }
  ) => Promise<{ ok: boolean; link?: FacilityLinkedEntity; messageAr: string }>;
  onLookupStaffRemote?: (query: string) => Promise<StaffCandidateItem[]>;
  onAddStaffMember?: (payload: {
    fullNameAr: string;
    role: FacilityStaffRole;
    phone?: string;
    memberCodeOrQuery?: string;
  }) => { ok: boolean; messageAr: string };
  onRemoveStaffMember?: (staffId: string) => void;
  onSwitchToStaffMode?: (staffId: string) => void;
}

/**
 * Screen 4: الإعدادات والتسعير والأكاديميات وصلاحيات مسح الكباتن (Pool Desk Settings Hub).
 */
export function FacilitySettingsDeskTab({
  facility,
  facilityLinks,
  coaches,
  memberRegistry,
  staffRole,
  isStaffMode,
  initialFocusSection = "all",
  onSavePoolDeskConfig,
  onSavePromoCode,
  onTogglePromoCode,
  onRemovePromoCode,
  onAddDirectLinkedEntity,
  onReviewLinkedEntity,
  onLookupStaffRemote,
  onAddStaffMember,
  onRemoveStaffMember,
  onSwitchToStaffMode,
}: FacilitySettingsDeskTabProps) {
  const poolConfig = useMemo(() => getFacilityPoolDeskConfig(facility), [facility]);

  const accessRole = useMemo(
    () => resolveFacilityUiAccessRole({ isStaffMode, staffRole }),
    [isStaffMode, staffRole]
  );
  const capabilities = useMemo(
    () => getFacilityRoleCapabilities(accessRole),
    [accessRole]
  );
  const canManagePermissions = capabilities.manage_linked_entities;
  const canEditLinkedCollections = capabilities.edit_linked_entity_collections;
  const canManagePricing = capabilities.manage_pricing;
  const canManageStaff = capabilities.manage_staff;

  const [sectionFilter, setSectionFilter] = useState<"all" | "pricing" | "academies" | "staff">(
    initialFocusSection
  );
  const [statusFeedback, setStatusFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  // 1) Dynamic water pricing state
  const [waterFeeInput, setWaterFeeInput] = useState<number>(poolConfig.waterFeePerSessionEgp);
  const [previewTrainingFee, setPreviewTrainingFee] = useState<number>(450);
  const [allowOpenDiscount, setAllowOpenDiscount] = useState<boolean>(
    poolConfig.allowOpenManualDiscount
  );
  const [customReasonDraft, setCustomReasonDraft] = useState("");
  const [reasonsList, setReasonsList] = useState<string[]>(
    poolConfig.openDiscountReasonsAr ?? DEFAULT_OPEN_DISCOUNT_REASONS
  );

  // 2) Promo code builder state
  const [promoCodeDraft, setPromoCodeDraft] = useState("");
  const [promoTypeDraft, setPromoTypeDraft] = useState<FacilityDiscountType>("percent");
  const [promoValueDraft, setPromoValueDraft] = useState<number>(15);
  const [promoMaxUsesDraft, setPromoMaxUsesDraft] = useState<string>("");
  const [promoExpiryDraft, setPromoExpiryDraft] = useState<string>("");
  const [promoExpiryDisplay, setPromoExpiryDisplay] = useState<string>("");
  const [promoExpiryError, setPromoExpiryError] = useState<string | null>(null);
  const [promoDescDraft, setPromoDescDraft] = useState<string>("");
  const nativeDatePickerRef = useRef<HTMLInputElement | null>(null);

  // 3) Bilateral linked academy/coach add form state
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [linkKind, setLinkKind] = useState<"academy" | "coach">("academy");
  const [linkDisplayName, setLinkDisplayName] = useState("");
  const [linkOwnerName, setLinkOwnerName] = useState("");
  const [linkPhone, setLinkPhone] = useState("");
  const [linkMemberCode, setLinkMemberCode] = useState("");
  const [linkGroupLabel, setLinkGroupLabel] = useState("");
  const [linkAgreementType, setLinkAgreementType] =
    useState<AcademyAgreementType>("per_swimmer_water");
  const [linkFixedMonthly, setLinkFixedMonthly] = useState<number>(3000);
  const [linkCustomWaterFee, setLinkCustomWaterFee] = useState<string>("");
  const [linkCanScanQr, setLinkCanScanQr] = useState<boolean>(false);
  const [linkSaving, setLinkSaving] = useState(false);

  // Pending review edits by link id
  const [pendingAgreementOverride, setPendingAgreementOverride] = useState<
    Record<string, AcademyAgreementType>
  >({});
  const [pendingScanOverride, setPendingScanOverride] = useState<Record<string, boolean>>({});
  const [collectedDraftByLink, setCollectedDraftByLink] = useState<Record<string, string>>({});

  // 4) Staff management state
  const [staffFullNameDraft, setStaffFullNameDraft] = useState("");
  const [staffPhoneDraft, setStaffPhoneDraft] = useState("");
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [staffSearchResults, setStaffSearchResults] = useState<StaffCandidateItem[]>([]);
  const [staffSearching, setStaffSearching] = useState(false);
  const [newStaffRole, setNewStaffRole] = useState<FacilityStaffRole>("subscriptions_manager");

  // Sample 12-session preview calculation
  const previewSample = useMemo(
    () =>
      calculateEnrollmentBreakdown({
        totalSessions: 12,
        waterFeePerSessionEgp: waterFeeInput,
        trainingFeeEgp: previewTrainingFee,
        agreementType: "per_swimmer_water",
        discountMode: "none",
      }),
    [waterFeeInput, previewTrainingFee]
  );

  const pendingLinks = useMemo(
    () => facilityLinks.filter((l) => l.status === "pending"),
    [facilityLinks]
  );
  const approvedLinks = useMemo(
    () => facilityLinks.filter((l) => l.status === "approved"),
    [facilityLinks]
  );
  const rejectedLinks = useMemo(
    () => facilityLinks.filter((l) => l.status === "rejected"),
    [facilityLinks]
  );

  const facilityStaffList = useMemo(() => facility.staffMembers || [], [facility.staffMembers]);

  const handleSaveWaterPricing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePricing) {
      setStatusFeedback({ tone: "error", text: "صلاحية تعديل التسعير محصورة للمالك أو مدير الحسابات." });
      return;
    }
    const cleanReasons =
      reasonsList.length > 0 ? reasonsList : DEFAULT_OPEN_DISCOUNT_REASONS;
    const res = onSavePoolDeskConfig({
      waterFeePerSessionEgp: Math.max(0, Number(waterFeeInput) || 0),
      allowOpenManualDiscount: allowOpenDiscount,
      openDiscountReasonsAr: cleanReasons,
    });
    setStatusFeedback({ tone: res.ok ? "success" : "error", text: res.messageAr });
  };

  const handleAddReason = () => {
    const clean = customReasonDraft.trim();
    if (!clean || reasonsList.includes(clean)) return;
    setReasonsList((prev) => [...prev, clean]);
    setCustomReasonDraft("");
  };

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePricing) {
      setStatusFeedback({ tone: "error", text: "صلاحية إنشاء أكواد الخصم لمدير المنشأة أو الحسابات فقط." });
      return;
    }
    const parsedExpiry = parseArabicDateToIso(promoExpiryDisplay);
    if (!parsedExpiry.valid) {
      const errMsg = "يرجى إدخال تاريخ انتهاء صحيح بصيغة يوم/شهر/سنة (مثال: 31/12/2026).";
      setPromoExpiryError(errMsg);
      setStatusFeedback({ tone: "error", text: errMsg });
      return;
    }
    setPromoExpiryError(null);
    const res = onSavePromoCode({
      code: promoCodeDraft.trim().toUpperCase(),
      discountType: promoTypeDraft,
      value: Math.max(1, Number(promoValueDraft) || 0),
      maxUses: promoMaxUsesDraft ? Math.max(1, Number(promoMaxUsesDraft)) : undefined,
      expiresAtIso: parsedExpiry.iso || promoExpiryDraft.trim() || undefined,
      isActive: true,
      noteAr: promoDescDraft.trim() || undefined,
    } as Omit<FacilityPromoCode, "id" | "usedCount" | "createdAtIso"> & { id?: string });
    setStatusFeedback({ tone: res.ok ? "success" : "error", text: res.messageAr });
    if (res.ok) {
      setPromoCodeDraft("");
      setPromoMaxUsesDraft("");
      setPromoExpiryDraft("");
      setPromoExpiryDisplay("");
      setPromoExpiryError(null);
      setPromoDescDraft("");
    }
  };

  const handleAddDirectLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePermissions) {
      setStatusFeedback({ tone: "error", text: "صلاحية ربط الأكاديميات محصورة لمالك المنشأة أو المشرف العام." });
      return;
    }
    if (!linkDisplayName.trim()) {
      setStatusFeedback({ tone: "error", text: "يرجى إدخال اسم الأكاديمية أو الكابتن أولاً." });
      return;
    }
    setLinkSaving(true);
    const res = await onAddDirectLinkedEntity({
      displayNameAr: linkDisplayName.trim(),
      entityKind: linkKind,
      ownerNameAr: linkOwnerName.trim() || undefined,
      phone: linkPhone.trim() || undefined,
      linkedMemberCode: linkMemberCode.trim().toUpperCase() || undefined,
      groupLabelAr: linkGroupLabel.trim() || undefined,
      agreementType: linkAgreementType,
      fixedMonthlyAmountEgp:
        linkAgreementType === "fixed_monthly" ? Math.max(0, Number(linkFixedMonthly) || 0) : undefined,
      customWaterFeePerSessionEgp:
        linkCustomWaterFee.trim() !== "" ? Math.max(0, Number(linkCustomWaterFee)) : undefined,
      canScanGroupQr: linkCanScanQr,
    });
    setLinkSaving(false);
    setStatusFeedback({ tone: res.ok ? "success" : "error", text: res.messageAr });
    if (res.ok) {
      setLinkDisplayName("");
      setLinkOwnerName("");
      setLinkPhone("");
      setLinkMemberCode("");
      setLinkGroupLabel("");
      setLinkCustomWaterFee("");
      setLinkCanScanQr(false);
      setShowAddLinkForm(false);
    }
  };

  const handleSearchStaff = async () => {
    const q = staffSearchQuery.trim();
    if (!q) return;
    setStaffSearching(true);
    const localMatches: StaffCandidateItem[] = memberRegistry
      .filter(
        (m) =>
          m.memberCode.toLowerCase().includes(q.toLowerCase()) ||
          m.fullNameAr.includes(q)
      )
      .slice(0, 6)
      .map((m) => ({
        memberCode: m.memberCode,
        fullNameAr: m.fullNameAr,
        phone: m.phone,
        city: m.city,
      }));
    const remoteMatches = onLookupStaffRemote ? await onLookupStaffRemote(q) : [];
    const mergedMap = new Map<string, StaffCandidateItem>();
    [...remoteMatches, ...localMatches].forEach((item) => {
      if (item.memberCode && !mergedMap.has(item.memberCode)) {
        mergedMap.set(item.memberCode, item);
      }
    });
    const list = Array.from(mergedMap.values());
    setStaffSearchResults(list);
    if (list.length === 0) {
      setStatusFeedback({
        tone: "error",
        text: "لم يُعثر على حساب مسجل بهذا الكود أو الاسم — يمكنك إضافة الموظف باسمه ورقمه إدارياً.",
      });
    }
    setStaffSearching(false);
  };

  const handleAssignStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddStaffMember || !staffFullNameDraft.trim()) return;
    const res = onAddStaffMember({
      fullNameAr: staffFullNameDraft.trim(),
      role: newStaffRole,
      phone: staffPhoneDraft.trim() || undefined,
      memberCodeOrQuery: staffSearchQuery.trim() || undefined,
    });
    setStatusFeedback({ tone: res.ok ? "success" : "error", text: res.messageAr });
    if (res.ok) {
      setStaffFullNameDraft("");
      setStaffPhoneDraft("");
      setStaffSearchQuery("");
      setStaffSearchResults([]);
    }
  };

  const facilityCoachList = useMemo(
    () => coaches.filter((c) => (facility.affiliatedCoachIds || []).includes(c.id)),
    [coaches, facility.affiliatedCoachIds]
  );

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar inside Screen 4 */}
      <div className="rounded-3xl bg-white border border-sand-border p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-soft-luxury">
        <div>
          <span className="text-[11px] font-bold text-[#1D6E7D] uppercase tracking-wider">
            إدارة اقتصاد المنشأة وحوكمة الميدان
          </span>
          <h2 className="text-xl font-black text-[#0F4C5C] mt-0.5">
            التسعير الديناميكي، الخصومات، الأكاديميات وصلاحيات مسح الكباتن
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "all" as const, label: "عرض شامل" },
            { id: "pricing" as const, label: "التسعير والخصومات" },
            {
              id: "academies" as const,
              label: `الأكاديميات والكباتن (${approvedLinks.length}${
                pendingLinks.length > 0 ? ` • ${pendingLinks.length} جديد` : ""
              })`,
            },
            { id: "staff" as const, label: `طاقم البوابة والإدارة (${facilityStaffList.length})` },
          ].map((tab) => {
            const active = sectionFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSectionFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "bg-[#0F4C5C] text-white shadow-soft-luxury"
                    : "bg-[#F7F9FA] text-ink-slate hover:bg-[#EAF4F8] hover:text-[#0F4C5C]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          <Link
            href="/dashboard/facility/gate"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EAF4F8] text-[#0F4C5C] hover:bg-[#d7ebf3] text-xs font-black transition-all"
          >
            <Icon name="qr_code_scanner" size={16} />
            فتح كشك البوابة
          </Link>
        </div>
      </div>

      {statusFeedback && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-bold flex items-center justify-between gap-3 border ${
            statusFeedback.tone === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon
              name={statusFeedback.tone === "success" ? "check_circle" : "error_outline"}
              size={18}
            />
            {statusFeedback.text}
          </span>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* BENTO ROW 1: Dynamic Pricing Engine & Promo/Open Discounts */}
      {(sectionFilter === "all" || sectionFilter === "pricing") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Card 1: Dynamic Water Fee + Live Preview Card */}
          <form
            onSubmit={handleSaveWaterPricing}
            className="lg:col-span-6 rounded-3xl bg-white border border-sand-border p-5 md:p-6 space-y-5 shadow-soft-luxury"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAF4F8] text-[#0F4C5C] text-[11px] font-black mb-2">
                  <Icon name="water_drop" size={14} />
                  سعر المية الديناميكي لكل منشأة
                </span>
                <h3 className="text-lg font-black text-ink-deep">
                  تحديد مقابل المية للحصة الواحدة
                </h3>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  كل منشأة تضع تسعيرها بحرية تامة (أو 0 ج.م للباقات الشاملة). تعديل السعر يُطبق على
                  الاشتراكات الجديدة فقط مع حفظ فواتير المشتركين السابقين كما دُفعت.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#F7F9FA] border border-sand-border p-4 space-y-3">
              <label className="block text-xs font-black text-[#0F4C5C]">
                مقابل المية للحصة الواحدة (جنيه مصري / حصة)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={5}
                  disabled={!canManagePricing}
                  value={waterFeeInput}
                  onChange={(e) => setWaterFeeInput(Math.max(0, Number(e.target.value) || 0))}
                  className="w-36 rounded-xl border border-sand-border bg-white px-4 py-2.5 text-lg font-black text-[#0F4C5C] tabular-nums"
                />
                {[-10, -5, 5, 10, 20].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    disabled={!canManagePricing}
                    onClick={() => setWaterFeeInput((prev) => Math.max(0, prev + delta))}
                    className="px-3 py-2 rounded-xl bg-white border border-sand-border text-xs font-bold text-ink-deep hover:border-[#1D6E7D] hover:text-[#0F4C5C] cursor-pointer disabled:opacity-50"
                  >
                    {delta > 0 ? `+${delta}` : delta} ج
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink-muted">
                القيمة المسجلة حالياً في قاعدة المنشأة:{" "}
                <strong className="text-[#0F4C5C] tabular-nums">
                  {poolConfig.waterFeePerSessionEgp} ج.م / حصة
                </strong>
              </p>
            </div>

            {/* Deep Ocean Live 12-Session Invoice Preview Card */}
            <div className="rounded-2xl bg-[#0F4C5C] text-white p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#EAF4F8]">
                  معاينة فاتورة باقة 12 حصة (مدارس / تأسيس)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-bold">
                  حسبة فورية
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="rounded-xl bg-white/10 p-3">
                  <div className="text-[#EAF4F8]/80 mb-1">حساب المية (12 × {waterFeeInput})</div>
                  <div className="text-base font-black tabular-nums">
                    {previewSample.waterTotalEgp} ج.م
                  </div>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <div className="text-[#EAF4F8]/80 mb-1">مقابل التدريب (للمعاينة)</div>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={previewTrainingFee}
                    onChange={(e) => setPreviewTrainingFee(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded-lg bg-white/15 border border-white/25 px-2 py-1 text-sm font-black text-white tabular-nums"
                  />
                </div>
                <div className="rounded-xl bg-[#1D6E7D] border border-white/20 p-3">
                  <div className="text-[#EAF4F8] mb-1">إجمالي الفاتورة الصافي</div>
                  <div className="text-lg font-black tabular-nums">
                    {previewSample.netTotalEgp} ج.م
                  </div>
                </div>
              </div>
            </div>

            {/* Open Manual Discount Settings inside Card 1 */}
            <div className="rounded-2xl border border-sand-border p-4 space-y-3">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-sm font-black text-ink-deep">
                    السماح بالخصم المفتوح بدون كود عند التسجيل
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    يتيح للكابتن أو مسؤول الاشتراكات تطبيق خصم خاص (إخوة / منحة / تعويض) مع تسجيل السبب.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allowOpenDiscount}
                  disabled={!canManagePricing}
                  onChange={(e) => setAllowOpenDiscount(e.target.checked)}
                  className="w-5 h-5 accent-[#0F4C5C] rounded"
                />
              </label>

              {allowOpenDiscount && (
                <div className="pt-2 border-t border-sand-border/70 space-y-2">
                  <div className="text-[11px] font-bold text-ink-slate">أسباب الخصم السريعة المسموحة:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {reasonsList.map((reason) => (
                      <span
                        key={reason}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EAF4F8] text-[#0F4C5C] text-[11px] font-bold"
                      >
                        {reason}
                        {canManagePricing && (
                          <button
                            type="button"
                            onClick={() =>
                              setReasonsList((prev) => prev.filter((item) => item !== reason))
                            }
                            className="hover:text-rose-700 cursor-pointer"
                            aria-label={`حذف ${reason}`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  {canManagePricing && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={customReasonDraft}
                        onChange={(e) => setCustomReasonDraft(e.target.value)}
                        placeholder="أضف سبب خصم جديد (مثال: خصم أوائل الجمهورية)"
                        className="flex-1 rounded-xl border border-sand-border bg-[#F7F9FA] px-3 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddReason}
                        className="px-3 py-1.5 rounded-xl bg-[#EAF4F8] text-[#0F4C5C] text-xs font-bold hover:bg-[#d8ebf2] cursor-pointer"
                      >
                        + إضافة
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!canManagePricing}
              className="w-full py-3 rounded-xl bg-[#0F4C5C] text-white font-black text-sm hover:bg-[#1D6E7D] transition-all cursor-pointer disabled:opacity-50"
            >
              حفظ تسعير المية وإعدادات الخصم المفتوح
            </button>
          </form>

          {/* Card 2: Promo Codes Engine */}
          <div className="lg:col-span-6 rounded-3xl bg-white border border-sand-border p-5 md:p-6 space-y-5 shadow-soft-luxury">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAF4F8] text-[#0F4C5C] text-[11px] font-black mb-2">
                <Icon name="confirmation_number" size={14} />
                كوبونات وأكواد الخصم
              </span>
              <h3 className="text-lg font-black text-ink-deep">إدارة أكواد الخصم الترويجية</h3>
              <p className="text-xs text-ink-muted mt-1">
                أنشئ أكواداً بنسبة مئوية (%) أو بمبلغ ثابت (ج.م) مع تتبع تلقائي لعدد مرات الاستخدام وتاريخ الانتهاء.
              </p>
            </div>

            {canManagePricing && (
              <form
                onSubmit={handleCreatePromo}
                className="rounded-2xl bg-[#F7F9FA] border border-sand-border p-4 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-ink-slate mb-1">
                      كود الخصم
                    </label>
                    <input
                      type="text"
                      required
                      value={promoCodeDraft}
                      onChange={(e) => setPromoCodeDraft(e.target.value.toUpperCase())}
                      placeholder="SIBLING20"
                      dir="ltr"
                      className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-mono font-bold uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink-slate mb-1">
                      نوع الخصم
                    </label>
                    <select
                      value={promoTypeDraft}
                      onChange={(e) => setPromoTypeDraft(e.target.value as FacilityDiscountType)}
                      className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-bold"
                    >
                      <option value="percent">نسبة مئوية (%)</option>
                      <option value="fixed_egp">مبلغ ثابت (ج.م)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink-slate mb-1">
                      قيمة الخصم
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={promoValueDraft}
                      onChange={(e) => setPromoValueDraft(Math.max(1, Number(e.target.value) || 0))}
                      className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-black tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-ink-slate mb-1">
                      أقصى عدد استخدام (اختياري)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={promoMaxUsesDraft}
                      onChange={(e) => setPromoMaxUsesDraft(e.target.value)}
                      placeholder="غير محدود"
                      className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="promo-expiry-input"
                      className="block text-[11px] font-bold text-ink-slate mb-1"
                    >
                      تاريخ الانتهاء (يوم/شهر/سنة)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="promo-expiry-input"
                        type="text"
                        inputMode="numeric"
                        dir="ltr"
                        value={promoExpiryDisplay}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setPromoExpiryDisplay(nextVal);
                          const parsed = parseArabicDateToIso(nextVal);
                          if (parsed.valid) {
                            setPromoExpiryDraft(parsed.iso);
                            setPromoExpiryError(null);
                          } else {
                            setPromoExpiryDraft("");
                          }
                        }}
                        placeholder="31/12/2026"
                        aria-describedby="promo-expiry-hint"
                        aria-invalid={promoExpiryError ? "true" : undefined}
                        className={`w-full rounded-xl border bg-white pl-9 pr-3 py-2 text-xs text-right placeholder:text-right font-mono tabular-nums ${
                          promoExpiryError ? "border-rose-400" : "border-sand-border"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const picker = nativeDatePickerRef.current as
                            | (HTMLInputElement & { showPicker?: () => void })
                            | null;
                          if (!picker) return;
                          if (typeof picker.showPicker === "function") {
                            picker.showPicker();
                          } else {
                            picker.click();
                          }
                        }}
                        aria-label="اختيار تاريخ الانتهاء من التقويم"
                        title="اختيار من التقويم"
                        className="absolute left-2 w-6 h-6 rounded-lg bg-[#EAF4F8] text-[#1D6E7D] hover:bg-[#1D6E7D] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Icon name="calendar_today" size={13} />
                      </button>
                      <input
                        ref={nativeDatePickerRef}
                        type="date"
                        tabIndex={-1}
                        aria-hidden="true"
                        value={promoExpiryDraft}
                        onChange={(e) => {
                          const iso = e.target.value;
                          setPromoExpiryDraft(iso);
                          setPromoExpiryDisplay(isoToDdMmYyyy(iso));
                          setPromoExpiryError(null);
                        }}
                        className="sr-only pointer-events-none"
                      />
                    </div>
                    <p
                      id="promo-expiry-hint"
                      className={`text-[10px] mt-1 ${
                        promoExpiryError ? "text-rose-700 font-bold" : "text-ink-muted"
                      }`}
                    >
                      {promoExpiryError || "الصيغة العربية: يوم/شهر/سنة (مثال: 31/12/2026)"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink-slate mb-1">
                      وصف قصير (اختياري)
                    </label>
                    <input
                      type="text"
                      value={promoDescDraft}
                      onChange={(e) => setPromoDescDraft(e.target.value)}
                      placeholder="خصم الإخوة والمواهب"
                      className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#1D6E7D] text-white text-xs font-black hover:bg-[#0F4C5C] transition-all cursor-pointer"
                >
                  + إنشاء وحفظ كود الخصم
                </button>
              </form>
            )}

            {/* Existing Promo Codes List */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pl-1">
              {poolConfig.promoCodes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-sand-border p-6 text-center text-xs text-ink-muted">
                  لا توجد أكواد خصم منشأة بعد — يمكنك استخدام نموذج الإضافة بالأعلى أو تفعيل الخصم
                  المفتوح مباشرة أثناء تسجيل المشتركين.
                </div>
              ) : (
                poolConfig.promoCodes.map((promo) => (
                  <div
                    key={promo.id}
                    className={`rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
                      promo.isActive
                        ? "bg-white border-sand-border"
                        : "bg-slate-50 border-slate-200 opacity-75"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          dir="ltr"
                          className="px-2.5 py-0.5 rounded-lg bg-[#EAF4F8] text-[#0F4C5C] font-mono text-xs font-black"
                        >
                          {promo.code}
                        </span>
                        <span className="text-xs font-black text-ink-deep">
                          {promo.discountType === "percent"
                            ? `خصم ${promo.value}%`
                            : `خصم ${promo.value} ج.م`}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            promo.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {promo.isActive ? "مفعّل" : "متوقف"}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-muted flex flex-wrap gap-3">
                        <span>
                          الاستخدام: {promo.usedCount} / {promo.maxUses ?? "مفتوح"}
                        </span>
                        {promo.expiresAtIso && (
                          <span>
                            ينتهي:{" "}
                            <span dir="ltr" className="tabular-nums font-bold">
                              {isoToDdMmYyyy(promo.expiresAtIso)}
                            </span>
                          </span>
                        )}
                        {(promo as FacilityPromoCode & { descriptionAr?: string; noteAr?: string })
                          .noteAr && (
                          <span>
                            •{" "}
                            {
                              (promo as FacilityPromoCode & { descriptionAr?: string; noteAr?: string })
                                .noteAr
                            }
                          </span>
                        )}
                      </div>
                    </div>

                    {canManagePricing && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onTogglePromoCode(promo.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#F7F9FA] text-ink-slate hover:bg-[#EAF4F8] hover:text-[#0F4C5C] text-[11px] font-bold cursor-pointer"
                        >
                          {promo.isActive ? "إيقاف" : "تفعيل"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemovePromoCode(promo.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-bold cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* BENTO ROW 2: Bilateral Linked Academies & Coach QR Governance */}
      {(sectionFilter === "all" || sectionFilter === "academies") && (
        <div className="rounded-3xl bg-white border border-sand-border p-5 md:p-6 space-y-6 shadow-soft-luxury">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAF4F8] text-[#0F4C5C] text-[11px] font-black mb-2">
                <Icon name="hub" size={14} />
                الربط الثنائي للأكاديميات والكباتن + حوكمة مسح QR
              </span>
              <h3 className="text-lg font-black text-ink-deep">
                الأكاديميات المستضيفة والكباتن العاملون داخل المنشأة
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                يمكنك إضافة الأكاديميات والكباتن مباشرة أو مراجعة طلبات الربط الواردة من حساباتهم،
                مع تحديد نوع الاتفاق المالي وتفويض مسح QR للمجموعة (مقفل افتراضياً للأمان).
              </p>
            </div>

            {canManagePermissions && (
              <button
                type="button"
                onClick={() => setShowAddLinkForm((prev) => !prev)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F4C5C] text-white text-xs font-black hover:bg-[#1D6E7D] transition-all cursor-pointer shrink-0"
              >
                <Icon name={showAddLinkForm ? "close" : "add_business"} size={17} />
                {showAddLinkForm ? "إغلاق نموذج الإضافة" : "+ إضافة أكاديمية أو كابتن يدوياً"}
              </button>
            )}
          </div>

          {/* Pending incoming coach/academy requests */}
          {pendingLinks.length > 0 && (
            <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                <Icon name="notification_important" size={18} />
                طلبات ربط واردة بانتظار موافقة المنشأة ({pendingLinks.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingLinks.map((req) => {
                  const chosenAgreement =
                    pendingAgreementOverride[req.id] || req.agreementType || "per_swimmer_water";
                  const chosenScan = pendingScanOverride[req.id] ?? false;
                  return (
                    <div
                      key={req.id}
                      className="rounded-2xl bg-white border border-amber-200 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-black text-sm text-ink-deep">{req.displayNameAr}</div>
                          <div className="text-[11px] text-ink-muted flex flex-wrap gap-2 mt-0.5">
                            <span>{req.entityKind === "academy" ? "أكاديمية" : "كابتن"}</span>
                            {req.linkedMemberCode && (
                              <span className="font-mono text-[#0F4C5C]">{req.linkedMemberCode}</span>
                            )}
                            {req.groupLabelAr && <span>• {req.groupLabelAr}</span>}
                            {req.swimmersCountEstimate ? (
                              <span>• تقدير السباحين: {req.swimmersCountEstimate}</span>
                            ) : null}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                          معلّق
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <select
                          value={chosenAgreement}
                          disabled={!canManagePermissions}
                          onChange={(e) =>
                            setPendingAgreementOverride((prev) => ({
                              ...prev,
                              [req.id]: e.target.value as AcademyAgreementType,
                            }))
                          }
                          className="rounded-xl border border-sand-border bg-[#F7F9FA] px-2.5 py-2 text-xs font-bold disabled:opacity-60"
                        >
                          <option value="per_swimmer_water">حسب استهلاك المية للحصة</option>
                          <option value="fixed_monthly">اتفاق شهري ثابت للمجموعة</option>
                        </select>

                        <label className="flex items-center gap-2 rounded-xl border border-sand-border bg-[#F7F9FA] px-2.5 py-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={chosenScan}
                            disabled={!canManagePermissions}
                            onChange={(e) =>
                              setPendingScanOverride((prev) => ({
                                ...prev,
                                [req.id]: e.target.checked,
                              }))
                            }
                            className="accent-[#0F4C5C] disabled:opacity-60"
                          />
                          <span className="text-[11px] font-bold text-ink-deep">
                            منح صلاحية مسح QR
                          </span>
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!canManagePermissions}
                          onClick={async () => {
                            const res = await onReviewLinkedEntity(req.id, {
                              status: "approved",
                              agreementType: chosenAgreement,
                              canScanGroupQr: chosenScan,
                            });
                            setStatusFeedback({
                              tone: res.ok ? "success" : "error",
                              text: res.messageAr,
                            });
                          }}
                          className="flex-1 py-2 rounded-xl bg-[#0F4C5C] text-white text-xs font-black hover:bg-[#1D6E7D] cursor-pointer disabled:opacity-50"
                        >
                          موافقة واعتماد الربط
                        </button>
                        <button
                          type="button"
                          disabled={!canManagePermissions}
                          onClick={async () => {
                            const res = await onReviewLinkedEntity(req.id, {
                              status: "rejected",
                              canScanGroupQr: false,
                            });
                            setStatusFeedback({
                              tone: res.ok ? "success" : "error",
                              text: res.messageAr,
                            });
                          }}
                          className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 cursor-pointer disabled:opacity-50"
                        >
                          رفض
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Direct Add Academy / Coach Form */}
          {showAddLinkForm && canManagePermissions && (
            <form
              onSubmit={handleAddDirectLink}
              className="rounded-2xl bg-[#F7F9FA] border border-[#1D6E7D]/30 p-4 md:p-5 space-y-4"
            >
              <div className="text-sm font-black text-[#0F4C5C]">
                إضافة أكاديمية مستأجرة أو كابتن متعاقد داخل المنشأة
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-slate mb-1">النوع</label>
                  <select
                    value={linkKind}
                    onChange={(e) => setLinkKind(e.target.value as "academy" | "coach")}
                    className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="academy">أكاديمية / مجموعة مستضيفة</option>
                    <option value="coach">كابتن خاص / متعاقد</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-slate mb-1">
                    اسم الأكاديمية أو الكابتن
                  </label>
                  <input
                    type="text"
                    required
                    value={linkDisplayName}
                    onChange={(e) => setLinkDisplayName(e.target.value)}
                    placeholder="مثال: أكاديمية النجوم / ك. كريم"
                    className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-slate mb-1">
                    كود العضو على كابتنلي (اختياري)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={linkMemberCode}
                    onChange={(e) => setLinkMemberCode(e.target.value.toUpperCase())}
                    placeholder="MEM-..."
                    className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-slate mb-1">
                    اسم المجموعة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={linkGroupLabel}
                    onChange={(e) => setLinkGroupLabel(e.target.value)}
                    placeholder="براعم مسائي / تجهيزي 5م"
                    className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-slate mb-1">
                    المسؤول / المالك
                  </label>
                  <input
                    type="text"
                    value={linkOwnerName}
                    onChange={(e) => setLinkOwnerName(e.target.value)}
                    placeholder="اسم الكابتن المسؤول"
                    className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-slate mb-1">
                    واتساب / هاتف
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={linkPhone}
                    onChange={(e) => setLinkPhone(e.target.value)}
                    placeholder="010..."
                    className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-slate mb-1">
                    نظام المحاسبة المالية
                  </label>
                  <select
                    value={linkAgreementType}
                    onChange={(e) => setLinkAgreementType(e.target.value as AcademyAgreementType)}
                    className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="per_swimmer_water">مقابل مية على كل سباح/حصة</option>
                    <option value="fixed_monthly">اتفاق شهري مقطوع</option>
                  </select>
                </div>
                {linkAgreementType === "fixed_monthly" ? (
                  <div>
                    <label className="block text-[11px] font-bold text-ink-slate mb-1">
                      قيمة الاتفاق الشهري (ج.م)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={linkFixedMonthly}
                      onChange={(e) => setLinkFixedMonthly(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-black tabular-nums"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-ink-slate mb-1">
                      سعر مية مخصص لهذه الجهة (اختياري)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={linkCustomWaterFee}
                      onChange={(e) => setLinkCustomWaterFee(e.target.value)}
                      placeholder={`افتراضي المنشأة (${poolConfig.waterFeePerSessionEgp} ج)`}
                      className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs tabular-nums"
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2.5 rounded-xl bg-white border border-sand-border px-3.5 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkCanScanQr}
                  onChange={(e) => setLinkCanScanQr(e.target.checked)}
                  className="w-4 h-4 accent-[#0F4C5C]"
                />
                <span className="text-xs font-bold text-ink-deep">
                  تفويض مسح QR للمجموعة (مقفل افتراضياً للأمان — يُفتح فقط لمن تثق المنشأة بتسجيله للحصص من
                  المسبح)
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={linkSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#0F4C5C] text-white text-xs font-black hover:bg-[#1D6E7D] cursor-pointer disabled:opacity-50"
                >
                  {linkSaving ? "جاري الحفظ..." : "اعتماد وإضافة للجدول المالي"}
                </button>
              </div>
            </form>
          )}

          {!canEditLinkedCollections && approvedLinks.length > 0 && (
            <div className="rounded-2xl bg-amber-50/80 border border-amber-200 px-3.5 py-2.5 text-xs font-bold text-amber-900 flex items-center gap-2">
              <Icon name="lock" size={16} />
              <span>
                حقول التحصيل الشهري وتعديل ربط الأكاديميات المستضيفة في وضع القراءة فقط — التعديل
                مقصور على مالك المنشأة أو المشرف العام.
              </span>
            </div>
          )}

          {/* Approved Linked Academies & Governance List */}
          <div className="space-y-3">
            {approvedLinks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-sand-border p-6 text-center text-xs text-ink-muted">
                لم يتم اعتماد أكاديميات أو كباتن مرتبطين بعد. أضف أول أكاديمية أو كابتن من الزر
                أعلاه لضبط محاسبة المية وصلاحية مسح QR.
              </div>
            ) : (
              approvedLinks.map((link) => {
                const collectedVal =
                  collectedDraftByLink[link.id] ?? String(link.collectedMonthlyEgp ?? 0);
                return (
                  <div
                    key={link.id}
                    className="rounded-2xl border border-sand-border bg-[#F7F9FA]/70 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-sm text-[#0F4C5C]">
                          {link.displayNameAr}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#EAF4F8] text-[#0F4C5C] text-[10px] font-bold">
                          {link.entityKind === "academy" ? "أكاديمية مستأجرة" : "كابتن"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            link.agreementType === "fixed_monthly"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-teal-50 text-teal-800"
                          }`}
                        >
                          {link.agreementType === "fixed_monthly"
                            ? `اتفاق شهري (${link.fixedMonthlyAmountEgp ?? 0} ج.م)`
                            : `حسب المية (${
                                link.customWaterFeePerSessionEgp ?? poolConfig.waterFeePerSessionEgp
                              } ج.م/حصة)`}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-muted flex flex-wrap gap-3">
                        {link.ownerNameAr && <span>المسؤول: {link.ownerNameAr}</span>}
                        {link.groupLabelAr && <span>المجموعة: {link.groupLabelAr}</span>}
                        {link.linkedMemberCode && (
                          <span dir="ltr" className="font-mono text-[#0F4C5C]">
                            {link.linkedMemberCode}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Monthly collection tracker */}
                      <div className="flex items-center gap-1.5 rounded-xl bg-white border border-sand-border px-2.5 py-1.5">
                        <span className="text-[11px] font-bold text-ink-muted">المحصّل (ج):</span>
                        <input
                          type="number"
                          min={0}
                          readOnly={!canEditLinkedCollections}
                          disabled={!canEditLinkedCollections}
                          value={collectedVal}
                          onChange={(e) =>
                            setCollectedDraftByLink((prev) => ({
                              ...prev,
                              [link.id]: e.target.value,
                            }))
                          }
                          className="w-20 text-xs font-black text-[#0F4C5C] tabular-nums bg-transparent focus:outline-none disabled:opacity-60"
                        />
                        {canEditLinkedCollections ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await onReviewLinkedEntity(link.id, {
                                collectedMonthlyEgp: Math.max(0, Number(collectedVal) || 0),
                              });
                              setStatusFeedback({
                                tone: res.ok ? "success" : "error",
                                text: res.messageAr,
                              });
                            }}
                            className="px-2 py-1 rounded-lg bg-[#EAF4F8] text-[#0F4C5C] text-[10px] font-black hover:bg-[#d7ebf3] cursor-pointer"
                          >
                            حفظ
                          </button>
                        ) : (
                          <span
                            title="تعديل المحصّل الشهري للأكاديميات المستضيفة مقصور على مالك المنشأة والمشرف العام"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold"
                          >
                            <Icon name="lock" size={12} />
                            للقراءة فقط (صلاحية المالك / المشرف العام)
                          </span>
                        )}
                      </div>

                      {/* Agreement quick toggle */}
                      {canManagePermissions && (
                        <button
                          type="button"
                          onClick={async () => {
                            const nextType: AcademyAgreementType =
                              link.agreementType === "fixed_monthly"
                                ? "per_swimmer_water"
                                : "fixed_monthly";
                            const res = await onReviewLinkedEntity(link.id, {
                              agreementType: nextType,
                            });
                            setStatusFeedback({
                              tone: res.ok ? "success" : "error",
                              text: res.messageAr,
                            });
                          }}
                          className="px-3 py-2 rounded-xl bg-white border border-sand-border text-[11px] font-bold text-ink-slate hover:border-[#1D6E7D] hover:text-[#0F4C5C] cursor-pointer"
                        >
                          تبديل نوع الاتفاق
                        </button>
                      )}

                      {/* Delegated QR Scan Governance Toggle */}
                      <button
                        type="button"
                        disabled={!canManagePermissions}
                        onClick={async () => {
                          const res = await onReviewLinkedEntity(link.id, {
                            canScanGroupQr: !link.canScanGroupQr,
                          });
                          setStatusFeedback({
                            tone: res.ok ? "success" : "error",
                            text: res.messageAr,
                          });
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-50 ${
                          link.canScanGroupQr
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        <Icon
                          name={link.canScanGroupQr ? "qr_code_scanner" : "lock"}
                          size={15}
                        />
                        {link.canScanGroupQr
                          ? "مفوّض بمسح QR مجموعته"
                          : "مقفل (البوابة فقط تمسح)"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {facilityCoachList.length > 0 && (
            <div className="rounded-2xl bg-[#EAF4F8]/60 border border-[#1D6E7D]/20 p-3.5 text-xs text-[#0F4C5C] flex items-center gap-2">
              <Icon name="info" size={16} />
              <span>
                يوجد أيضاً <strong>{facilityCoachList.length}</strong> مدرب مسجل ضمن طاقم المنشأة
                المباشر في تبويب «كباتن المنشأة» — يُنصح بربط الكابتن أعلاه ككيان معتمد عندما تريد
                تفويضه بمسح QR أو تتبع حساب المية لمجموعته.
              </span>
            </div>
          )}

          {rejectedLinks.length > 0 && (
            <details className="text-xs text-ink-muted">
              <summary className="cursor-pointer font-bold hover:text-ink-deep">
                عرض الطلبات المرفوضة ({rejectedLinks.length})
              </summary>
              <div className="mt-2 space-y-2">
                {rejectedLinks.map((rej) => (
                  <div
                    key={rej.id}
                    className="rounded-xl border border-sand-border p-3 flex items-center justify-between"
                  >
                    <span>
                      {rej.displayNameAr} ({rej.linkedMemberCode || "بدون كود"})
                    </span>
                    {canManagePermissions && (
                      <button
                        type="button"
                        onClick={() =>
                          onReviewLinkedEntity(rej.id, {
                            status: "approved",
                            canScanGroupQr: false,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#EAF4F8] text-[#0F4C5C] font-bold cursor-pointer"
                      >
                        إعادة التفعيل والاعتماد
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* BENTO ROW 3: Facility Staff Members & Gate Kiosk Operator Access */}
      {(sectionFilter === "all" || sectionFilter === "staff") && (
        <div className="rounded-3xl bg-white border border-sand-border p-5 md:p-6 space-y-5 shadow-soft-luxury">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAF4F8] text-[#0F4C5C] text-[11px] font-black mb-2">
                <Icon name="badge" size={14} />
                طاقم العمل ومشغلو البوابة
              </span>
              <h3 className="text-lg font-black text-ink-deep">
                تعيين موظفي المنشأة (البوابة / الاشتراكات / الحسابات)
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                يمكن لأي عضو لديه حساب على كابتنلي استلام صلاحية تشغيل كشك البوابة أو الحسابات داخل
                هذه المنشأة.
              </p>
            </div>
          </div>

          {canManageStaff && onAddStaffMember ? (
            <form
              onSubmit={handleAssignStaff}
              className="rounded-2xl bg-[#F7F9FA] border border-sand-border p-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-slate mb-1">
                    اسم الموظف *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffFullNameDraft}
                    onChange={(e) => setStaffFullNameDraft(e.target.value)}
                    placeholder="اسم الموظف ثلاثياً"
                    className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-slate mb-1">
                    الدور الوظيفي *
                  </label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as FacilityStaffRole)}
                    className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="subscriptions_manager">مسؤول البوابة والاشتراكات</option>
                    <option value="accounts_manager">مسؤول الحسابات والتسعير</option>
                    <option value="general_staff">مشرف إدارة عام</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-slate mb-1">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={staffPhoneDraft}
                    onChange={(e) => setStaffPhoneDraft(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className="w-full rounded-xl border border-sand-border bg-white px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-slate mb-1">
                    ربط بحساب كابتنلي (اختياري)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={staffSearchQuery}
                      onChange={(e) => setStaffSearchQuery(e.target.value)}
                      placeholder="CAP-M-XXXX أو الاسم"
                      className="flex-1 rounded-xl border border-sand-border bg-white px-3 py-2 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSearchStaff}
                      disabled={staffSearching || !staffSearchQuery.trim()}
                      className="px-3 py-2 rounded-xl bg-[#EAF4F8] text-[#0F4C5C] text-xs font-black hover:bg-[#d7ebf3] cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {staffSearching ? "..." : "بحث"}
                    </button>
                  </div>
                </div>
              </div>

              {staffSearchResults.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {staffSearchResults.map((cand) => (
                    <button
                      key={cand.memberCode}
                      type="button"
                      onClick={() => {
                        setStaffFullNameDraft(cand.fullNameAr);
                        if (cand.phone) setStaffPhoneDraft(cand.phone);
                        setStaffSearchQuery(cand.memberCode);
                        setStaffSearchResults([]);
                        setStatusFeedback({
                          tone: "success",
                          text: `تم اختيار الحساب «${cand.fullNameAr}» (${cand.memberCode}) — اضغط اعتماد التعيين.`,
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-white text-ink-deep border-[#1D6E7D]/40 hover:bg-[#EAF4F8] cursor-pointer"
                    >
                      {cand.fullNameAr} — <span className="font-mono text-[#0F4C5C]">{cand.memberCode}</span>
                      {cand.city ? ` (${cand.city})` : ""}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0F4C5C] text-white text-xs font-black hover:bg-[#1D6E7D] cursor-pointer"
                >
                  + اعتماد تعيين الموظف وتفعيل صلاحيته
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-2xl bg-amber-50/80 border border-amber-200 px-3.5 py-2.5 text-xs font-bold text-amber-900 flex items-center gap-2">
              <Icon name="lock" size={16} />
              <span>
                إضافة موظفين جدد أو إلغاء صلاحيات الطاقم مقصورة على مالك المنشأة فقط (وضع القراءة
                فقط).
              </span>
            </div>
          )}

          {/* Assigned staff cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {facilityStaffList.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-sand-border p-5 text-center text-xs text-ink-muted">
                لا يوجد موظفون مضافون حالياً — يملك مالك المنشأة جميع صلاحيات الكشك والتسعير.
              </div>
            ) : (
              facilityStaffList.map((st) => (
                <div
                  key={st.id}
                  className="rounded-2xl border border-sand-border bg-[#F7F9FA] p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="font-black text-sm text-[#0F4C5C]">{st.fullNameAr}</div>
                      {st.hasAccount && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            st.invitationStatus === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : st.invitationStatus === "declined" || st.invitationStatus === "revoked"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {st.invitationStatus === "pending"
                            ? "بانتظار القبول"
                            : st.invitationStatus === "declined"
                              ? "مرفوضة"
                              : st.invitationStatus === "revoked"
                                ? "ملغاة"
                                : "مفعل ✓"}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-muted font-mono mt-0.5">
                      {st.linkedMemberCode || st.email || "موظف مسجل إدارياً"}
                    </div>
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-[#EAF4F8] text-[#0F4C5C] text-[10px] font-black">
                      {st.roleTitleAr}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-sand-border/60">
                    {onSwitchToStaffMode &&
                      (!st.invitationStatus || st.invitationStatus === "accepted") && (
                        <button
                          type="button"
                          onClick={() => onSwitchToStaffMode(st.id)}
                          className="flex-1 py-1.5 rounded-xl bg-[#0F4C5C] text-white text-[11px] font-black hover:bg-[#1D6E7D] cursor-pointer"
                        >
                          معاينة واجهة الموظف
                        </button>
                      )}
                    {canManageStaff && onRemoveStaffMember && (
                      <button
                        type="button"
                        onClick={() => onRemoveStaffMember(st.id)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-[11px] font-bold hover:bg-rose-100 cursor-pointer"
                      >
                        إلغاء الصلاحية
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
