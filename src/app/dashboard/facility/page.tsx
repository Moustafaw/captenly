"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { DynamicScheduleCardsBuilder } from "@/components/editorial/DynamicScheduleCardsBuilder";
import { AuthorArticlesManager } from "@/components/editorial/AuthorArticlesManager";
import { QrCameraScannerModal } from "@/components/qr/QrCameraScannerModal";
import { FacilityStaffRole } from "@/types/captenly";

type FacilitySectionTab =
  | "subscribers"
  | "schedules"
  | "coaches"
  | "staff"
  | "articles";

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

export default function FacilityDashboardPage() {
  const {
    facilities,
    coaches,
    sessionLedgers,
    verifiedLeads,
    memberRegistry,
    enrollSwimmerByMemberCode,
    checkInSession,
    checkInBySubscriptionCode,
    renewSwimmerSubscription,
    currentPersona,
    isAuthenticated,
    effectiveOffline,
    offlineQueue,
    syncOfflineQueue,
    syncLedgersFromServer,
    activeStaffAssignment,
    switchToStaffMode,
    addFacilityStaffMember,
    removeFacilityStaffMember,
    addFacilityCoachRosterEntry,
    removeFacilityCoachRosterEntry,
    seedNewFacilityConcierge,
    claimFacilityAndVerify,
  } = useCaptenly();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);

  const boundFacilityId =
    activeStaffAssignment?.facilityId || currentPersona.linkedFacilityId || "";
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

  // Determine staff permission restrictions if in Staff Mode
  const isStaffMode = Boolean(activeStaffAssignment);
  const staffRole: FacilityStaffRole | null = activeStaffAssignment?.role || null;

  const allowedTabs: { id: FacilitySectionTab; labelAr: string; icon: string }[] = useMemo(() => {
    const all: { id: FacilitySectionTab; labelAr: string; icon: string }[] = [
      { id: "subscribers", labelAr: "المشتركون والفرق ومسح الكود", icon: "groups" },
      { id: "schedules", labelAr: "بطاقات المواعيد والأسعار", icon: "schedule" },
      { id: "coaches", labelAr: "كباتن الأكاديمية والشهادات", icon: "sports" },
      { id: "staff", labelAr: "الموظفون والصلاحيات", icon: "badge" },
      { id: "articles", labelAr: "مقالات ومنشورات المنشأة", icon: "article" },
    ];
    if (isStaffMode && staffRole === "subscriptions_manager") {
      return all.filter((t) => t.id === "subscribers");
    }
    if (isStaffMode && staffRole === "accounts_manager") {
      return all.filter((t) => t.id === "schedules" || t.id === "subscribers");
    }
    return all;
  }, [isStaffMode, staffRole]);

  const [activeTab, setActiveTab] = useState<FacilitySectionTab>("subscribers");

  useEffect(() => {
    if (!allowedTabs.some((t) => t.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id || "subscribers");
    }
  }, [allowedTabs, activeTab]);

  // Manual Subscription Code Check-in
  const [manualSubCode, setManualSubCode] = useState("");
  const [manualSubNote, setManualSubNote] = useState("");

  // New Subscriber Enrollment Form
  const [memberCodeInput, setMemberCodeInput] = useState("");
  const [athleteNameInput, setAthleteNameInput] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<"school" | "buds" | "prep" | "team" | "ladies">("school");
  const [pkgTitleInput, setPkgTitleInput] = useState("مدرسة السباحة — 8 حصص");
  const [sessionsCount, setSessionsCount] = useState<8 | 12 | 24>(8);
  const [amountEgp, setAmountEgp] = useState<string>("600");
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Subscribers Roster Filter
  const [trackFilter, setTrackFilter] = useState<"all" | "school" | "buds" | "prep" | "team" | "ladies">("all");
  const [subSearchQuery, setSubSearchQuery] = useState("");

  // Add Academy Coach Form
  const [coachNameInput, setCoachNameInput] = useState("");
  const [coachRoleInput, setCoachRoleInput] = useState("مدرب مدارس وفريق سباحة");
  const [coachSpecialtyInput, setCoachSpecialtyInput] = useState("تأسيس أطفال وتصحيح حركات");
  const [coachCertsInput, setCoachCertsInput] = useState("شهادة الاتحاد المصري للسباحة\nشهادة إنقاذ وإسعافات أولية معتمدة");
  const [coachScheduleInput, setCoachScheduleInput] = useState("السبت والاثنين والأربعاء 4 م – 9 م");
  const [coachCodeQuery, setCoachCodeQuery] = useState("");
  const [isSavingCoach, setIsSavingCoach] = useState(false);

  // Add Staff Member Form
  const [staffNameInput, setStaffNameInput] = useState("");
  const [staffRoleInput, setStaffRoleInput] = useState<FacilityStaffRole>("subscriptions_manager");
  const [staffTitleInput, setStaffTitleInput] = useState("");
  const [staffPhoneInput, setStaffPhoneInput] = useState("");
  const [staffAccountQuery, setStaffAccountQuery] = useState("");
  const [isSavingStaff, setIsSavingStaff] = useState(false);

  // Quick Facility Creation if unlinked
  const [newFacName, setNewFacName] = useState("");
  const [newFacDistrict, setNewFacDistrict] = useState("");
  const [newFacPhone, setNewFacPhone] = useState(currentPersona.phone || "");

  // Feedback message
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const facilityLedgers = useMemo(
    () => (facility ? sessionLedgers.filter((l) => l.facilityId === facility.id) : []),
    [sessionLedgers, facility]
  );

  const filteredLedgers = useMemo(() => {
    return facilityLedgers.filter((l) => {
      if (trackFilter !== "all" && (l.trackType || "school") !== trackFilter) {
        return false;
      }
      if (subSearchQuery.trim()) {
        const q = subSearchQuery.trim().toLowerCase();
        const hay = `${l.athleteNameAr} ${l.subscriptionCode || ""} ${l.ledgerCode} ${l.memberCode || ""} ${l.packageTitleAr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [facilityLedgers, trackFilter, subSearchQuery]);

  const facilityLeads = useMemo(
    () => (facility ? verifiedLeads.filter((l) => l.targetId === facility.id) : []),
    [verifiedLeads, facility]
  );

  const matchedMember = useMemo(
    () =>
      memberRegistry.find(
        (m) => m.memberCode.toUpperCase() === memberCodeInput.trim().toUpperCase()
      ),
    [memberRegistry, memberCodeInput]
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

  // If no facility is linked yet, allow claiming an existing facility or creating a new one
  if (!facility) {
    return (
      <div className="min-h-screen bg-canvas-alabaster pt-8 pb-16">
        <div className="max-w-3xl mx-auto px-margin flex flex-col gap-6 animate-captenly-enter">
          <div className="rounded-3xl bg-surface-card p-6 md:p-8 shadow-sm border border-surface-container flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-dark-slate text-electric-volt flex items-center justify-center">
                <Icon name="pool" className="text-[24px]" />
              </div>
              <div>
                <h1 className="font-section-title text-dark-slate">
                  ربط أو تأسيس منشأتك الرياضية على كابتنلي
                </h1>
                <p className="text-xs text-text-muted mt-0.5">
                  اختر منشأتك الحالية من الدليل أو أنشئ صفحة أكاديميتك الجديدة للبدء في إدارة المشتركين والفرق والكباتن.
                </p>
              </div>
            </div>

            {facilities.length > 0 && (
              <div className="rounded-2xl bg-surface-snow p-4 border border-surface-container flex flex-col gap-3">
                <label className="text-xs font-bold text-dark-slate">
                  اختيار منشأة مسجلة في الدليل لإدارتها:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedFacilityId}
                    onChange={(e) => setSelectedFacilityId(e.target.value)}
                    className="flex-1 rounded-xl bg-surface-card px-3.5 py-2.5 text-xs font-bold border border-surface-container outline-none"
                  >
                    <option value="">-- اختر المنشأة أو الأكاديمية --</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nameAr} ({f.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newFacName.trim()) return;
                const created = seedNewFacilityConcierge({
                  nameAr: newFacName.trim(),
                  city: currentPersona.city || "القاهرة",
                  district: newFacDistrict.trim() || currentPersona.city || "المنطقة الرئيسية",
                  sportSector: "swimming",
                  baseMonthlyPrice: 600,
                  whatsappNumber: newFacPhone.trim() || currentPersona.phone,
                  isHeatedWinter: true,
                  hasLadiesSlots: true,
                });
                claimFacilityAndVerify(created.id, {
                  managerName: currentPersona.fullNameAr,
                  roleTitleAr: "مدير المنشأة",
                  phone: newFacPhone.trim() || currentPersona.phone || "01000000000",
                  whatsappNumber: newFacPhone.trim() || currentPersona.phone || "01000000000",
                });
                setSelectedFacilityId(created.id);
              }}
              className="rounded-2xl bg-surface-snow p-5 border border-surface-container flex flex-col gap-3"
            >
              <h2 className="font-card-title-sm text-dark-slate">
                أو إضافة منشأة / أكاديمية سباحة جديدة باسمك:
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  required
                  value={newFacName}
                  onChange={(e) => setNewFacName(e.target.value)}
                  placeholder="اسم الأكاديمية أو المسبح *"
                  className="rounded-xl bg-surface-card px-3.5 py-2.5 text-xs border border-surface-container outline-none"
                />
                <input
                  value={newFacDistrict}
                  onChange={(e) => setNewFacDistrict(e.target.value)}
                  placeholder="الحي / العنوان المختصر"
                  className="rounded-xl bg-surface-card px-3.5 py-2.5 text-xs border border-surface-container outline-none"
                />
                <input
                  value={newFacPhone}
                  onChange={(e) => setNewFacPhone(e.target.value)}
                  placeholder="رقم واتساب الإدارة *"
                  className="rounded-xl bg-surface-card px-3.5 py-2.5 text-xs border border-surface-container outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-fit px-6 py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
              >
                إنشاء وتوثيق صفحة المنشأة الآن ✓
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const isUnclaimed = facility.supplyStatus === "seeded_unclaimed";

  const handleManualSubCodeCheckin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSubCode.trim()) return;
    const res = checkInBySubscriptionCode(
      manualSubCode.trim(),
      manualSubNote.trim() || "خصم حصة بإدخال كود الاشتراك يدوياً من لوحة المنشأة"
    );
    setFeedback({ ok: res.ok, msg: res.messageAr });
    if (res.ok) {
      setManualSubCode("");
      setManualSubNote("");
    }
  };

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEnrolling) return;
    setIsEnrolling(true);
    const trackObj = TRACK_OPTIONS.find((t) => t.id === selectedTrack) || TRACK_OPTIONS[0];

    setTimeout(() => {
      const res = enrollSwimmerByMemberCode({
        memberCode: memberCodeInput.trim() || `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`,
        athleteNameAr: athleteNameInput.trim() || matchedMember?.fullNameAr || "سباح مشترك",
        facilityId: facility.id,
        packageTitleAr: pkgTitleInput.trim() || `${trackObj.labelAr} — ${sessionsCount} حصص`,
        totalSessions: sessionsCount,
        amountEgp: Number(amountEgp) || 0,
        trackType: selectedTrack,
        trackLabelAr: trackObj.labelAr,
      });
      setIsEnrolling(false);
      setFeedback({ ok: res.ok, msg: res.messageAr });
      if (res.ok) {
        setAthleteNameInput("");
        setMemberCodeInput("");
      }
    }, 1400);
  };

  const handleAddCoachRoster = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingCoach || !coachNameInput.trim()) return;
    setIsSavingCoach(true);
    const certs = coachCertsInput
      .split(/[\n,،]+/)
      .map((c) => c.trim())
      .filter(Boolean);

    setTimeout(() => {
      const res = addFacilityCoachRosterEntry(facility.id, {
        fullNameAr: coachNameInput.trim(),
        roleTitleAr: coachRoleInput.trim(),
        specialtyAr: coachSpecialtyInput.trim(),
        certificatesAr: certs,
        scheduleAr: coachScheduleInput.trim(),
        coachIdOrCode: coachCodeQuery.trim() || undefined,
      });
      setIsSavingCoach(false);
      setFeedback({ ok: res.ok, msg: res.messageAr });
      if (res.ok) {
        setCoachNameInput("");
        setCoachCodeQuery("");
      }
    }, 1500);
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingStaff || !staffNameInput.trim()) return;
    setIsSavingStaff(true);

    setTimeout(() => {
      const res = addFacilityStaffMember(facility.id, {
        fullNameAr: staffNameInput.trim(),
        role: staffRoleInput,
        roleTitleAr: staffTitleInput.trim() || undefined,
        phone: staffPhoneInput.trim() || undefined,
        memberCodeOrQuery: staffAccountQuery.trim() || undefined,
      });
      setIsSavingStaff(false);
      setFeedback({ ok: res.ok, msg: res.messageAr });
      if (res.ok) {
        setStaffNameInput("");
        setStaffTitleInput("");
        setStaffPhoneInput("");
        setStaffAccountQuery("");
      }
    }, 1500);
  };

  // Combine affiliated registered coaches + facility coachRoster for display
  const affiliatedRegisteredCoaches = coaches.filter((c) =>
    facility.affiliatedCoachIds.includes(c.id)
  );
  const rosterCoaches = facility.coachRoster || [];
  const staffMembers = facility.staffMembers || [];

  return (
    <div className="min-h-screen bg-canvas-alabaster pt-6 pb-20">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        {/* Staff Mode Active Banner */}
        {isStaffMode && activeStaffAssignment && (
          <div className="rounded-2xl bg-lime-tint border-2 border-deep-olive p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-captenly-enter">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-deep-olive text-electric-volt flex items-center justify-center shrink-0">
                <Icon name="badge" className="text-[20px]" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-deep-olive">
                  وضع تبديل الحساب الوظيفي نشط — {activeStaffAssignment.roleTitleAr}
                </div>
                <p className="text-xs text-dark-slate mt-0.5">
                  أنت تتصفح الآن واجهة <strong>{facility.nameAr}</strong> بصلاحيات محددة لوظيفتك ({activeStaffAssignment.roleTitleAr}) فقط.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => switchToStaffMode(null)}
              className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold shrink-0 hover:opacity-95"
            >
              إنهاء وضع الموظف والعودة لحسابي الشخصي ↩
            </button>
          </div>
        )}

        {/* Header Bar (No personal QR or CAP-F code — Facility is a scanner) */}
        <section className="rounded-[24px] bg-dark-slate text-surface-card p-6 md:p-8 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${
                  isUnclaimed
                    ? "bg-amber-400/20 text-amber-300"
                    : "bg-electric-volt/15 text-electric-volt"
                }`}
              >
                {isUnclaimed ? "منشأة بانتظار التفعيل الرسمي" : "✓ منشأة موثقة ومعتمدة"}
              </span>
              <span className="text-xs text-surface-variant">
                {facility.city} • {facility.district}
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  effectiveOffline
                    ? "bg-amber-400 text-dark-slate"
                    : "bg-white/10 text-surface-container-high"
                }`}
              >
                {effectiveOffline
                  ? "وضع الأوفلاين نشط (حفظ محلي ومزامنة تلقائية)"
                  : "متصل ومزامن سحابياً ✓"}
              </span>
            </div>

            <h1 className="font-hero-headline text-[24px] md:text-[32px]">
              {isStaffMode && activeStaffAssignment
                ? `${facility.nameAr} — (${activeStaffAssignment.roleTitleAr})`
                : `لوحة إدارة المنشأة: ${facility.nameAr}`}
            </h1>
            <p className="font-body-compact text-surface-container-high max-w-2xl">
              مسح باركود الحضور أو إدخال كود الاشتراك يدوياً، تنظيم قوائم المشتركين والفرق، إدارة الكباتن وشهاداتهم، وتعيين الموظفين بصلاحيات مخصصة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {pendingOfflineCount > 0 && (
              <button
                type="button"
                onClick={() => syncOfflineQueue()}
                className="px-4 py-2.5 rounded-full bg-amber-400 text-dark-slate text-xs font-extrabold"
              >
                مزامنة {pendingOfflineCount} عملية أوفلاين ↻
              </button>
            )}

            {(!isStaffMode || staffRole === "subscriptions_manager" || staffRole === "general_staff") && (
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-electric-volt text-dark-slate font-extrabold text-xs hover:brightness-105 shadow"
              >
                <Icon name="qr_code_scanner" className="text-[18px]" />
                <span>مسح QR السباحين بالكاميرا</span>
              </button>
            )}

            <Link
              href={`/f/${facility.slug}`}
              className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs text-center border border-white/15"
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
                ? "bg-lime-tint/80 border-deep-olive text-dark-slate"
                : "bg-red-50 border-red-300 text-red-900"
            }`}
          >
            <div className="flex items-center gap-2 font-card-title-sm text-xs sm:text-sm">
              <Icon name={feedback.ok ? "check_circle" : "warning"} className="text-[20px]" />
              <span>{feedback.msg}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-bold underline shrink-0 mr-3"
            >
              إخفاء
            </button>
          </div>
        )}

        {/* Metrics Row (Visible to Owner & Accounts Manager) */}
        {(!isStaffMode || staffRole === "accounts_manager" || staffRole === "general_staff") && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-surface-card rounded-[18px] p-4 sm:p-5 shadow-sm border border-surface-container">
              <span className="text-xs text-text-muted">المشتركون والدفاتر النشطة</span>
              <div className="text-2xl sm:text-3xl font-black text-dark-slate mt-1">
                {facilityLedgers.length}
              </div>
            </div>
            <div className="bg-surface-card rounded-[18px] p-4 sm:p-5 shadow-sm border border-surface-container">
              <span className="text-xs text-text-muted">بطاقات المواعيد والمدارس</span>
              <div className="text-2xl sm:text-3xl font-black text-deep-olive mt-1">
                {(facility.schoolPrograms || []).length}
              </div>
            </div>
            <div className="bg-surface-card rounded-[18px] p-4 sm:p-5 shadow-sm border border-surface-container">
              <span className="text-xs text-text-muted">الكباتن المسجلون بالأكاديمية</span>
              <div className="text-2xl sm:text-3xl font-black text-dark-slate mt-1">
                {affiliatedRegisteredCoaches.length + rosterCoaches.length}
              </div>
            </div>
            <div className="bg-surface-card rounded-[18px] p-4 sm:p-5 shadow-sm border border-surface-container">
              <span className="text-xs text-text-muted">استفسارات واتساب الموثقة</span>
              <div className="text-2xl sm:text-3xl font-black text-action-whatsapp mt-1">
                {facilityLeads.length || facility.monthlyMetrics.verifiedWhatsappLeads}
              </div>
            </div>
          </section>
        )}

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-surface-card p-2 rounded-2xl border border-surface-container shadow-xs">
          {allowedTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                  active
                    ? "bg-dark-slate text-electric-volt shadow-xs"
                    : "text-text-muted hover:text-dark-slate hover:bg-surface-snow"
                }`}
              >
                <Icon name={tab.icon} className="text-[17px]" />
                <span>{tab.labelAr}</span>
              </button>
            );
          })}
        </nav>

        {/* TAB 1: المشتركون والفرق + مسح الكاميرا وإدخال كود الاشتراك يدوياً */}
        {activeTab === "subscribers" && (
          <div className="flex flex-col gap-6 animate-captenly-enter">
            {/* Direct Scanner & Manual Subscription Code Input Card */}
            <section className="rounded-[22px] bg-dark-slate text-white p-5 md:p-6 shadow-md border border-electric-volt/25 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-electric-volt text-dark-slate flex items-center justify-center shrink-0">
                    <Icon name="qr_code_scanner" className="text-[24px]" />
                  </div>
                  <div>
                    <h2 className="font-card-title text-white">
                      تسجيل حضور السباحين (مسح الكاميرا أو إدخال كود الاشتراك يدوياً)
                    </h2>
                    <p className="text-xs text-white/80 mt-0.5 leading-relaxed">
                      لكل اشتراك كود متجدد خاص به (مثل <span className="font-mono text-electric-volt">SUB-4821-08</span>) يظهر بجانب اسم المشترك وينتهي تلقائياً بمجرد إتمام حصص الباقة.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-electric-volt text-dark-slate text-xs font-extrabold hover:brightness-105"
                  >
                    <Icon name="photo_camera" className="text-[17px]" />
                    <span>فتح كاميرا المسح QR</span>
                  </button>
                  <button
                    type="button"
                    disabled={syncingCloud}
                    onClick={async () => {
                      setSyncingCloud(true);
                      await syncLedgersFromServer();
                      setSyncingCloud(false);
                    }}
                    className="px-3.5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Icon name="sync" className={`text-[15px] ${syncingCloud ? "animate-spin" : ""}`} />
                    <span>مزامنة</span>
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleManualSubCodeCheckin}
                className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-2 border-t border-white/10"
              >
                <div className="md:col-span-5">
                  <input
                    required
                    value={manualSubCode}
                    onChange={(e) => setManualSubCode(e.target.value)}
                    placeholder="أدخل كود الاشتراك يدوياً (مثلاً: SUB-4821-08) أو رقم الدفتر..."
                    className="w-full rounded-xl bg-deep-carbon text-white px-4 py-3 text-xs font-mono border border-white/15 outline-none focus:border-electric-volt"
                  />
                </div>
                <div className="md:col-span-4">
                  <input
                    value={manualSubNote}
                    onChange={(e) => setManualSubNote(e.target.value)}
                    placeholder="ملاحظة الحصة أو المدرب المناوب (اختياري)"
                    className="w-full rounded-xl bg-deep-carbon text-white px-4 py-3 text-xs border border-white/15 outline-none focus:border-electric-volt"
                  />
                </div>
                <div className="md:col-span-3">
                  <button
                    type="submit"
                    className="w-full h-full py-3 px-4 rounded-xl bg-deep-olive text-electric-volt font-extrabold text-xs hover:brightness-110 flex items-center justify-center gap-1.5"
                  >
                    <Icon name="check_circle" className="text-[17px]" />
                    <span>خصم حصة بالكود يدوياً ✓</span>
                  </button>
                </div>
              </form>
            </section>

            {/* Enroll New Swimmer into a Track / School */}
            <form
              onSubmit={handleEnrollSubmit}
              className="bg-surface-card rounded-[22px] p-5 md:p-6 shadow-sm border border-surface-container flex flex-col gap-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-card-title text-dark-slate flex items-center gap-2">
                    <Icon name="person_add" className="text-[20px] text-deep-olive" />
                    <span>إضافة مشترك جديد وتوليد كود اشتراك متجدد (SUB-XXXX)</span>
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    أدخل اسم السباح (أو كود حسابه إن وجد) وحدد المسار وعدد الحصص؛ سيُولّد النظام كود اشتراك خاصاً بهذه الباقة ينتهي بانتهاء حصصها.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-slate">اسم السباح / المشترك *</label>
                  <input
                    required={!matchedMember}
                    value={athleteNameInput}
                    onChange={(e) => setAthleteNameInput(e.target.value)}
                    placeholder={matchedMember?.fullNameAr || "اسم السباح ثلاثياً"}
                    className="rounded-xl bg-surface-snow px-3 py-2.5 text-xs text-dark-slate outline-none border border-surface-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-slate">
                    كود حساب السباح (اختياري)
                  </label>
                  <input
                    value={memberCodeInput}
                    onChange={(e) => setMemberCodeInput(e.target.value)}
                    placeholder="CAP-M-XXXX (إن وجد)"
                    className="rounded-xl bg-surface-snow px-3 py-2.5 font-mono text-xs text-dark-slate outline-none border border-surface-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-slate">المدرسة / الفريق *</label>
                  <select
                    value={selectedTrack}
                    onChange={(e) => {
                      const val = e.target.value as typeof selectedTrack;
                      setSelectedTrack(val);
                      const found = TRACK_OPTIONS.find((t) => t.id === val);
                      if (found) {
                        setPkgTitleInput(`${found.labelAr} — ${sessionsCount} حصص`);
                      }
                    }}
                    className="rounded-xl bg-surface-snow px-3 py-2.5 text-xs font-bold text-dark-slate outline-none border border-surface-container"
                  >
                    {TRACK_OPTIONS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.labelAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-dark-slate">مسمى الباقة / الموعد</label>
                  <input
                    value={pkgTitleInput}
                    onChange={(e) => setPkgTitleInput(e.target.value)}
                    placeholder="مدرسة السباحة — 8 حصص"
                    className="rounded-xl bg-surface-snow px-3 py-2.5 text-xs text-dark-slate outline-none border border-surface-container"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-dark-slate">عدد الحصص</label>
                    <select
                      value={sessionsCount}
                      onChange={(e) => {
                        const c = Number(e.target.value) as 8 | 12 | 24;
                        setSessionsCount(c);
                      }}
                      className="rounded-xl bg-surface-snow px-2.5 py-2.5 text-xs font-bold text-dark-slate outline-none border border-surface-container"
                    >
                      <option value={8}>8 حصص</option>
                      <option value={12}>12 حصة</option>
                      <option value={24}>24 حصة</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-dark-slate">الرسوم ج.م</label>
                    <input
                      type="number"
                      value={amountEgp}
                      onChange={(e) => setAmountEgp(e.target.value)}
                      className="rounded-xl bg-surface-snow px-2.5 py-2.5 text-xs text-dark-slate outline-none border border-surface-container"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isEnrolling}
                    className="w-full py-2.5 px-4 rounded-xl bg-dark-slate text-electric-volt font-bold text-xs hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {isEnrolling ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-electric-volt border-t-transparent animate-spin" />
                        <span>جاري إصدار الكود...</span>
                      </>
                    ) : (
                      <span>تفعيل وإصدار كود اشتراك ✓</span>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Subscribers & Teams Roster */}
            <section className="bg-surface-card rounded-[22px] p-5 md:p-6 shadow-sm border border-surface-container flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-section-title text-dark-slate">
                    قائمة المشتركين والفرق ({filteredLedgers.length})
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    يظهر بجانب اسم كل سباح كود اشتراكه الحالي وحالة صلاحيته وعدد الحصص المتبقية مع إمكانية الخصم المباشر أو التجديد بكود جديد.
                  </p>
                </div>

                <div className="flex items-center bg-surface-snow rounded-full px-3.5 py-2 border border-surface-container w-full md:w-72">
                  <Icon name="search" className="text-text-muted text-[16px] ml-2 shrink-0" />
                  <input
                    value={subSearchQuery}
                    onChange={(e) => setSubSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم أو كود الاشتراك SUB-..."
                    className="w-full bg-transparent text-xs outline-none text-dark-slate"
                  />
                </div>
              </div>

              {/* Track Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => setTrackFilter("all")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                    trackFilter === "all"
                      ? "bg-deep-olive text-white"
                      : "bg-surface-snow text-text-muted hover:text-dark-slate"
                  }`}
                >
                  الكل ({facilityLedgers.length})
                </button>
                {TRACK_OPTIONS.map((t) => {
                  const count = facilityLedgers.filter(
                    (l) => (l.trackType || "school") === t.id
                  ).length;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTrackFilter(t.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                        trackFilter === t.id
                          ? "bg-deep-olive text-white"
                          : "bg-surface-snow text-text-muted hover:text-dark-slate"
                      }`}
                    >
                      {t.labelAr} ({count})
                    </button>
                  );
                })}
              </div>

              {filteredLedgers.length === 0 ? (
                <div className="rounded-2xl bg-surface-snow p-8 text-center text-xs text-text-muted border border-surface-container/60">
                  لا يوجد مشتركون مسجلون في هذا القسم حالياً. استخدم النموذج أعلاه لإضافة مشترك وتوليد كود اشتراكه الفوري.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredLedgers.map((l) => {
                    const isExpired = Boolean(
                      l.isCodeExpired || l.status === "completed" || l.completedSessions >= l.totalSessions
                    );
                    const subCode = l.subscriptionCode || l.ledgerCode;
                    const pct = Math.min(100, Math.round((l.completedSessions / l.totalSessions) * 100));

                    return (
                      <div
                        key={l.id}
                        className={`rounded-2xl p-4 border flex flex-col justify-between gap-3 transition-all ${
                          isExpired
                            ? "bg-surface-snow/70 border-red-200"
                            : "bg-surface-snow border-surface-container hover:border-deep-olive/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-card-title-sm text-dark-slate">
                                {l.athleteNameAr}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-black border ${
                                  isExpired
                                    ? "bg-red-50 text-red-700 border-red-200 line-through"
                                    : "bg-lime-tint text-deep-olive border-deep-olive/30"
                                }`}
                                title="كود الاشتراك الحالي (يتجدد مع كل باقة)"
                              >
                                {subCode}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-surface-card border border-surface-container text-[10px] font-bold text-text-muted">
                                {l.trackLabelAr || "مدارس السباحة"}
                              </span>
                            </div>
                            <div className="text-xs text-text-muted mt-1">
                              {l.packageTitleAr} • بدء الاشتراك: {l.startedDateAr}
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${
                              isExpired
                                ? "bg-red-100 text-red-800"
                                : l.status === "renewal_due"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-lime-tint text-deep-olive"
                            }`}
                          >
                            {isExpired
                              ? "الكود منتهي الصلاحية"
                              : l.status === "renewal_due"
                              ? `متبقي ${l.totalSessions - l.completedSessions} حصص`
                              : "كود ساري ✓"}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-dark-slate">
                              الحصص المنفذة: {l.completedSessions} من {l.totalSessions}
                            </span>
                            <span className="text-[11px] text-text-muted">
                              متبقي {Math.max(0, l.totalSessions - l.completedSessions)} حصة
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-surface-container overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isExpired
                                  ? "bg-red-500"
                                  : l.status === "renewal_due"
                                  ? "bg-amber-500"
                                  : "bg-deep-olive"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-container/70">
                          <div className="flex items-center gap-2">
                            {!isExpired ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const res = checkInSession(
                                    l.id,
                                    l.pinCode,
                                    "qr_scan",
                                    "خصم حصة من قائمة المشتركين والفرق"
                                  );
                                  setFeedback({ ok: res.ok, msg: res.messageAr });
                                }}
                                className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold hover:opacity-95"
                              >
                                خصم حصة ({l.completedSessions + 1}/{l.totalSessions}) ✓
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => {
                                const res = renewSwimmerSubscription({
                                  ledgerId: l.id,
                                  totalSessions: l.totalSessions,
                                  packageTitleAr: l.packageTitleAr,
                                });
                                setFeedback({ ok: res.ok, msg: res.messageAr });
                              }}
                              className={`px-3.5 py-2 rounded-full text-xs font-bold border ${
                                isExpired
                                  ? "bg-deep-olive text-white border-deep-olive"
                                  : "bg-surface-card text-dark-slate border-surface-container hover:bg-lime-tint"
                              }`}
                            >
                              تجديد الاشتراك بكود جديد ↻
                            </button>
                          </div>

                          <Link
                            href={`/dashboard/ledger?id=${l.id}`}
                            className="text-[11px] font-bold text-deep-olive hover:underline"
                          >
                            سجل الحصص والإيصالات ←
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: بطاقات المواعيد والأسعار اللانهائية */}
        {activeTab === "schedules" && (
          <section className="bg-surface-card rounded-[22px] p-6 shadow-sm border border-surface-container flex flex-col gap-4 animate-captenly-enter">
            <div>
              <h2 className="font-section-title text-dark-slate">
                إدارة بطاقات المواعيد والمدارس (عدد لا نهائي)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                أنشئ أي عدد من البطاقات لكل فئة وتوقيت وساعة حصة ومدتها وسعرها ومزيد من التفاصيل — وتظهر مباشرة في صفحة المنشأة العامة بدون أي بيانات وهمية.
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

        {/* TAB 3: كباتن الأكاديمية والشهادات (مع الربط التلقائي والإشعار) */}
        {activeTab === "coaches" && (
          <div className="flex flex-col gap-6 animate-captenly-enter">
            <form
              onSubmit={handleAddCoachRoster}
              className="bg-surface-card rounded-[22px] p-6 shadow-sm border border-surface-container flex flex-col gap-4"
            >
              <div>
                <h2 className="font-section-title text-dark-slate flex items-center gap-2">
                  <Icon name="sports" className="text-[22px] text-deep-olive" />
                  <span>تسجيل كباتن المنشأة وشهاداتهم المعتمدة</span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                  أي كابتن تسجله هنا (حتى لو لم ينشئ حساباً شخصياً على كابتنلي بعد) يظهر تلقائياً مع شهاداته في تبويب «الكباتن الموثقون» بصفحة المنشأة العامة. وإذا كان للكابتن حساب مسجل، يتم ربط ملفه وإرسال إشعار فوري له بتسجيل اسمه في منشأتك.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">اسم الكابتن *</label>
                  <input
                    required
                    value={coachNameInput}
                    onChange={(e) => setCoachNameInput(e.target.value)}
                    placeholder="مثلاً: كابتن أحمد طارق الشناوي"
                    className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">المسمى / الدور في الأكاديمية *</label>
                  <input
                    required
                    value={coachRoleInput}
                    onChange={(e) => setCoachRoleInput(e.target.value)}
                    placeholder="مدرب فرق البطولات / مدرب براعم"
                    className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">التخصص التدريبي *</label>
                  <input
                    required
                    value={coachSpecialtyInput}
                    onChange={(e) => setCoachSpecialtyInput(e.target.value)}
                    placeholder="تأسيس أطفال، سباحة حرة، إنقاذ"
                    className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">أيام ومواعيد تواجد الكابتن</label>
                  <input
                    value={coachScheduleInput}
                    onChange={(e) => setCoachScheduleInput(e.target.value)}
                    placeholder="السبت والاثنين والأربعاء 4 م – 9 م"
                    className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">
                    كود الكابتن على كابتنلي (اختياري — للربط وإرسال إشعار لحسابه إن وُجد)
                  </label>
                  <input
                    value={coachCodeQuery}
                    onChange={(e) => setCoachCodeQuery(e.target.value)}
                    placeholder="اتركه فارغاً إذا لم يكن للكابتن حساب، أو أدخل كوده مثل CAP-ID-1042"
                    className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs font-mono outline-none border border-surface-container"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">
                  الشهادات والاعتمادات الحاصل عليها الكابتن * (شهادة في كل سطر أو مفصولة بفاصلة)
                </label>
                <textarea
                  required
                  rows={3}
                  value={coachCertsInput}
                  onChange={(e) => setCoachCertsInput(e.target.value)}
                  placeholder={"شهادة الاتحاد المصري للسباحة (ESF)\nشهادة الإنقاذ والإسعاف الأولي (EDLF)\nبكالوريوس تربية رياضية — تخصص رياضات مائية"}
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingCoach}
                className="w-fit px-6 py-3 rounded-full bg-dark-slate text-electric-volt font-bold text-xs shadow-sm hover:opacity-95 disabled:opacity-60 flex items-center gap-2"
              >
                {isSavingCoach ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-electric-volt border-t-transparent animate-spin" />
                    <span>جاري تسجيل الكابتن وتحديث صفحة المنشأة...</span>
                  </>
                ) : (
                  <>
                    <Icon name="verified" className="text-[16px]" />
                    <span>إضافة الكابتن وشهاداته لقسم الكباتن الموثقين بالمنشأة ✓</span>
                  </>
                )}
              </button>
            </form>

            {/* Current Facility Coaches List */}
            <section className="bg-surface-card rounded-[22px] p-6 shadow-sm border border-surface-container flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-card-title text-dark-slate">
                  قائمة كباتن الأكاديمية الظاهرين في الصفحة العامة ({rosterCoaches.length + affiliatedRegisteredCoaches.length})
                </h3>
                <Link
                  href={`/f/${facility.slug}`}
                  className="text-xs font-bold text-deep-olive hover:underline"
                >
                  معاينة ظهورهم في تبويب «الكباتن الموثقون» ←
                </Link>
              </div>

              {rosterCoaches.length === 0 && affiliatedRegisteredCoaches.length === 0 ? (
                <div className="rounded-2xl bg-surface-snow p-6 text-center text-xs text-text-muted">
                  لم تتم إضافة كباتن بعد. أضف كباتن الأكاديمية وشهاداتهم من النموذج أعلاه ليظهروا للجمهور.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rosterCoaches.map((rc) => (
                    <div
                      key={rc.id}
                      className="rounded-2xl bg-surface-snow p-4 border border-surface-container flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-card-title-sm text-dark-slate">{rc.fullNameAr}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rc.linkedCoachId
                                  ? "bg-lime-tint text-deep-olive"
                                  : "bg-surface-card border border-surface-container text-text-muted"
                              }`}
                            >
                              {rc.linkedCoachId
                                ? `حساب مربوط (${rc.linkedSingleCoachId || "موثق"}) ✓`
                                : "مسجل بواسطة إدارة المنشأة ✓"}
                            </span>
                          </div>
                          <div className="text-xs text-deep-olive font-bold mt-0.5">
                            {rc.roleTitleAr} • {rc.specialtyAr}
                          </div>
                          {rc.scheduleAr && (
                            <div className="text-[11px] text-text-muted mt-0.5">
                              المواعيد: {rc.scheduleAr}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFacilityCoachRosterEntry(facility.id, rc.id)}
                          className="text-[11px] font-bold text-status-danger hover:underline shrink-0"
                        >
                          حذف
                        </button>
                      </div>

                      <div className="flex flex-col gap-1 pt-2 border-t border-surface-container/70">
                        <span className="text-[11px] font-extrabold text-dark-slate">
                          الشهادات والاعتمادات المسجلة:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rc.certificatesAr.map((cert, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-card border border-surface-container text-[11px] font-bold text-deep-olive"
                            >
                              <Icon name="workspace_premium" className="text-[13px]" />
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
                        className="rounded-2xl bg-surface-snow p-4 border border-surface-container flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-card-title-sm text-dark-slate">{coach.fullNameAr}</div>
                            <div className="text-xs text-deep-olive font-bold">{coach.titleAr}</div>
                          </div>
                          <Link
                            href={`/c/${coach.slug}`}
                            className="px-3 py-1.5 rounded-full bg-lime-tint text-deep-olive text-[11px] font-bold"
                          >
                            ملف الكابتن ←
                          </Link>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {coach.badges.map((b) => (
                            <span
                              key={b.code}
                              className="px-2.5 py-1 rounded-lg bg-surface-card border border-surface-container text-[11px] font-bold text-deep-olive"
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

        {/* TAB 4: موظفو المنشأة والصلاحيات + تبديل الحساب */}
        {activeTab === "staff" && (
          <div className="flex flex-col gap-6 animate-captenly-enter">
            <form
              onSubmit={handleAddStaff}
              className="bg-surface-card rounded-[22px] p-6 shadow-sm border border-surface-container flex flex-col gap-4"
            >
              <div>
                <h2 className="font-section-title text-dark-slate flex items-center gap-2">
                  <Icon name="badge" className="text-[22px] text-deep-olive" />
                  <span>تعيين موظفي المنشأة ومنح صلاحيات تبديل الحساب</span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                  يمكنك تعيين موظفين (مثل <strong>مسؤول الاشتراكات والحضور</strong> أو <strong>مدير الحسابات</strong>) سواء كان لديهم حساب على كابتنلي أو بدون حساب. وإذا ربطت الموظف بحسابه على كابتنلي، سيظهر له زر <strong>«تبديل الحساب لوظيفة المنشأة»</strong> في ملفه الشخصي ليدخل على واجهة المنشأة مقتصرة على صلاحيته فقط!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">اسم الموظف *</label>
                  <input
                    required
                    value={staffNameInput}
                    onChange={(e) => setStaffNameInput(e.target.value)}
                    placeholder="الاسم الثلاثي للموظف"
                    className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">الدور والصلاحية الوظيفية *</label>
                  <select
                    value={staffRoleInput}
                    onChange={(e) => setStaffRoleInput(e.target.value as FacilityStaffRole)}
                    className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs font-bold outline-none border border-surface-container"
                  >
                    <option value="subscriptions_manager">
                      مسؤول الاشتراكات والحضور (مسح QR + إدخال الكود + المشتركين)
                    </option>
                    <option value="accounts_manager">
                      مدير الحسابات والماليات (الإحصائيات + بطاقات الأسعار + الإيصالات)
                    </option>
                    <option value="general_staff">إداري بالمنشأة</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">رقم الهاتف (اختياري)</label>
                  <input
                    value={staffPhoneInput}
                    onChange={(e) => setStaffPhoneInput(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">
                    كود حساب الموظف لتفعيل تبديل الحساب (اختياري)
                  </label>
                  <input
                    value={staffAccountQuery}
                    onChange={(e) => setStaffAccountQuery(e.target.value)}
                    placeholder="CAP-M-XXXX أو اتركه فارغاً"
                    className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs font-mono outline-none border border-surface-container"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingStaff}
                className="w-fit px-6 py-3 rounded-full bg-dark-slate text-electric-volt font-bold text-xs shadow-sm hover:opacity-95 disabled:opacity-60 flex items-center gap-2"
              >
                {isSavingStaff ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-electric-volt border-t-transparent animate-spin" />
                    <span>جاري حفظ الصلاحية...</span>
                  </>
                ) : (
                  <>
                    <Icon name="person_add" className="text-[16px]" />
                    <span>إضافة الموظف وتفعيل صلاحيته ✓</span>
                  </>
                )}
              </button>
            </form>

            {/* Staff List */}
            <section className="bg-surface-card rounded-[22px] p-6 shadow-sm border border-surface-container flex flex-col gap-4">
              <h3 className="font-card-title text-dark-slate">
                طاقم موظفي المنشأة والصلاحيات الممنوحة ({staffMembers.length})
              </h3>

              {staffMembers.length === 0 ? (
                <div className="rounded-2xl bg-surface-snow p-6 text-center text-xs text-text-muted">
                  لم يتم تعيين موظفين بعد. استخدم النموذج أعلاه لإضافة مسؤول اشتراكات أو مدير حسابات.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {staffMembers.map((st) => (
                    <div
                      key={st.id}
                      className="rounded-2xl bg-surface-snow p-4 border border-surface-container flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-card-title-sm text-dark-slate">{st.fullNameAr}</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-lime-tint text-deep-olive text-[11px] font-extrabold">
                            {st.roleTitleAr}
                          </span>
                        </div>
                        <div className="text-xs text-text-muted">
                          {st.hasAccount
                            ? `مربوط بحساب كابتنلي (${st.linkedMemberCode || "مفعل"}) — متاح له تبديل الحساب ✓`
                            : "مسجل إدارياً بدون حساب شخصي على المنصة"}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {st.role === "subscriptions_manager"
                            ? "الصلاحيات: مسح الـ QR بالكاميرا + إدخال كود الاشتراك يدوياً + قائمة المشتركين"
                            : st.role === "accounts_manager"
                            ? "الصلاحيات: الإحصائيات المالية + بطاقات الأسعار والمواعيد + أرشيف الإيصالات"
                            : "الصلاحيات: متابعة إدارية"}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            switchToStaffMode(st.id);
                          }}
                          className="px-3 py-1.5 rounded-full bg-dark-slate text-electric-volt text-[11px] font-bold"
                          title="معاينة كيف يرى هذا الموظف لوحة المنشأة عند تبديل حسابه"
                        >
                          معاينة واجهة الموظف
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFacilityStaffMember(facility.id, st.id)}
                          className="text-[11px] font-bold text-status-danger hover:underline"
                        >
                          إلغاء الصلاحية
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 5: مقالات ومنشورات المنشأة */}
        {activeTab === "articles" && (
          <section className="bg-surface-card rounded-[22px] p-6 shadow-sm border border-surface-container">
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
        onLedgerCheckedIn={(_ledgerId, messageAr) => {
          setFeedback({ ok: true, msg: messageAr });
        }}
        onMemberDetectedForEnroll={({ memberCode: detectedCode, athleteNameAr }) => {
          setActiveTab("subscribers");
          setMemberCodeInput(detectedCode);
          if (athleteNameAr) setAthleteNameInput(athleteNameAr);
          setFeedback({
            ok: true,
            msg: `تم مسح كود العضوية ${detectedCode}${athleteNameAr ? ` (${athleteNameAr})` : ""} — اختر المدرسة وعدد الحصص واضغط تفعيل لتوليد كود الاشتراك فوراً.`,
          });
        }}
      />
    </div>
  );
}
