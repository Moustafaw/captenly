"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { QrCodeBox } from "@/components/editorial/QrCodeBox";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { QrCameraScannerModal } from "@/components/qr/QrCameraScannerModal";
import { buildCaptenlyQrUrl } from "@/lib/qrPayload";
import { useLedgerUrlScan } from "@/lib/useLedgerUrlScan";
import { isMemberAccountRole } from "@/types/captenly";

export default function Desktop8() {
  const {
    currentPersona,
    isAuthenticated,
    facilities,
    memberRegistry,
    sessionLedgers,
    enrollSwimmerByMemberCode,
    checkInSession,
    checkInBySubscriptionCode,
    renewSwimmerSubscription,
    uploadInstaPayReceipt,
    confirmReceiptByProvider,
    effectiveOffline,
    offlineQueue,
    syncOfflineQueue,
    syncLedgersFromServer,
    activeStaffAssignment,
    minorAthletes,
  } = useCaptenly();

  const isCoach = currentPersona.role === "coach";
  const isFacility =
    currentPersona.role === "facility_manager" || Boolean(activeStaffAssignment);
  const isProvider = isCoach || isFacility;
  const staffRole = activeStaffAssignment?.role;
  const canScanAndEnroll =
    isCoach ||
    currentPersona.role === "facility_manager" ||
    (Boolean(activeStaffAssignment) && staffRole !== "accounts_manager");
  const linkedFacilityId =
    activeStaffAssignment?.facilityId || currentPersona.linkedFacilityId || "";
  const linkedCoachId = currentPersona.linkedCoachId || currentPersona.id;

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "renewal_due" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [manualSubCodeInput, setManualSubCodeInput] = useState("");
  const [manualSubCodeNote, setManualSubCodeNote] = useState("");

  // Quick enroll form inside ledger for coaches / facilities
  const [newMemberCode, setNewMemberCode] = useState("");
  const [newAthleteName, setNewAthleteName] = useState("");
  const [newFacilityId, setNewFacilityId] = useState(linkedFacilityId);
  const [newPkgTitle, setNewPkgTitle] = useState("مدرسة السباحة — 8 حصص");
  const [newSessionsCount, setNewSessionsCount] = useState<8 | 12 | 24>(8);
  const [newFeeEgp, setNewFeeEgp] = useState("");
  const [enrollMsg, setEnrollMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  const roleLedgers = useMemo(() => {
    if (isFacility) {
      if (!linkedFacilityId) return [];
      return sessionLedgers.filter((l) => l.facilityId === linkedFacilityId);
    }
    if (isCoach) {
      return sessionLedgers.filter(
        (l) => l.coachId === linkedCoachId || l.coachNameAr === currentPersona.fullNameAr
      );
    }
    const isUnifiedMember = isMemberAccountRole(currentPersona.role);
    return sessionLedgers.filter(
      (l) =>
        l.athleteId === currentPersona.id ||
        (currentPersona.memberCode &&
          l.memberCode?.toUpperCase() === currentPersona.memberCode.toUpperCase()) ||
        (isUnifiedMember && minorAthletes.some((m) => m.id === l.athleteId))
    );
  }, [sessionLedgers, currentPersona, isFacility, isCoach, linkedFacilityId, linkedCoachId, minorAthletes]);

  const filteredLedgers = useMemo(() => {
    return roleLedgers.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${l.athleteNameAr} ${l.facilityNameAr} ${l.packageTitleAr} ${l.ledgerCode} ${l.subscriptionCode || ""} ${l.coachNameAr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [roleLedgers, statusFilter, searchQuery]);

  const [selectedLedgerId, setSelectedLedgerId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const id = new URLSearchParams(window.location.search).get("id");
      if (id) setSelectedLedgerId(id);
    }
  }, []);

  const activeLedger =
    filteredLedgers.find((l) => l.id === selectedLedgerId) ||
    filteredLedgers[0] ||
    roleLedgers[0] ||
    null;

  const [pinInput, setPinInput] = useState("");
  const [coachNote, setCoachNote] = useState("");
  const [checkinMsg, setCheckinMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useLedgerUrlScan({
    isAuthenticated,
    canScanAndEnroll,
    isFacility,
    isCoach,
    linkedFacilityId,
    linkedCoachId,
    onSelectLedger: (ledgerId) => setSelectedLedgerId(ledgerId),
    onStatusMessage: (status) => {
      setEnrollMsg(status);
      setCheckinMsg(status);
    },
    onPrefillEnroll: ({ memberCode: mc, athleteNameAr }) => {
      setNewMemberCode(mc);
      if (athleteNameAr) setNewAthleteName(athleteNameAr);
      setShowEnrollForm(true);
    },
  });

  // InstaPay form
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptChannel, setReceiptChannel] = useState<
    "إنستاباي (InstaPay)" | "فودافون كاش (Vodafone Cash)"
  >("إنستاباي (InstaPay)");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptSaved, setReceiptSaved] = useState(false);

  const memberCode = currentPersona.memberCode || "";
  const pendingOfflineCount = offlineQueue.filter((q) => !q.synced).length;

  const matchedEnrollMember = useMemo(
    () =>
      memberRegistry.find(
        (m) => m.memberCode.toUpperCase() === newMemberCode.trim().toUpperCase()
      ),
    [memberRegistry, newMemberCode]
  );

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="دفتر الحصص الـ QR وكود العضوية"
        descriptionAr="سجّل دخولك أو أنشئ حسابك على Captenly للحصول على كود عضويتك الفريد وإدارة دفاتر الحصص."
      />
    );
  }

  const copyMemberCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(memberCode).catch(() => undefined);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleQuickEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    const res = enrollSwimmerByMemberCode({
      memberCode: newMemberCode,
      athleteNameAr: newAthleteName.trim() || matchedEnrollMember?.fullNameAr,
      facilityId: newFacilityId || linkedFacilityId,
      coachId: isCoach ? currentPersona.id : undefined,
      packageTitleAr: newPkgTitle,
      totalSessions: newSessionsCount,
      amountEgp: Number(newFeeEgp) || 0,
    });
    setEnrollMsg({ ok: res.ok, msg: res.messageAr });
    if (res.ok && res.ledger) {
      setSelectedLedgerId(res.ledger.id);
      setNewAthleteName("");
      setShowEnrollForm(false);
    }
  };

  const activeCount = roleLedgers.filter((l) => l.status === "active").length;
  const renewalCount = roleLedgers.filter((l) => l.status === "renewal_due").length;
  const totalCheckinsDone = roleLedgers.reduce((sum, l) => sum + l.completedSessions, 0);

  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-body-default text-[#0F172A] antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1220px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-6">
        {/* Top Offline PWA Status Strip */}
        <section className="rounded-[24px] bg-gradient-to-l from-[#EAF4F8] via-[#F5FAFC] to-white text-[#0F172A] p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] border border-[#1D6E7D]/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                effectiveOffline ? "bg-amber-500 text-white" : "bg-[#1D6E7D] text-white"
              }`}
            >
              <Icon name={effectiveOffline ? "wifi_off" : "qr_code_2"} className="text-[22px]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-card-title text-[#0F172A]">
                  {isCoach
                    ? "دفاتر حصص المتدربين والسباحين (QR Ledger)"
                    : isFacility
                    ? "دفاتر حصص المشتركين في المنشأة (QR Ledger)"
                    : "دفتر الحصص الرقمي والأوفلاين PWA (QR Ledger)"}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    effectiveOffline
                      ? "bg-amber-100 text-amber-800"
                      : "bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20"
                  }`}
                >
                  {effectiveOffline ? "وضع أوفلاين" : "متزامن سحابياً وأوفلاين ✓"}
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-1">
                {effectiveOffline
                  ? "أنت الآن في وضع الأوفلاين — أي حصة تُسجّل الآن تُحفظ محلياً وتُزامَن تلقائياً عند عودة الشبكة."
                  : isProvider
                  ? "لكل سباح أو عميل دفتر حصص مستقل برقم تعريفي وباركود خاص؛ يمكنك إضافة أي مشترك بكود العضوية أو خصم الحصة بالـ QR / PIN."
                  : "كل اشتراك مع كابتن أو أكاديمية — أو لكل ابن — له دفتر حصص مستقل وكود QR يعمل حتى داخل المسابح المغطاة بدون إنترنت."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {pendingOfflineCount > 0 && (
              <button
                type="button"
                onClick={() => syncOfflineQueue()}
                className="px-4 py-2 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold shadow-sm transition-colors"
              >
                مزامنة {pendingOfflineCount} حصة محفوظة أوفلاين ↻
              </button>
            )}
          </div>
        </section>

        {/* Top System-Scan Status Banner (visible in all ledger states) */}
        {(checkinMsg || enrollMsg) && (
          <div
            className={`rounded-2xl px-4 py-3 text-xs font-bold flex items-center justify-between gap-2 shadow-sm ${
              (checkinMsg || enrollMsg)!.ok
                ? "bg-[#EAF4F8] text-[#1D6E7D] border border-[#00ACC1]/30"
                : "bg-red-50 text-red-900 border border-red-200"
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon
                name={(checkinMsg || enrollMsg)!.ok ? "check_circle" : "info"}
                className="text-[16px] shrink-0"
              />
              <span>{(checkinMsg || enrollMsg)!.msg}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setCheckinMsg(null);
                setEnrollMsg(null);
              }}
              className="underline shrink-0"
            >
              إخفاء
            </button>
          </div>
        )}

        {/* Unlinked Member State vs Multi-Ledger Directory */}
        {roleLedgers.length === 0 && !isProvider ? (
          <section className="bg-white rounded-[24px] p-8 md:p-12 shadow-[0_4px_24px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="inline-flex items-center gap-2 text-[#1D6E7D] font-extrabold text-xs w-fit">
                <Icon name="qr_code_2" className="text-[16px]" />
                <span>جاهز للتفعيل مع كابتنك أو أكاديميتك</span>
              </div>

              <h2 className="font-hero-headline text-[26px] md:text-[32px] text-[#0F172A] leading-[1.38]">
                دفتر الحصص الرقمي يُفعّل لكل اشتراك مع كابتن أو أكاديمية موثقة
              </h2>
              <p className="font-body-default text-[#475569] leading-relaxed">
                أنت الآن مسجل بحساب <strong className="text-[#0F172A]">{currentPersona.fullNameAr}</strong> ولا توجد باقات نشطة مرتبطة بكودك بعد. بمجرد اشتراكك وإعطاء كود عضويتك للكابتن أو إدارة المنشأة، سيظهر لك هنا دفتر حصص منفصل لكل باقة أو لكل فرد في الأسرة.
              </p>

              <div className="rounded-2xl bg-[#F7F9FA] p-5 border border-[#0F172A]/8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#64748B]">كود عضويتك الفريد ({currentPersona.fullNameAr})</span>
                  <div className="text-2xl md:text-3xl font-mono font-black text-[#1D6E7D] tracking-wider mt-1">
                    {memberCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyMemberCode}
                  className="px-5 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-badge-label text-xs flex items-center gap-2 shrink-0 w-fit shadow-sm transition-colors"
                >
                  <Icon name={copiedCode ? "check" : "content_copy"} className="text-[16px]" />
                  <span>{copiedCode ? "تم النسخ ✓" : "نسخ كود العضوية"}</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                <Link
                  href="/explore"
                  className="px-5 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-badge-label text-xs transition-colors"
                >
                  استكشف المسابح والأكاديميات ←
                </Link>
                <Link
                  href="/dashboard/athlete"
                  className="px-5 py-2.5 rounded-full bg-[#F7F9FA] text-[#0F172A] border border-[#0F172A]/10 font-badge-label text-xs hover:bg-[#EAF4F8] transition-colors"
                >
                  ملفي الرياضي وتحليل الأداء
                </Link>
                <button
                  type="button"
                  disabled={syncingCloud}
                  onClick={async () => {
                    setSyncingCloud(true);
                    await syncLedgersFromServer();
                    setSyncingCloud(false);
                  }}
                  className="px-5 py-2.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20 font-badge-label text-xs hover:bg-[#DCEEF5] inline-flex items-center gap-1.5 transition-colors"
                >
                  <Icon name="sync" className={`text-[15px] ${syncingCloud ? "animate-spin" : ""}`} />
                  <span>{syncingCloud ? "جاري فحص التفعيل..." : "تحديث الدفاتر من السحابة"}</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col items-center justify-center gap-3 bg-[#F7F9FA] border border-[#0F172A]/8 rounded-2xl p-6">
              <QrCodeBox value={buildCaptenlyQrUrl("member", memberCode)} size={180} label={memberCode} />
              <span className="text-xs text-[#64748B] text-center max-w-xs">
                امسح أو شارك كود عضويتك مع الكابتن أو إدارة المدرسة لتفعيل الباقة (يدعم المسح من كاميرا المنصة أو شريط نظام الهاتف ✓)
              </span>
            </div>
          </section>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Multi-Swimmer / Multi-Client Directory Section */}
            <section className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-section-title text-[#0F172A]">
                      {isProvider
                        ? `سجل دفاتر السباحين والعملاء (${roleLedgers.length})`
                        : `دفاتر الحصص المرتبطة بحسابك (${roleLedgers.length})`}
                    </h2>
                    {isProvider && (
                      <span className="text-xs font-extrabold text-[#1D6E7D]">
                        • {activeCount} باقات نشطة {renewalCount > 0 ? `• ${renewalCount} قريبة من التجديد` : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    {isProvider
                      ? "اختر أي متدرب أو عميل من القائمة لعرض تفاصيل باقته أو تسجيل حصة جديدة له، أو أضف متدرباً جديداً بكود العضوية."
                      : "كل باقة أو فرد لديه دفتر حصص مستقل برصيده وسجل حضوره وباركوده الخاص."}
                  </p>
                </div>

                {isProvider && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canScanAndEnroll && (
                      <button
                        type="button"
                        onClick={() => setScannerOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold shadow-sm transition-colors"
                      >
                        <Icon name="qr_code_scanner" className="text-[16px]" />
                        <span>مسح QR بالكاميرا</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={syncingCloud}
                      onClick={async () => {
                        setSyncingCloud(true);
                        await syncLedgersFromServer();
                        setSyncingCloud(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-[#F7F9FA] text-[#0F172A] border border-[#0F172A]/10 text-xs font-bold hover:bg-[#EAF4F8] disabled:opacity-60 transition-colors"
                    >
                      <Icon name="sync" className={`text-[15px] ${syncingCloud ? "animate-spin" : ""}`} />
                      <span>{syncingCloud ? "جاري المزامنة..." : "مزامنة السحابة"}</span>
                    </button>

                    {canScanAndEnroll && (
                      <button
                        type="button"
                        onClick={() => setShowEnrollForm((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#EAF4F8] hover:bg-[#DCEEF5] text-[#1D6E7D] border border-[#1D6E7D]/25 text-xs font-bold transition-colors"
                      >
                        <Icon name={showEnrollForm ? "close" : "add"} className="text-[16px]" />
                        <span>{showEnrollForm ? "إغلاق النموذج" : "إضافة دفتر / مشترك جديد"}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Provider Stats Row */}
              {isProvider && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/6 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-[#64748B] font-bold">إجمالي الدفاتر</span>
                    <span className="text-xl font-black text-[#0F172A]">{roleLedgers.length}</span>
                  </div>
                  <div className="rounded-2xl bg-[#EAF4F8]/70 border border-[#1D6E7D]/15 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-[#1D6E7D] font-bold">باقات نشطة</span>
                    <span className="text-xl font-black text-[#1D6E7D]">{activeCount}</span>
                  </div>
                  <div className="rounded-2xl bg-amber-50/80 border border-amber-200/70 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-amber-800 font-bold">قريبة من التجديد</span>
                    <span className="text-xl font-black text-amber-700">{renewalCount}</span>
                  </div>
                  <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/6 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-[#64748B] font-bold">حصص تم توثيقها</span>
                    <span className="text-xl font-black text-[#0F172A]">{totalCheckinsDone}</span>
                  </div>
                </div>
              )}

              {/* Manual Subscription Code Entry Bar for Facility / Coach / Staff */}
              {canScanAndEnroll && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!manualSubCodeInput.trim()) return;
                    const res = checkInBySubscriptionCode(
                      manualSubCodeInput.trim(),
                      isFacility ? linkedFacilityId : undefined,
                      manualSubCodeNote.trim() || "خصم حصة بإدخال كود الاشتراك يدوياً",
                      isCoach ? linkedCoachId : undefined
                    );
                    setEnrollMsg({ ok: res.ok, msg: res.messageAr });
                    setCheckinMsg({ ok: res.ok, msg: res.messageAr });
                    if (res.ok && res.ledger) {
                      setSelectedLedgerId(res.ledger.id);
                      setManualSubCodeInput("");
                      setManualSubCodeNote("");
                    }
                  }}
                  className="rounded-2xl bg-gradient-to-l from-[#EAF4F8] to-[#F7F9FA] text-[#0F172A] p-4 border border-[#1D6E7D]/20 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#1D6E7D] text-white flex items-center justify-center shrink-0">
                      <Icon name="keyboard" className="text-[20px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-[#0F172A]">
                        إدخال كود الاشتراك يدوياً (بدون كاميرا) أو التحقق المباشر
                      </div>
                      <div className="text-[11px] text-[#475569]">
                        اكتب كود الاشتراك المتجدد للسباح (مثل <span className="font-mono font-bold text-[#1D6E7D]">SUB-4821-08</span>) لخصم حصة فورية؛ ينتهي الكود تلقائياً بانتهاء الحصص.
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <input
                      value={manualSubCodeInput}
                      onChange={(e) => setManualSubCodeInput(e.target.value)}
                      placeholder="كود الاشتراك: SUB-XXXX-XX"
                      className="rounded-xl bg-white text-[#0F172A] px-3.5 py-2 text-xs font-mono border border-[#0F172A]/12 focus:border-[#1D6E7D] outline-none w-full sm:w-44"
                    />
                    <input
                      value={manualSubCodeNote}
                      onChange={(e) => setManualSubCodeNote(e.target.value)}
                      placeholder="ملاحظة الحصة (اختياري)"
                      className="rounded-xl bg-white text-[#0F172A] px-3 py-2 text-xs border border-[#0F172A]/12 focus:border-[#1D6E7D] outline-none w-full sm:w-40"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-extrabold shrink-0 shadow-sm transition-colors"
                    >
                      خصم حصة بالكود ✓
                    </button>
                  </div>
                </form>
              )}

              {/* Enroll Feedback */}
              {enrollMsg && (
                <div
                  className={`rounded-xl px-4 py-3 text-xs font-bold flex items-center justify-between ${
                    enrollMsg.ok ? "bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20" : "bg-red-50 text-red-900 border border-red-200"
                  }`}
                >
                  <span>{enrollMsg.msg}</span>
                  <button type="button" onClick={() => setEnrollMsg(null)} className="underline">
                    إخفاء
                  </button>
                </div>
              )}

              {/* Inline Add Swimmer / Client Form for Provider */}
              {canScanAndEnroll && showEnrollForm && (
                <form
                  onSubmit={handleQuickEnroll}
                  className="rounded-2xl bg-[#F7F9FA] p-5 border border-[#1D6E7D]/25 flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-card-title-sm text-[#0F172A]">
                      تفعيل دفتر حصص لسباح أو عميل جديد بكود العضوية
                    </h3>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="text-[#64748B]">أكواد سريعة:</span>
                      {memberRegistry.slice(0, 4).map((m) => (
                        <button
                          key={m.memberCode}
                          type="button"
                          onClick={() => {
                            setNewMemberCode(m.memberCode);
                            setNewAthleteName(m.fullNameAr);
                          }}
                          className="px-2.5 py-0.5 rounded-full bg-white border border-[#0F172A]/10 font-mono font-bold text-[#1D6E7D] hover:bg-[#EAF4F8]"
                        >
                          {m.memberCode} ({m.fullNameAr.split(" ")[0]})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-[#0F172A]">كود العضوية *</label>
                      <input
                        required
                        value={newMemberCode}
                        onChange={(e) => setNewMemberCode(e.target.value)}
                        placeholder="CAP-M-XXXX"
                        className="rounded-xl bg-white px-3 py-2 font-mono text-xs outline-none border border-[#0F172A]/10"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-[#0F172A]">اسم السباح / العميل</label>
                      <input
                        value={newAthleteName}
                        onChange={(e) => setNewAthleteName(e.target.value)}
                        placeholder={matchedEnrollMember?.fullNameAr || "تلقائي من الكود أو اكتب الاسم"}
                        className="rounded-xl bg-white px-3 py-2 text-xs outline-none border border-[#0F172A]/10"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-[#0F172A]">المنشأة</label>
                      <select
                        value={newFacilityId}
                        onChange={(e) => setNewFacilityId(e.target.value)}
                        className="rounded-xl bg-white px-3 py-2 text-xs outline-none border border-[#0F172A]/10"
                      >
                        {(isFacility && linkedFacilityId
                          ? facilities.filter((f) => f.id === linkedFacilityId)
                          : facilities
                        ).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nameAr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-[#0F172A]">اسم الباقة والحصص</label>
                      <div className="flex gap-1.5">
                        <input
                          value={newPkgTitle}
                          onChange={(e) => setNewPkgTitle(e.target.value)}
                          className="flex-1 min-w-0 rounded-xl bg-white px-2.5 py-2 text-xs outline-none border border-[#0F172A]/10"
                        />
                        <select
                          value={newSessionsCount}
                          onChange={(e) => setNewSessionsCount(Number(e.target.value) as 8 | 12 | 24)}
                          className="w-20 rounded-xl bg-white px-2 py-2 text-xs outline-none border border-[#0F172A]/10"
                        >
                          <option value={8}>8</option>
                          <option value={12}>12</option>
                          <option value={24}>24</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-[#0F172A]">الرسوم ج.م وتفعيل</label>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          value={newFeeEgp}
                          onChange={(e) => setNewFeeEgp(e.target.value)}
                          className="w-20 rounded-xl bg-white px-2.5 py-2 text-xs outline-none border border-[#0F172A]/10"
                        />
                        <button
                          type="submit"
                          className="flex-1 rounded-xl bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-xs px-3 py-2 transition-colors"
                        >
                          إضافة ✓
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* Search & Status Filters for Providers */}
              {isProvider && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center bg-[#F7F9FA] rounded-full px-3.5 py-2 border border-[#0F172A]/10 flex-1 max-w-md">
                    <Icon name="search" className="text-[#64748B] text-[16px] ml-2 shrink-0" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث باسم السباح، المنشأة، أو رقم الدفتر..."
                      className="w-full bg-transparent text-xs outline-none text-[#0F172A]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "all", label: `الكل (${roleLedgers.length})` },
                      { id: "active", label: "نشط" },
                      { id: "renewal_due", label: "تحتاج تجديد" },
                      { id: "completed", label: "مكتملة" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                          statusFilter === tab.id
                            ? "bg-[#1D6E7D] text-white"
                            : "bg-[#F7F9FA] text-[#64748B] hover:text-[#0F172A] border border-[#0F172A]/8"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Swimmers / Clients Cards Directory */}
              {filteredLedgers.length === 0 ? (
                <div className="rounded-xl bg-[#F7F9FA] p-6 text-center text-xs text-[#64748B]">
                  لا توجد دفاتر مطابقة لفلتر البحث الحالي.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredLedgers.map((l) => {
                    const isSelected = activeLedger?.id === l.id;
                    const pct = Math.min(100, Math.round((l.completedSessions / l.totalSessions) * 100));
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          setSelectedLedgerId(l.id);
                          setCheckinMsg(null);
                        }}
                        className={`text-right rounded-2xl p-4 transition-all border flex flex-col gap-2.5 ${
                          isSelected
                            ? "bg-[#EAF4F8]/65 border-[#1D6E7D] shadow-sm ring-1 ring-[#1D6E7D]/25"
                            : "bg-[#F7F9FA] border-[#0F172A]/8 hover:border-[#1D6E7D]/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-card-title-sm text-[#0F172A] truncate">
                                {l.athleteNameAr}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black border ${
                                  l.isCodeExpired || l.status === "completed"
                                    ? "bg-red-50 text-red-700 border-red-200 line-through"
                                    : "bg-[#EAF4F8] text-[#1D6E7D] border-[#1D6E7D]/25"
                                }`}
                              >
                                {l.subscriptionCode || l.ledgerCode}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#64748B] truncate mt-0.5">
                              {l.facilityNameAr} {l.trackLabelAr ? `• ${l.trackLabelAr}` : ""}
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-extrabold shrink-0 ${
                              l.status === "completed" || l.isCodeExpired
                                ? "text-[#DC2626]"
                                : l.status === "renewal_due"
                                ? "text-amber-700"
                                : "text-[#1D6E7D]"
                            }`}
                          >
                            {l.status === "completed" || l.isCodeExpired
                              ? "منتهي الصلاحية"
                              : l.status === "renewal_due"
                              ? "قارب الانتهاء"
                              : "كود ساري ✓"}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-[#334155] truncate">
                          {l.packageTitleAr}
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                l.status === "renewal_due"
                                  ? "bg-amber-500"
                                  : l.status === "completed"
                                  ? "bg-[#334155]"
                                  : "bg-[#1D6E7D]"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-[#64748B]">
                              {isProvider
                                ? l.subscriptionCode || l.ledgerCode
                                : `${l.ledgerCode} • PIN ${l.pinCode}`}
                            </span>
                            <span className="font-extrabold text-[#1D6E7D]">
                              {l.completedSessions} / {l.totalSessions} حصص
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Active Selected Ledger Detail View */}
            {activeLedger && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Main Ledger & Attendance Control */}
                <div className="lg:col-span-7 flex flex-col gap-5">
                  <section className="bg-white rounded-[24px] p-6 md:p-8 shadow-[0_4px_24px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-extrabold rounded-full px-2.5 py-0.5 ${
                              activeLedger.status === "completed"
                                ? "bg-[#F1F5F9] text-[#64748B]"
                                : activeLedger.status === "renewal_due"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-[#EAF4F8] text-[#1D6E7D]"
                            }`}
                          >
                            {activeLedger.status === "completed"
                              ? "الباقة مكتملة"
                              : activeLedger.status === "renewal_due"
                              ? "تنبيه: متبقي حصتان أو أقل"
                              : "باقة نشطة ✓"}
                          </span>
                          <span className="font-mono text-xs text-[#64748B]">• {activeLedger.ledgerCode}</span>
                        </div>
                        <h2 className="font-section-title text-[#0F172A] mt-2">
                          {activeLedger.athleteNameAr}
                        </h2>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {activeLedger.packageTitleAr} — {activeLedger.facilityNameAr} • {activeLedger.coachNameAr}
                        </p>
                      </div>

                      <div className="text-right sm:text-left shrink-0 bg-[#F7F9FA] rounded-2xl px-4 py-2.5 border border-[#0F172A]/6">
                        <div className="text-3xl font-black text-[#1D6E7D]">
                          {activeLedger.completedSessions} / {activeLedger.totalSessions}
                        </div>
                        <div className="text-[11px] font-bold text-[#64748B]">حصة مكتملة</div>
                      </div>
                    </div>

                    {/* Progress Circles */}
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {Array.from({ length: activeLedger.totalSessions }, (_, idx) => {
                        const num = idx + 1;
                        const done = num <= activeLedger.completedSessions;
                        return (
                          <div
                            key={num}
                            className={`h-14 rounded-xl flex flex-col items-center justify-center font-bold text-xs border transition-colors ${
                              done
                                ? "bg-[#EAF4F8] border-[#1D6E7D]/50 text-[#1D6E7D]"
                                : "bg-[#F7F9FA] border-[#0F172A]/10 text-[#64748B]"
                            }`}
                          >
                            <span>{done ? "✓" : num}</span>
                            <span className="text-[10px]">حصة {num}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Check-in Interactive Box (Facility/Coach/Subscriptions Staff ONLY) */}
                    {canScanAndEnroll ? (
                      <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/8 p-5 flex flex-col gap-3">
                        <div className="font-card-title-sm text-[#0F172A]">
                          تسجيل حضور {activeLedger.athleteNameAr} وخصم الحصة ({effectiveOffline ? "أوفلاين" : "متصل"})
                        </div>

                        {checkinMsg && (
                          <div
                            className={`p-3 rounded-xl text-xs font-bold ${
                              checkinMsg.ok ? "bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20" : "bg-red-50 text-red-800 border border-red-200"
                            }`}
                          >
                            {checkinMsg.msg}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            placeholder="أدخل كود الاشتراك أو PIN (4 أرقام)"
                            className="rounded-xl bg-white px-3.5 py-2.5 text-sm outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D]"
                          />
                          <input
                            value={coachNote}
                            onChange={(e) => setCoachNote(e.target.value)}
                            placeholder="ملاحظة الحصة (اختياري)"
                            className="rounded-xl bg-white px-3.5 py-2.5 text-sm outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D]"
                          />
                          <button
                            type="button"
                            disabled={activeLedger.completedSessions >= activeLedger.totalSessions}
                            onClick={() => {
                              const cleanEntry = pinInput.trim();
                              if (!cleanEntry) {
                                setCheckinMsg({
                                  ok: false,
                                  msg: "يرجى إدخال كود الاشتراك أو الـ PIN أولاً، أو الضغط على «فتح الكاميرا لمسح QR».",
                                });
                                return;
                              }
                              const res = checkInSession(
                                activeLedger.id,
                                cleanEntry,
                                "pin_4digit",
                                coachNote
                              );
                              setCheckinMsg({ ok: res.ok, msg: res.messageAr });
                              if (res.ok) {
                                setPinInput("");
                                setCoachNote("");
                              }
                            }}
                            className="py-2.5 px-4 rounded-xl bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-xs shadow-sm disabled:opacity-40 transition-colors"
                          >
                            خصم حصة بالـ QR / PIN ✓
                          </button>
                        </div>
                      </div>
                    ) : !isProvider ? (
                      <div className="rounded-2xl bg-[#EAF4F8]/70 p-4 text-xs font-bold text-[#1D6E7D] border border-[#1D6E7D]/20 flex items-center gap-2">
                        <Icon name="info" className="text-[16px] shrink-0" />
                        <span>
                          اعرض رمز الـ QR أو كود الاشتراك المتجدد أعلاه للكابتن أو مسؤول الاشتراكات في المسبح لتسجيل حضورك تلقائياً.
                        </span>
                      </div>
                    ) : null}

                    {/* History */}
                    <div className="flex flex-col gap-2">
                      <h3 className="font-card-title-sm text-[#0F172A]">سجل الحصص الموثق</h3>
                      {activeLedger.checkins.length === 0 ? (
                        <p className="text-xs text-[#64748B]">لم تُسجّل أي حصة بعد في هذه الباقة.</p>
                      ) : (
                        activeLedger.checkins.map((c) => (
                          <div
                            key={c.sessionNumber}
                            className="rounded-xl bg-[#F7F9FA] border border-[#0F172A]/6 px-4 py-3 flex items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-bold text-[#0F172A]">حصة #{c.sessionNumber}</span>
                              <span className="text-[#94A3B8] mx-2">•</span>
                              <span className="text-[#475569]">{c.coachNoteAr}</span>
                            </div>
                            <span
                              className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${
                                c.wasOffline ? "bg-amber-50 text-amber-800" : "bg-[#EAF4F8] text-[#1D6E7D]"
                              }`}
                            >
                              {c.dateAr}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>

                {/* Right Sidebar: Subscription Code / QR & InstaPay Archive */}
                <aside className="lg:col-span-5 flex flex-col gap-5">
                  {isProvider ? (
                    <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-card-title text-[#0F172A]">
                          بيانات اشتراك المتدرب: {activeLedger.athleteNameAr}
                        </h3>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold shrink-0 ${
                            activeLedger.isCodeExpired || activeLedger.status === "completed"
                              ? "bg-red-50 text-red-700"
                              : "bg-[#EAF4F8] text-[#1D6E7D]"
                          }`}
                        >
                          {activeLedger.isCodeExpired || activeLedger.status === "completed"
                            ? "منتهي الصلاحية"
                            : "الاشتراك ساري ✓"}
                        </span>
                      </div>

                      <div className="rounded-2xl bg-[#F7F9FA] p-4 border border-[#0F172A]/8 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] text-[#64748B] font-bold">
                            كود الاشتراك الحالي (صالح لـ {activeLedger.totalSessions} حصص)
                          </div>
                          <div
                            className={`font-mono text-2xl font-black mt-0.5 ${
                              activeLedger.isCodeExpired || activeLedger.status === "completed"
                                ? "text-red-700 line-through"
                                : "text-[#1D6E7D]"
                            }`}
                          >
                            {activeLedger.subscriptionCode || activeLedger.ledgerCode}
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="text-[11px] text-[#64748B]">الحصص المتبقية</div>
                          <div className="text-xl font-black text-[#0F172A]">
                            {Math.max(0, activeLedger.totalSessions - activeLedger.completedSessions)} من{" "}
                            {activeLedger.totalSessions}
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-[#64748B] leading-relaxed">
                        {activeLedger.isCodeExpired || activeLedger.status === "completed"
                          ? "انتهت صلاحية كود هذا الاشتراك لإتمام كافة الحصص. يمكنك تجديد اشتراك السباح بالأسفل لتوليد كود اشتراك جديد فوري."
                          : "يمكنك مسح الـ QR من هاتف السباح بالكاميرا أو إدخال كود الاشتراك أعلاه يدوياً لخصم الحصة."}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          const res = renewSwimmerSubscription({
                            ledgerId: activeLedger.id,
                            totalSessions: activeLedger.totalSessions,
                            packageTitleAr: activeLedger.packageTitleAr,
                          });
                          setCheckinMsg({ ok: res.ok, msg: res.messageAr });
                        }}
                        className="w-full py-2.5 rounded-full bg-[#EAF4F8] hover:bg-[#1D6E7D] text-[#1D6E7D] hover:text-white border border-[#1D6E7D]/25 text-xs font-bold transition-colors"
                      >
                        تجديد الاشتراك وتوليد كود اشتراك جديد ({activeLedger.totalSessions} حصص) ↻
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col items-center text-center gap-3">
                      <h3 className="font-card-title text-[#0F172A]">
                        كارت الـ QR وكود اشتراكك الحالي داخل صالة المسبح
                      </h3>
                      <QrCodeBox
                        value={buildCaptenlyQrUrl(
                          "subscription",
                          activeLedger.subscriptionCode || activeLedger.ledgerCode
                        )}
                        size={180}
                        label={
                          activeLedger.isCodeExpired || activeLedger.status === "completed"
                            ? `${activeLedger.subscriptionCode || activeLedger.ledgerCode} (منتهي)`
                            : `كود الاشتراك: ${activeLedger.subscriptionCode || activeLedger.ledgerCode}`
                        }
                      />
                      <p className="text-xs text-[#64748B] max-w-xs">
                        {activeLedger.isCodeExpired || activeLedger.status === "completed"
                          ? "انتهت صلاحية هذا الكود بعد إتمام جميع حصص الباقة. عند التجديد سيصدر لك كود اشتراك جديد تلقائياً."
                          : "أظهر هذا الباركود للكابتن أو مسؤول البوابة — يقبل المسح بكاميرا المنصة أو بسكانر النظام في الموبايل، ويعمل كود الاشتراك يدوياً بدون إنترنت."}
                      </p>
                    </div>
                  )}

                  <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-4">
                    <h3 className="font-card-title text-[#0F172A]">
                      أرشيف إيصالات الدفع المباشر (InstaPay / كاش)
                    </h3>
                    <div className="flex flex-col gap-2">
                      {activeLedger.receipts.map((r) => {
                        const canConfirmReceipt =
                          isCoach ||
                          currentPersona.role === "facility_manager" ||
                          (Boolean(activeStaffAssignment) &&
                            (activeStaffAssignment?.role === "accounts_manager" ||
                              activeStaffAssignment?.role === "general_staff"));
                        return (
                          <div
                            key={r.id}
                            className="rounded-xl bg-[#F7F9FA] p-3 flex flex-col gap-1.5 text-xs border border-[#0F172A]/8"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-bold text-[#0F172A]">{r.channel}</div>
                                <div className="text-[#64748B] font-mono">
                                  مرجع: {r.referenceNumber}
                                </div>
                              </div>
                              <div className="font-bold text-[#1D6E7D]">{r.amountEgp} ج.م</div>
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#0F172A]/6">
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                  r.confirmedByProvider
                                    ? "bg-[#EAF4F8] text-[#1D6E7D]"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {r.confirmedByProvider
                                  ? "✓ مؤكد ومطابق من الحسابات"
                                  : `⏳ ${r.uploadedDateAr || "بانتظار مراجعة الحسابات"}`}
                              </span>
                              {!r.confirmedByProvider && canConfirmReceipt && (
                                <button
                                  type="button"
                                  onClick={() => confirmReceiptByProvider(activeLedger.id, r.id)}
                                  className="px-3 py-1 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-[10px] font-bold transition-colors"
                                >
                                  تأكيد الاستلام ✓
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!receiptRef.trim()) return;
                        uploadInstaPayReceipt(activeLedger.id, {
                          referenceNumber: receiptRef.trim(),
                          channel: receiptChannel,
                          amountEgp: Number(receiptAmount) || 0,
                          packageTitleAr: activeLedger.packageTitleAr,
                        });
                        setReceiptRef("");
                        setReceiptSaved(true);
                        setTimeout(() => setReceiptSaved(false), 2500);
                      }}
                      className="flex flex-col gap-2.5 pt-2 border-t border-[#0F172A]/8"
                    >
                      <div className="text-xs font-bold text-[#0F172A]">إرفاق مرجع تحويل جديد</div>
                      <input
                        required
                        value={receiptRef}
                        onChange={(e) => setReceiptRef(e.target.value)}
                        placeholder="رقم مرجع إنستاباي أو فودافون كاش"
                        className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={receiptChannel}
                          onChange={(e) =>
                            setReceiptChannel(
                              e.target.value as "إنستاباي (InstaPay)" | "فودافون كاش (Vodafone Cash)"
                            )
                          }
                          className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-[#0F172A]/10"
                        >
                          <option value="إنستاباي (InstaPay)">InstaPay</option>
                          <option value="فودافون كاش (Vodafone Cash)">Vodafone Cash</option>
                        </select>
                        <input
                          type="number"
                          value={receiptAmount}
                          onChange={(e) => setReceiptAmount(e.target.value)}
                          className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-[#0F172A]/10"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-xs shadow-sm transition-colors"
                      >
                        حفظ الإيصال في السجل الدائم
                      </button>
                      {receiptSaved && (
                        <span className="text-xs font-bold text-[#1D6E7D] text-center">
                          ✓ تم توثيق الإيصال في أرشيفك بنجاح
                        </span>
                      )}
                    </form>
                  </div>
                </aside>
              </div>
            )}
          </div>
        )}
      </div>

      <QrCameraScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        scopeFacilityId={isFacility ? linkedFacilityId : undefined}
        scopeCoachId={isCoach ? linkedCoachId : undefined}
        onLedgerCheckedIn={(ledgerId, messageAr) => {
          setSelectedLedgerId(ledgerId);
          setCheckinMsg({ ok: true, msg: messageAr });
        }}
        onMemberDetectedForEnroll={({ memberCode: detectedCode, athleteNameAr }) => {
          setShowEnrollForm(true);
          setNewMemberCode(detectedCode);
          if (athleteNameAr) setNewAthleteName(athleteNameAr);
          setEnrollMsg({
            ok: true,
            msg: `تم التقاط كود العضوية ${detectedCode}${athleteNameAr ? ` (${athleteNameAr})` : ""} — اختر الباقة واضغط تفعيل لتشغيل الـ QR على جهاز السباح مباشرة.`,
          });
        }}
      />
    </div>
  );
}
