"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RoleAccessDeniedScreen } from "@/components/auth/RoleAccessDeniedScreen";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { DynamicScheduleCardsBuilder } from "@/components/editorial/DynamicScheduleCardsBuilder";
import { AuthorArticlesManager } from "@/components/editorial/AuthorArticlesManager";
import { AvatarUploader } from "@/components/editorial/AvatarUploader";
import { QrCameraScannerModal } from "@/components/qr/QrCameraScannerModal";
import { FacilityOpsAuditTab } from "@/components/facility-desk/FacilityOpsAuditTab";
import { FacilitySubscribersTab } from "@/components/facility-desk/FacilitySubscribersTab";
import { FacilitySettingsDeskTab } from "@/components/facility-desk/FacilitySettingsDeskTab";
import type { FacilityStaffRole } from "@/types/captenly";

type FacilitySectionTab =
  | "ops"
  | "subscribers"
  | "desk_settings"
  | "schedules"
  | "coaches"
  | "articles";

const TRACK_LABELS: Record<"school" | "buds" | "prep" | "team" | "ladies", string> = {
  school: "مدارس السباحة",
  buds: "البراعم والتأسيس",
  prep: "التجهيزي والمهارات",
  team: "الفرق والبطولات",
  ladies: "مواعيد السيدات",
};

export default function FacilityDashboardPage() {
  const {
    facilities,
    coaches,
    sessionLedgers,
    verifiedLeads,
    memberRegistry,
    facilityLinks,
    enrollSwimmerByMemberCode,
    enrollSwimmerByMemberCodeAsync,
    checkInSession,
    checkInSessionAsync,
    checkInBySubscriptionCode,
    checkInBySubscriptionCodeAsync,
    lookupStaffCandidatesRemote,
    recordCoachSkillAndPB,
    renewSwimmerSubscription,
    renewSwimmerSubscriptionAsync,
    confirmReceiptByProvider,
    confirmReceiptByProviderAsync,
    currentPersona,
    isAuthenticated,
    effectiveOffline,
    offlineQueue,
    syncStatusSummary,
    syncOfflineQueue,
    syncOfflineQueueAsync,
    retryFailedOfflineQueue,
    syncLedgersFromServer,
    roleClaims,
    myStaffAssignments,
    activeStaffAssignment,
    switchToStaffMode,
    addFacilityStaffMember,
    removeFacilityStaffMember,
    addFacilityCoachRosterEntry,
    removeFacilityCoachRosterEntry,
    updateFacilityHeroImage,
    updateFacilityPoolDeskConfig,
    saveFacilityPromoCode,
    toggleFacilityPromoCode,
    removeFacilityPromoCode,
    addDirectFacilityLinkedEntity,
    reviewFacilityLinkedEntity,
  } = useCaptenly();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [prefillMemberCode, setPrefillMemberCode] = useState("");
  const [prefillAthleteName, setPrefillAthleteName] = useState("");
  const [deskFocusSection, setDeskFocusSection] = useState<
    "all" | "pricing" | "academies" | "staff"
  >("all");

  const verifiedActiveStaffAssignment =
    activeStaffAssignment &&
    (!activeStaffAssignment.invitationStatus ||
      activeStaffAssignment.invitationStatus === "accepted")
      ? activeStaffAssignment
      : null;

  const boundFacilityId =
    verifiedActiveStaffAssignment?.facilityId || currentPersona.linkedFacilityId || "";
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(boundFacilityId);

  useEffect(() => {
    if (boundFacilityId) {
      setSelectedFacilityId(boundFacilityId);
    }
  }, [boundFacilityId]);

  const facility = useMemo(
    () => facilities.find((f) => f.id === (selectedFacilityId || boundFacilityId)) || null,
    [facilities, selectedFacilityId, boundFacilityId]
  );

  // Staff permissions inside facility dashboard
  const isStaffMode = Boolean(verifiedActiveStaffAssignment);
  const staffRole: FacilityStaffRole | null = verifiedActiveStaffAssignment?.role || null;

  const allowedTabs: { id: FacilitySectionTab; labelAr: string; icon: string }[] = useMemo(() => {
    const all: { id: FacilitySectionTab; labelAr: string; icon: string }[] = [
      { id: "ops", labelAr: "عمليات اليوم والرقابة", icon: "fact_check" },
      { id: "subscribers", labelAr: "المشتركون والمية", icon: "groups" },
      { id: "desk_settings", labelAr: "التسعير والأكاديميات والصلاحيات", icon: "tune" },
      { id: "schedules", labelAr: "بطاقات المواعيد والأسعار", icon: "schedule" },
      { id: "coaches", labelAr: "كباتن الأكاديمية والشهادات", icon: "sports" },
      { id: "articles", labelAr: "مقالات ومنشورات المنشأة", icon: "article" },
    ];
    if (isStaffMode && staffRole === "subscriptions_manager") {
      return all.filter((t) => t.id === "ops" || t.id === "subscribers");
    }
    if (isStaffMode && staffRole === "accounts_manager") {
      return all.filter(
        (t) => t.id === "desk_settings" || t.id === "schedules" || t.id === "subscribers"
      );
    }
    return all;
  }, [isStaffMode, staffRole]);

  const [activeTab, setActiveTab] = useState<FacilitySectionTab>("ops");

  // Support deep links like /dashboard/facility?tab=subscribers or ?tab=staff
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const qTab = sp.get("tab");
    if (qTab === "staff") {
      setActiveTab("desk_settings");
      setDeskFocusSection("staff");
    } else if (
      qTab === "ops" ||
      qTab === "subscribers" ||
      qTab === "desk_settings" ||
      qTab === "schedules" ||
      qTab === "coaches" ||
      qTab === "articles"
    ) {
      setActiveTab(qTab);
    }
  }, []);

  useEffect(() => {
    if (!allowedTabs.some((t) => t.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id || "subscribers");
    }
  }, [allowedTabs, activeTab]);

  // Add Academy Coach Form state
  const [coachNameInput, setCoachNameInput] = useState("");
  const [coachRoleInput, setCoachRoleInput] = useState("");
  const [coachSpecialtyInput, setCoachSpecialtyInput] = useState("");
  const [coachCertsInput, setCoachCertsInput] = useState("");
  const [coachScheduleInput, setCoachScheduleInput] = useState("");
  const [coachCodeQuery, setCoachCodeQuery] = useState("");
  const [isSavingCoach, setIsSavingCoach] = useState(false);

  // Feedback message
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const facilityLedgers = useMemo(
    () => (facility ? sessionLedgers.filter((l) => l.facilityId === facility.id) : []),
    [sessionLedgers, facility]
  );

  const scopedLinks = useMemo(
    () => (facility ? facilityLinks.filter((l) => l.facilityId === facility.id) : []),
    [facilityLinks, facility]
  );

  const facilityLeads = useMemo(
    () => (facility ? verifiedLeads.filter((l) => l.targetId === facility.id) : []),
    [verifiedLeads, facility]
  );

  const pendingOfflineCount = offlineQueue.filter((q) => !q.synced).length;

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="لوحة إدارة المنشأة تتطلب تسجيل الدخول"
        descriptionAr="سجّل دخولك بحساب إدارة الأكاديمية أو المسبح (أو بحساب موظف مخوّل) لإدارة المشتركين والفرق وبطاقات المواعيد والأسعار."
      />
    );
  }

  if (currentPersona.role !== "facility_manager" && !isStaffMode) {
    return (
      <RoleAccessDeniedScreen
        descriptionAr="لوحة إدارة المنشأة متاحة فقط لحساب مدير المنشأة أو الموظفين المفعلين بصلاحية منشأة."
        fallbackHref={currentPersona.role === "coach" ? "/dashboard/coach" : "/dashboard/athlete"}
        fallbackLabelAr="الانتقال إلى لوحتي"
      />
    );
  }

  if (!facility) {
    const myFacilityClaims = roleClaims.filter((c) => c.claimType === "facility");
    const latestFacilityClaim = myFacilityClaims[0];
    const acceptedStaffInvites = myStaffAssignments.filter(
      (st) => !st.invitationStatus || st.invitationStatus === "accepted"
    );

    return (
      <div className="min-h-screen bg-[#F7F9FA] pt-8 pb-20" dir="rtl">
        <div className="max-w-3xl mx-auto px-4 flex flex-col gap-6 animate-captenly-enter">
          <div className="rounded-3xl bg-white p-6 md:p-8 shadow-soft-luxury border border-sand-border flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0F4C5C] text-white flex items-center justify-center">
                <Icon name="pool" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-black text-[#0F4C5C]">
                  لا توجد منشأة مرتبطة بحسابك حتى الآن
                </h1>
                <p className="text-xs text-ink-muted mt-0.5">
                  أضف اسم منشأتك أو أكاديميتك وحدد موقعها الدقيق عبر الخريطة لتُفتح لك لوحة
                  الإدارة مباشرة، أو اقبل دعوة وظيفية من منشأة قائمة.
                </p>
              </div>
            </div>

            {latestFacilityClaim && (
              <div className="rounded-2xl bg-[#EAF4F8] p-4 border border-[#1D6E7D]/25 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-xs text-[#0F4C5C]">
                    حالة طلبك:{" "}
                    {latestFacilityClaim.targetFacilityNameAr ||
                      (typeof latestFacilityClaim.proposedPayload?.nameAr === "string"
                        ? latestFacilityClaim.proposedPayload.nameAr
                        : undefined) ||
                      "توثيق منشأة"}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      latestFacilityClaim.status === "pending_review"
                        ? "bg-amber-100 text-amber-900"
                        : latestFacilityClaim.status === "rejected"
                          ? "bg-rose-100 text-rose-800"
                          : latestFacilityClaim.status === "withdrawn"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-[#0F4C5C] text-white"
                    }`}
                  >
                    {latestFacilityClaim.status === "pending_review"
                      ? "⏳ قيد مراجعة الإدارة"
                      : latestFacilityClaim.status === "rejected"
                        ? "مرفوض"
                        : latestFacilityClaim.status === "withdrawn"
                          ? "تم سحب الطلب"
                          : "معتمد"}
                  </span>
                </div>
                {latestFacilityClaim.reviewerNoteAr && (
                  <p className="text-xs text-ink-muted">{latestFacilityClaim.reviewerNoteAr}</p>
                )}
              </div>
            )}

            {acceptedStaffInvites.length > 0 && (
              <div className="rounded-2xl bg-[#F7F9FA] p-4 border border-sand-border flex flex-col gap-2.5">
                <span className="text-xs font-bold text-[#0F4C5C]">
                  منشآت لديك فيها صلاحية موظف مفعّلة:
                </span>
                <div className="flex flex-wrap gap-2">
                  {acceptedStaffInvites.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => switchToStaffMode(st.id)}
                      className="px-4 py-2 rounded-full bg-[#0F4C5C] text-white text-xs font-bold hover:bg-[#1D6E7D] cursor-pointer"
                    >
                      الدخول كـ {st.roleTitleAr} في {st.facilityNameAr} ←
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/claim"
                className="px-6 py-3 rounded-full bg-[#0F4C5C] text-white font-bold text-xs shadow-soft-luxury hover:bg-[#1D6E7D]"
              >
                أضف منشأتك / أكاديميتك وحدد موقعها الآن ←
              </Link>
              <Link
                href="/dashboard/athlete"
                className="px-5 py-3 rounded-full bg-[#F7F9FA] border border-sand-border text-[#0F4C5C] font-bold text-xs"
              >
                العودة للوحة العضو
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isUnclaimed = facility.supplyStatus === "seeded_unclaimed";

  const handleAddCoachRoster = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingCoach || !coachNameInput.trim()) return;
    setIsSavingCoach(true);
    try {
      const certs = coachCertsInput
        .split(/[\n,،]+/)
        .map((c) => c.trim())
        .filter(Boolean);

      const res = addFacilityCoachRosterEntry(facility.id, {
        fullNameAr: coachNameInput.trim(),
        roleTitleAr: coachRoleInput.trim(),
        specialtyAr: coachSpecialtyInput.trim(),
        certificatesAr: certs,
        scheduleAr: coachScheduleInput.trim(),
        coachIdOrCode: coachCodeQuery.trim() || undefined,
      });
      setFeedback({ ok: res.ok, msg: res.messageAr });
      if (res.ok) {
        setCoachNameInput("");
        setCoachCodeQuery("");
      }
    } finally {
      setIsSavingCoach(false);
    }
  };

  const affiliatedRegisteredCoaches = coaches.filter((c) =>
    facility.affiliatedCoachIds.includes(c.id)
  );
  const rosterCoaches = facility.coachRoster || [];

  return (
    <div className="min-h-screen bg-[#F7F9FA] pt-6 pb-24" dir="rtl">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 flex flex-col gap-6">
        {/* Staff Mode Active Banner */}
        {isStaffMode && activeStaffAssignment && (
          <div className="rounded-2xl bg-[#EAF4F8] border-2 border-[#1D6E7D] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-soft-luxury animate-captenly-enter">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0F4C5C] text-white flex items-center justify-center shrink-0">
                <Icon name="badge" size={20} />
              </div>
              <div>
                <div className="text-xs font-black text-[#0F4C5C]">
                  وضع تبديل الحساب الوظيفي نشط — {activeStaffAssignment.roleTitleAr}
                </div>
                <p className="text-xs text-ink-slate mt-0.5">
                  أنت تتصفح الآن واجهة <strong>{facility.nameAr}</strong> بصلاحيات محددة لوظيفتك (
                  {activeStaffAssignment.roleTitleAr}) فقط.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => switchToStaffMode(null)}
              className="px-4 py-2 rounded-full bg-[#0F4C5C] text-white text-xs font-bold shrink-0 hover:bg-[#1D6E7D] cursor-pointer"
            >
              إنهاء وضع الموظف والعودة لحسابي الشخصي ↩
            </button>
          </div>
        )}

        {/* Option B Deep Ocean Hero Bar */}
        <section className="rounded-3xl bg-[#0F4C5C] text-white p-6 md:p-8 shadow-soft-luxury flex flex-col lg:flex-row lg:items-center justify-between gap-6 border border-[#1D6E7D]/40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {!isStaffMode || staffRole === "general_staff" ? (
              <AvatarUploader
                size="lg"
                shape="rounded"
                darkSurface
                initialUrl={facility.heroImage}
                titleAr="ضبط وتكبير صورة أو شعار المنشأة"
                labelAr="تغيير صورة المنشأة"
                onLocalSelect={(dataUrl) => updateFacilityHeroImage(facility.id, dataUrl)}
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/10 border-2 border-white/25 flex items-center justify-center shrink-0">
                {facility.heroImage ? (
                  <img
                    src={facility.heroImage}
                    alt={facility.nameAr}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Icon name="pool" size={30} />
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    isUnclaimed
                      ? "bg-amber-400/20 text-amber-200"
                      : facility.supplyStatus === "verified_active"
                        ? "bg-emerald-400/20 text-emerald-100 border border-emerald-300/30"
                        : "bg-white/15 text-white"
                  }`}
                >
                  {isUnclaimed
                    ? "منشأة بانتظار التفعيل الرسمي"
                    : facility.supplyStatus === "verified_active"
                      ? "✓ منشأة موثقة رسمياً بالشارة الخضراء"
                      : "✓ منشأة منشورة وتُدار عبر حسابك"}
                </span>
                <span className="text-xs text-[#EAF4F8]/90">
                  {facility.city}
                  {facility.district ? ` • ${facility.district}` : ""}
                  {facility.locations && facility.locations.length > 1
                    ? ` (+${facility.locations.length - 1} مواقع أخرى)`
                    : ""}
                </span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    effectiveOffline
                      ? "bg-amber-400 text-[#0F4C5C]"
                      : "bg-white/15 text-[#EAF4F8]"
                  }`}
                >
                  {effectiveOffline
                    ? "وضع الأوفلاين نشط (حفظ محلي ومزامنة تلقائية)"
                    : "متصل ومزامن سحابياً ✓"}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black text-white">
                {isStaffMode && activeStaffAssignment
                  ? `${facility.nameAr} — (${activeStaffAssignment.roleTitleAr})`
                  : `غرفة عمليات وإدارة المنشأة: ${facility.nameAr}`}
              </h1>
              <p className="text-xs md:text-sm text-[#EAF4F8]/85 max-w-2xl leading-relaxed">
                بوابة QR ميدانية أوفلاين، رقابة حضور اليوم، تسعير مية ديناميكي لكل منشأة مع
                الخصومات، ربط الأكاديميات وصلاحيات مسح الكباتن.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {(pendingOfflineCount > 0 || (syncStatusSummary?.failedCount ?? 0) > 0) && (
              <button
                type="button"
                onClick={async () => {
                  if ((syncStatusSummary?.failedCount ?? 0) > 0 && retryFailedOfflineQueue) {
                    const r = await retryFailedOfflineQueue();
                    setFeedback({
                      ok: r.failedCount === 0 && !r.stoppedReason,
                      msg:
                        r.failedCount === 0 && !r.stoppedReason
                          ? `تمت مزامنة ${r.syncedCount} عملية بنجاح ✓`
                          : r.lastErrorAr || `نجحت ${r.syncedCount} وفشلت ${r.failedCount} عمليات.`,
                    });
                  } else if (syncOfflineQueueAsync) {
                    const r = await syncOfflineQueueAsync();
                    setFeedback({
                      ok: r.failedCount === 0 && !r.stoppedReason,
                      msg:
                        r.failedCount === 0 && !r.stoppedReason
                          ? `تمت مزامنة ${r.syncedCount} عملية بنجاح ✓`
                          : r.lastErrorAr || `تمت مزامنة ${r.syncedCount} وتعثرت ${r.failedCount} عمليات.`,
                    });
                  } else {
                    syncOfflineQueue();
                  }
                }}
                className={`px-4 py-2.5 rounded-full text-xs font-black cursor-pointer ${
                  (syncStatusSummary?.failedCount ?? 0) > 0
                    ? "bg-rose-500 text-white hover:bg-rose-600"
                    : "bg-amber-400 text-[#0F4C5C] hover:bg-amber-300"
                }`}
              >
                {(syncStatusSummary?.failedCount ?? 0) > 0
                  ? `إعادة محاولة (${syncStatusSummary?.failedCount}) عملية متعثرة ↻`
                  : `مزامنة ${pendingOfflineCount} عملية أوفلاين ↻`}
              </button>
            )}

            {(!isStaffMode ||
              staffRole === "subscriptions_manager" ||
              staffRole === "general_staff") && (
              <>
                <Link
                  href="/dashboard/facility/gate"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0F4C5C] font-black text-xs hover:bg-[#EAF4F8] shadow-soft-luxury transition-all"
                >
                  <Icon name="qr_code_scanner" size={18} />
                  <span>فتح كشك البوابة QR</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#1D6E7D] text-white font-bold text-xs hover:bg-[#237f90] border border-white/20 cursor-pointer"
                >
                  <Icon name="photo_camera" size={16} />
                  <span>مسح سريع من اللوحة</span>
                </button>
              </>
            )}

            <Link
              href="/claim"
              className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs text-center border border-white/15"
            >
              تعديل المواقع والفروع
            </Link>
            <Link
              href={`/academy/${facility.slug}`}
              className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs text-center border border-white/15"
            >
              معاينة صفحة المنشأة العامة ←
            </Link>
          </div>
        </section>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`rounded-2xl p-4 flex items-center justify-between border animate-captenly-enter ${
              feedback.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
              <Icon name={feedback.ok ? "check_circle" : "warning"} size={20} />
              <span>{feedback.msg}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-bold underline shrink-0 mr-3 cursor-pointer"
            >
              إخفاء
            </button>
          </div>
        )}

        {/* Option B KPI Metrics Row */}
        {(!isStaffMode || staffRole === "accounts_manager" || staffRole === "general_staff") && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-soft-luxury border border-sand-border">
              <span className="text-xs text-ink-muted">المشتركون والدفاتر النشطة</span>
              <div className="text-2xl sm:text-3xl font-black text-[#0F4C5C] mt-1 tabular-nums">
                {facilityLedgers.length}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-soft-luxury border border-sand-border">
              <span className="text-xs text-ink-muted">الأكاديميات والكباتن المرتبطون</span>
              <div className="text-2xl sm:text-3xl font-black text-[#1D6E7D] mt-1 tabular-nums">
                {scopedLinks.filter((l) => l.status === "approved").length}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-soft-luxury border border-sand-border">
              <span className="text-xs text-ink-muted">الكباتن المسجلون بصفحة المنشأة</span>
              <div className="text-2xl sm:text-3xl font-black text-[#0F4C5C] mt-1 tabular-nums">
                {affiliatedRegisteredCoaches.length + rosterCoaches.length}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-soft-luxury border border-sand-border">
              <span className="text-xs text-ink-muted">استفسارات واتساب الموثقة</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1 tabular-nums">
                {facilityLeads.length || facility.monthlyMetrics.verifiedWhatsappLeads}
              </div>
            </div>
          </section>
        )}

        {/* Option B Navigation Tabs */}
        <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-white p-2 rounded-2xl border border-sand-border shadow-soft-luxury">
          {allowedTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === "desk_settings") setDeskFocusSection("all");
                  setActiveTab(tab.id);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? "bg-[#0F4C5C] text-white shadow-soft-luxury"
                    : "text-ink-slate hover:text-[#0F4C5C] hover:bg-[#EAF4F8]"
                }`}
              >
                <Icon name={tab.icon} size={17} />
                <span>{tab.labelAr}</span>
              </button>
            );
          })}
        </nav>

        {/* SCREEN 2: عمليات اليوم والرقابة الميدانية */}
        {activeTab === "ops" && (
          <FacilityOpsAuditTab
            facility={facility}
            ledgers={facilityLedgers}
            offlineQueue={offlineQueue}
            staffRole={staffRole}
            onSyncOffline={() => {
              if (syncOfflineQueueAsync) {
                void syncOfflineQueueAsync().then((r) => {
                  setFeedback({
                    ok: r.failedCount === 0 && !r.stoppedReason,
                    msg:
                      r.failedCount === 0 && !r.stoppedReason
                        ? `تمت مزامنة ${r.syncedCount} عملية بنجاح ✓`
                        : r.lastErrorAr || `تمت مزامنة ${r.syncedCount} وتعثرت ${r.failedCount} عمليات.`,
                  });
                });
              } else {
                syncOfflineQueue();
              }
              return pendingOfflineCount;
            }}
            onExceptionalCheckin={async (ledgerId, noteAr) => {
              const target = facilityLedgers.find((l) => l.id === ledgerId);
              if (!target) return;
              const res = checkInSessionAsync
                ? await checkInSessionAsync(target.id, target.pinCode, "qr_scan", noteAr, {
                    overrideDuplicate3h: true,
                    scanSource: "dashboard_manual",
                  })
                : checkInSession(target.id, target.pinCode, "qr_scan", noteAr, {
                    overrideDuplicate3h: true,
                    scanSource: "dashboard_manual",
                  });
              setFeedback({ ok: res.ok, msg: res.messageAr });
            }}
          />
        )}

        {/* SCREEN 3: المشتركون والتسعير الديناميكي وحساب المية */}
        {activeTab === "subscribers" && (
          <FacilitySubscribersTab
            facility={facility}
            ledgers={facilityLedgers}
            facilityLinks={scopedLinks}
            coaches={coaches}
            memberRegistry={memberRegistry}
            isStaffMode={isStaffMode}
            staffRole={staffRole}
            prefillMemberCode={prefillMemberCode}
            prefillAthleteName={prefillAthleteName}
            onOpenScanner={() => setScannerOpen(true)}
            onSyncCloud={async () => {
              setSyncingCloud(true);
              try {
                await syncLedgersFromServer();
                setFeedback({ ok: true, msg: "تمت مزامنة سجلات المشتركين من السحابة بنجاح." });
              } finally {
                setSyncingCloud(false);
              }
            }}
            onManualSubCheckin={async (subCode, noteAr) => {
              const res = checkInBySubscriptionCodeAsync
                ? await checkInBySubscriptionCodeAsync(
                    subCode,
                    facility.id,
                    noteAr || "خصم حصة بإدخال كود الاشتراك يدوياً من لوحة المنشأة",
                    undefined,
                    { scanSource: "dashboard_manual" }
                  )
                : checkInBySubscriptionCode(
                    subCode,
                    facility.id,
                    noteAr || "خصم حصة بإدخال كود الاشتراك يدوياً من لوحة المنشأة",
                    undefined,
                    { scanSource: "dashboard_manual" }
                  );
              setFeedback({ ok: res.ok, msg: res.messageAr });
              return { ok: res.ok, msg: res.messageAr };
            }}
            onConfirmReceipt={async (ledgerId, receiptId) => {
              const res = confirmReceiptByProviderAsync
                ? await confirmReceiptByProviderAsync(ledgerId, receiptId)
                : confirmReceiptByProvider(ledgerId, receiptId);
              setFeedback({ ok: res.ok, msg: res.messageAr });
            }}
            onEnroll={async (payload) => {
              const enrollPayload = {
                memberCode: payload.memberCode,
                athleteNameAr: payload.athleteNameAr,
                facilityId: facility.id,
                packageTitleAr: payload.packageTitleAr,
                totalSessions: payload.totalSessions,
                amountEgp: payload.amountEgp,
                trackType: payload.trackType,
                trackLabelAr: TRACK_LABELS[payload.trackType],
                linkedEntityId: payload.linkedEntityId,
                linkedEntityNameAr: payload.linkedEntityNameAr,
                agreementTypeAtEnroll: payload.agreementTypeAtEnroll,
                pricingSnapshot: payload.pricingSnapshot,
                promoCodeUsed: payload.promoCodeUsed,
              };
              const res = enrollSwimmerByMemberCodeAsync
                ? await enrollSwimmerByMemberCodeAsync(enrollPayload)
                : enrollSwimmerByMemberCode(enrollPayload);
              setFeedback({ ok: res.ok, msg: res.messageAr });
              if (res.ok) {
                setPrefillMemberCode("");
                setPrefillAthleteName("");
              }
              return { ok: res.ok, msg: res.messageAr };
            }}
            onLedgerCheckin={async (ledgerId, pinCode) => {
              const res = checkInSessionAsync
                ? await checkInSessionAsync(
                    ledgerId,
                    pinCode,
                    "qr_scan",
                    "خصم حصة من قائمة المشتركين والفرق",
                    { scanSource: "dashboard_manual" }
                  )
                : checkInSession(
                    ledgerId,
                    pinCode,
                    "qr_scan",
                    "خصم حصة من قائمة المشتركين والفرق",
                    { scanSource: "dashboard_manual" }
                  );
              setFeedback({ ok: res.ok, msg: res.messageAr });
            }}
            onRenewLedger={async (ledger) => {
              const renewPayload = {
                ledgerId: ledger.id,
                totalSessions: ledger.totalSessions,
                packageTitleAr: ledger.packageTitleAr,
              };
              const res = renewSwimmerSubscriptionAsync
                ? await renewSwimmerSubscriptionAsync(renewPayload)
                : renewSwimmerSubscription(renewPayload);
              setFeedback({ ok: res.ok, msg: res.messageAr });
            }}
            onRecordPBAndSkills={(payload) => {
              recordCoachSkillAndPB({
                athleteId: payload.athleteId,
                swimmerNameAr: payload.swimmerNameAr,
                eventTitleAr: payload.eventTitleAr,
                currentValue: payload.currentValue,
                unitAr: payload.unitAr,
                coachNameAr: currentPersona.fullNameAr,
                facilityNameAr: facility.nameAr,
                skills: {
                  athleteId: payload.athleteId,
                  evaluatedDateAr: "اليوم",
                  coachNameAr: currentPersona.fullNameAr,
                  coachFeedbackAr: `تقييم فني مسجل عبر ${facility.nameAr}`,
                  metrics: [
                    { labelAr: "الطفو وتوازن الماء", score: payload.scores[0] },
                    { labelAr: "تنظيم النفس والفقاعات", score: payload.scores[1] },
                    { labelAr: "التوافق الحركي والحرّة", score: payload.scores[2] },
                    { labelAr: "سباحة الظهر والاستلقاء", score: payload.scores[3] },
                    { labelAr: "الغوص وبداية الانطلاق", score: payload.scores[4] },
                  ],
                },
              });
              setFeedback({
                ok: true,
                msg: `✓ تم تسجيل الرقم القياسي (${payload.eventTitleAr}) وتحديث التقييم الفني للسباح «${payload.swimmerNameAr}» وربطه بملفه فوراً.`,
              });
            }}
            onGoToSettings={() => {
              setDeskFocusSection("pricing");
              setActiveTab("desk_settings");
            }}
          />
        )}

        {/* SCREEN 4: التسعير والخصومات والأكاديميات وحوكمة مسح الكباتن والموظفين */}
        {activeTab === "desk_settings" && (
          <FacilitySettingsDeskTab
            facility={facility}
            facilityLinks={scopedLinks}
            coaches={coaches}
            memberRegistry={memberRegistry}
            staffRole={staffRole}
            isStaffMode={isStaffMode}
            initialFocusSection={deskFocusSection}
            onSavePoolDeskConfig={(patch) => updateFacilityPoolDeskConfig(facility.id, patch)}
            onSavePromoCode={(promo) => saveFacilityPromoCode(facility.id, promo)}
            onTogglePromoCode={(promoId) => toggleFacilityPromoCode(facility.id, promoId)}
            onRemovePromoCode={(promoId) => removeFacilityPromoCode(facility.id, promoId)}
            onAddDirectLinkedEntity={(payload) =>
              addDirectFacilityLinkedEntity(facility.id, payload)
            }
            onReviewLinkedEntity={(linkId, patch) =>
              reviewFacilityLinkedEntity(facility.id, linkId, patch)
            }
            onLookupStaffRemote={lookupStaffCandidatesRemote}
            onAddStaffMember={(payload) => addFacilityStaffMember(facility.id, payload)}
            onRemoveStaffMember={(staffId) => removeFacilityStaffMember(facility.id, staffId)}
            onSwitchToStaffMode={(staffId) => switchToStaffMode(staffId)}
          />
        )}

        {/* TAB 4: بطاقات المواعيد والأسعار اللانهائية */}
        {activeTab === "schedules" && (
          <section className="bg-white rounded-3xl p-6 shadow-soft-luxury border border-sand-border flex flex-col gap-4 animate-captenly-enter">
            <div>
              <h2 className="text-lg font-black text-[#0F4C5C]">
                إدارة بطاقات المواعيد والمدارس (عدد لا نهائي)
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                أنشئ أي عدد من البطاقات لكل فئة وتوقيت وساعة حصة ومدتها وسعرها — وتظهر مباشرة في
                صفحة المنشأة العامة بدون أي بيانات وهمية.
              </p>
            </div>
            <DynamicScheduleCardsBuilder
              mode="facility"
              targetId={facility.id}
              facilityPrograms={facility.schoolPrograms || []}
              onFeedback={setFeedback}
            />
          </section>
        )}

        {/* TAB 5: كباتن الأكاديمية والشهادات */}
        {activeTab === "coaches" && (
          <div className="flex flex-col gap-6 animate-captenly-enter">
            <form
              onSubmit={handleAddCoachRoster}
              className="bg-white rounded-3xl p-6 shadow-soft-luxury border border-sand-border flex flex-col gap-4"
            >
              <div>
                <h2 className="text-lg font-black text-[#0F4C5C] flex items-center gap-2">
                  <Icon name="sports" size={22} className="text-[#1D6E7D]" />
                  <span>تسجيل كباتن المنشأة وشهاداتهم المعتمدة</span>
                </h2>
                <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                  أي كابتن تسجله هنا (حتى لو لم ينشئ حساباً شخصياً على كابتنلي بعد) يظهر تلقائياً مع
                  شهاداته في تبويب «الكباتن الموثقون» بصفحة المنشأة العامة. وإذا كان للكابتن حساب
                  مسجل، يتم ربط ملفه وإرسال إشعار فوري له بتسجيل اسمه في منشأتك.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#0F4C5C]">اسم الكابتن *</label>
                  <input
                    required
                    value={coachNameInput}
                    onChange={(e) => setCoachNameInput(e.target.value)}
                    placeholder="مثلاً: كابتن أحمد طارق الشناوي"
                    className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-sand-border"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#0F4C5C]">
                    المسمى / الدور في الأكاديمية *
                  </label>
                  <input
                    required
                    value={coachRoleInput}
                    onChange={(e) => setCoachRoleInput(e.target.value)}
                    placeholder="مدرب فرق البطولات / مدرب براعم"
                    className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-sand-border"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#0F4C5C]">التخصص التدريبي *</label>
                  <input
                    required
                    value={coachSpecialtyInput}
                    onChange={(e) => setCoachSpecialtyInput(e.target.value)}
                    placeholder="تأسيس أطفال، سباحة حرة، إنقاذ"
                    className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-sand-border"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#0F4C5C]">
                    أيام ومواعيد تواجد الكابتن
                  </label>
                  <input
                    value={coachScheduleInput}
                    onChange={(e) => setCoachScheduleInput(e.target.value)}
                    placeholder="السبت والاثنين والأربعاء 4 م – 9 م"
                    className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-sand-border"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#0F4C5C]">
                    كود الكابتن على كابتنلي (اختياري — للربط وإرسال إشعار لحسابه إن وُجد)
                  </label>
                  <input
                    value={coachCodeQuery}
                    onChange={(e) => setCoachCodeQuery(e.target.value)}
                    placeholder="اتركه فارغاً إذا لم يكن للكابتن حساب، أو أدخل كوده مثل CAP-ID-1042"
                    className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs font-mono outline-none border border-sand-border"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#0F4C5C]">
                  الشهادات والاعتمادات الحاصل عليها الكابتن * (شهادة في كل سطر أو مفصولة بفاصلة)
                </label>
                <textarea
                  required
                  rows={3}
                  value={coachCertsInput}
                  onChange={(e) => setCoachCertsInput(e.target.value)}
                  placeholder={
                    "شهادة الاتحاد المصري للسباحة (ESF)\nشهادة الإنقاذ والإسعاف الأولي (EDLF)\nبكالوريوس تربية رياضية — تخصص رياضات مائية"
                  }
                  className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-sand-border"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingCoach}
                className="w-fit px-6 py-3 rounded-full bg-[#0F4C5C] text-white font-black text-xs shadow-soft-luxury hover:bg-[#1D6E7D] disabled:opacity-60 flex items-center gap-2 cursor-pointer"
              >
                {isSavingCoach ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>جاري تسجيل الكابتن وتحديث صفحة المنشأة...</span>
                  </>
                ) : (
                  <>
                    <Icon name="verified" size={16} />
                    <span>إضافة الكابتن وشهاداته لقسم الكباتن الموثقين بالمنشأة ✓</span>
                  </>
                )}
              </button>
            </form>

            {/* Current Facility Coaches List */}
            <section className="bg-white rounded-3xl p-6 shadow-soft-luxury border border-sand-border flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-black text-[#0F4C5C]">
                  قائمة كباتن الأكاديمية الظاهرين في الصفحة العامة (
                  {rosterCoaches.length + affiliatedRegisteredCoaches.length})
                </h3>
                <Link
                  href={`/academy/${facility.slug}`}
                  className="text-xs font-bold text-[#1D6E7D] hover:underline"
                >
                  معاينة ظهورهم في تبويب «الكباتن الموثقون» ←
                </Link>
              </div>

              {rosterCoaches.length === 0 && affiliatedRegisteredCoaches.length === 0 ? (
                <div className="rounded-2xl bg-[#F7F9FA] p-6 text-center text-xs text-ink-muted">
                  لم تتم إضافة كباتن بعد. أضف كباتن الأكاديمية وشهاداتهم من النموذج أعلاه ليظهروا
                  للجمهور.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rosterCoaches.map((rc) => (
                    <div
                      key={rc.id}
                      className="rounded-2xl bg-[#F7F9FA] p-4 border border-sand-border flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-[#0F4C5C]">
                              {rc.fullNameAr}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rc.linkedCoachId
                                  ? "bg-[#EAF4F8] text-[#0F4C5C]"
                                  : "bg-amber-50 border border-amber-200 text-amber-800"
                              }`}
                            >
                              {rc.linkedCoachId
                                ? `حساب مربوط (${rc.linkedSingleCoachId || "مسجل"})`
                                : "مُضاف من إدارة المنشأة (غير موثق بالمنصة بعد)"}
                            </span>
                          </div>
                          <div className="text-xs text-[#1D6E7D] font-bold mt-0.5">
                            {rc.roleTitleAr} • {rc.specialtyAr}
                          </div>
                          {rc.scheduleAr && (
                            <div className="text-[11px] text-ink-muted mt-0.5">
                              المواعيد: {rc.scheduleAr}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFacilityCoachRosterEntry(facility.id, rc.id)}
                          className="text-[11px] font-bold text-rose-700 hover:underline shrink-0 cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>

                      <div className="flex flex-col gap-1 pt-2 border-t border-sand-border/70">
                        <span className="text-[11px] font-black text-[#0F4C5C]">
                          البيانات والشهادات المُدخلة من الإدارة (قيد المراجعة):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rc.certificatesAr.map((cert, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-sand-border text-[11px] font-bold text-[#1D6E7D]"
                            >
                              <Icon name="workspace_premium" size={13} />
                              <span>{cert}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  {affiliatedRegisteredCoaches
                    .filter((c) => !rosterCoaches.some((r) => r.linkedCoachId === c.id))
                    .map((coach) => (
                      <div
                        key={coach.id}
                        className="rounded-2xl bg-[#F7F9FA] p-4 border border-sand-border flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-black text-sm text-[#0F4C5C]">
                              {coach.fullNameAr}
                            </div>
                            <div className="text-xs text-[#1D6E7D] font-bold">{coach.titleAr}</div>
                          </div>
                          <Link
                            href={`/c/${coach.slug}`}
                            className="px-3 py-1.5 rounded-full bg-[#EAF4F8] text-[#0F4C5C] text-[11px] font-bold"
                          >
                            ملف الكابتن ←
                          </Link>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {coach.badges.map((b) => (
                            <span
                              key={b.code}
                              className="px-2.5 py-1 rounded-lg bg-white border border-sand-border text-[11px] font-bold text-[#1D6E7D]"
                            >
                              {b.titleAr}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 6: مقالات ومنشورات المنشأة (للمالك فقط) */}
        {activeTab === "articles" && !isStaffMode && (
          <section className="bg-white rounded-3xl p-6 shadow-soft-luxury border border-sand-border">
            <AuthorArticlesManager
              authorType="facility"
              authorEntityId={facility.id}
              authorSlug={facility.slug}
              authorNameAr={facility.nameAr}
              authorRoleAr={`إدارة ${facility.nameAr} (${facility.city})`}
              onFeedback={setFeedback}
            />
          </section>
        )}
      </div>

      <QrCameraScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        scopeFacilityId={facility.id}
        onLedgerCheckedIn={(_ledgerId, messageAr) => {
          setFeedback({ ok: true, msg: messageAr });
        }}
        onMemberDetectedForEnroll={({ memberCode: detectedCode, athleteNameAr }) => {
          setActiveTab("subscribers");
          setPrefillMemberCode(detectedCode);
          if (athleteNameAr) setPrefillAthleteName(athleteNameAr);
          setFeedback({
            ok: true,
            msg: `تم مسح كود العضوية ${detectedCode}${
              athleteNameAr ? ` (${athleteNameAr})` : ""
            } — اختر المدرسة وعدد الحصص واضغط تفعيل لتوليد كود الاشتراك فوراً.`,
          });
        }}
      />
    </div>
  );
}
