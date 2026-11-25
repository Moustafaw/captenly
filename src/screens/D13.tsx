"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { RoleAccessDeniedScreen } from "@/components/auth/RoleAccessDeniedScreen";
import { DynamicScheduleCardsBuilder } from "@/components/editorial/DynamicScheduleCardsBuilder";
import { AuthorArticlesManager } from "@/components/editorial/AuthorArticlesManager";
import { QrCameraScannerModal } from "@/components/qr/QrCameraScannerModal";
import { CoachHostLinksPanel } from "@/components/coach-desk/CoachHostLinksPanel";
import { useCoachPoolsideData } from "@/components/coach-desk/useCoachPoolsideData";

export default function Desktop13() {
  const {
    coaches,
    facilities,
    sessionLedgers,
    memberRegistry,
    facilityLinks,
    enrollSwimmerByMemberCode,
    checkInSession,
    checkInBySubscriptionCode,
    renewSwimmerSubscription,
    validateAndSaveCoachBio,
    recordCoachSkillAndPB,
    requestCoachHostClubLink,
    verifiedLeads,
    currentPersona,
    updateCurrentPersonaProfile,
    isAuthenticated,
    effectiveOffline,
    syncLedgersFromServer,
  } = useCaptenly();

  const activeCoach = useMemo(
    () => coaches.find((c) => c.id === currentPersona.linkedCoachId) || null,
    [coaches, currentPersona.linkedCoachId]
  );

  // Manual Subscription Code Check-in
  const [manualSubCode, setManualSubCode] = useState("");
  const [manualSubNote, setManualSubNote] = useState("");

  // Member Code enrollment
  const [memberCode, setMemberCode] = useState("");
  const [athleteNameInput, setAthleteNameInput] = useState("");
  const [selectedFacId, setSelectedFacId] = useState(
    currentPersona.linkedFacilityId || facilities[0]?.id || ""
  );
  const [packageTitle, setPackageTitle] = useState("");
  const [sessionsCount, setSessionsCount] = useState<8 | 12 | 24>(8);
  const [feeEgp, setFeeEgp] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [rosterGroupFilter, setRosterGroupFilter] = useState<string>("all");

  // Bio check
  const [bioDraft, setBioDraft] = useState(
    activeCoach?.bioAr || currentPersona.bioAr || ""
  );

  // Coach PB & Skill Assessment logger
  const [pbSelectedAthleteId, setPbSelectedAthleteId] = useState("");
  const [pbSwimmerName, setPbSwimmerName] = useState("");
  const [pbEventTitle, setPbEventTitle] = useState("");
  const [pbTimeSeconds, setPbTimeSeconds] = useState("");
  const [pbUnitAr, setPbUnitAr] = useState("ثانية");
  const [pbRatingOverall, setPbRatingOverall] = useState("5");
  const [pbSkills, setPbSkills] = useState<[number, number, number, number, number]>([
    5, 5, 4, 5, 5,
  ]);
  const [pbFeedbackNote, setPbFeedbackNote] = useState("");

  const linkedCoachId = currentPersona.linkedCoachId || currentPersona.id;
  const coachDisplayName = activeCoach?.fullNameAr || currentPersona.fullNameAr;

  const {
    myApprovedLinks,
    coachLedgers,
    coachSwimmers,
    getLedgerScanPermission,
    getFacilityEnrollPricing,
  } = useCoachPoolsideData({
    facilities,
    facilityLinks,
    sessionLedgers,
    linkedCoachId,
    activeCoach,
    coachFullNameAr: currentPersona.fullNameAr,
  });

  const enrollPricingPreview = useMemo(
    () => getFacilityEnrollPricing(selectedFacId, sessionsCount, Number(feeEgp) || 0),
    [getFacilityEnrollPricing, selectedFacId, sessionsCount, feeEgp]
  );

  const visibleLedgers = useMemo(() => {
    if (rosterGroupFilter === "all") return coachLedgers;
    if (rosterGroupFilter === "private") {
      return coachLedgers.filter((l) => !l.linkedEntityId);
    }
    return coachLedgers.filter((l) => l.linkedEntityId === rosterGroupFilter);
  }, [coachLedgers, rosterGroupFilter]);

  const matchedMember = useMemo(
    () =>
      memberRegistry.find(
        (m) => m.memberCode.toUpperCase() === memberCode.trim().toUpperCase()
      ),
    [memberRegistry, memberCode]
  );

  const handleEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    const { hostLink, pricingSnapshot, calc } = enrollPricingPreview;
    const res = enrollSwimmerByMemberCode({
      memberCode: memberCode.trim() || `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`,
      athleteNameAr: athleteNameInput.trim() || matchedMember?.fullNameAr || "سباح متدرب",
      facilityId: selectedFacId,
      coachId: activeCoach?.id || currentPersona.id,
      packageTitleAr: packageTitle.trim() || `باقة ${sessionsCount} حصص`,
      totalSessions: sessionsCount,
      amountEgp: calc.netTotalEgp,
      linkedEntityId: hostLink?.id,
      linkedEntityNameAr: hostLink?.displayNameAr,
      agreementTypeAtEnroll: hostLink?.agreementType,
      pricingSnapshot,
    });
    setStatusMsg({ ok: res.ok, msg: res.messageAr });
    if (res.ok) {
      setMemberCode("");
      setAthleteNameInput("");
      setPackageTitle("");
    }
  };

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="لوحة الكابتن وتفعيل دفاتر الحصص"
        descriptionAr="سجّل دخولك أو أنشئ حساب كابتن على Captenly لإدارة عروض حصصك وتفعيل دفاتر المتدربين ونشر مقالاتك الرياضية."
      />
    );
  }

  if (currentPersona.role !== "coach") {
    return (
      <RoleAccessDeniedScreen
        titleAr="لوحة إدارة الكابتن المعتمد"
        descriptionAr="هذه الصفحة مخصصة لحسابات الكباتن والمدربين المعتمدين لإدارة المتدربين، المسح بالـ QR، وتسجيل الأرقام القياسية."
        fallbackHref={
          currentPersona.role === "facility_manager" ? "/dashboard/facility" : "/dashboard/athlete"
        }
        fallbackLabelAr={
          currentPersona.role === "facility_manager" ? "الانتقال للوحة المنشأة" : "العودة لحسابي"
        }
      />
    );
  }

  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-on-surface antialiased min-h-screen pt-6 pb-20" dir="rtl">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 flex flex-col gap-6">
        {/* Option B Deep Ocean Coach Header */}
        {!activeCoach ? (
          <section className="rounded-3xl bg-[#0F4C5C] text-white p-6 md:p-8 shadow-soft-luxury flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#1D6E7D]/40">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-white/15 text-[#EAF4F8] text-xs font-bold w-fit">
                  بوابة الكابتن وتفعيل السباحين
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    effectiveOffline ? "bg-amber-400 text-[#0F4C5C]" : "bg-white/10 text-[#EAF4F8]"
                  }`}
                >
                  {effectiveOffline ? "وضع الأوفلاين الميداني نشط" : "متصل سحابياً ✓"}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white">
                أهلاً كابتن {currentPersona.fullNameAr} — وثّق ملفك لإصدار الشارات الخضراء
              </h1>
              <p className="text-xs text-[#EAF4F8]/85 max-w-2xl leading-relaxed">
                أكمل توثيق شهاداتك ورقم التواصل ليظهر ملفك العام للجمهور وتتمكن من نشر بطاقات
                المواعيد والأسعار ومقالاتك الرياضية والربط بالأندية المضيفة.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/claim?mode=coach"
                className="px-6 py-3 rounded-full bg-white text-[#0F4C5C] font-black text-xs text-center hover:bg-[#EAF4F8]"
              >
                وثّق حسابك ككابتن الآن ✓
              </Link>
              <Link
                href="/dashboard/athlete/settings"
                className="px-4 py-3 rounded-full bg-white/10 text-white text-xs font-bold border border-white/15 hover:bg-white/20"
              >
                إعدادات الحساب والصورة
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl bg-[#0F4C5C] text-white p-6 md:p-8 shadow-soft-luxury flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#1D6E7D]/40">
            <div className="flex items-center gap-4">
              <img
                src={currentPersona.avatarUrl || activeCoach.avatarUrl || "/screens/3dff88737bec.jpg"}
                alt={activeCoach.fullNameAr}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[#EAF4F8]/50 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      activeCoach.isVerifiedCoach
                        ? "bg-emerald-400/20 text-emerald-100 border border-emerald-300/30"
                        : "bg-white/15 text-[#EAF4F8]"
                    }`}
                  >
                    {activeCoach.isVerifiedCoach
                      ? `✓ كابتن موثق (${activeCoach.SingleCoachId})`
                      : `● حساب كابتن نشط (${activeCoach.SingleCoachId}) — ظاهر في البحث`}
                  </span>
                  <span className="text-xs text-[#EAF4F8]/85">
                    {activeCoach.city} • الشارات النشطة: {activeCoach.badges.length}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      effectiveOffline ? "bg-amber-400 text-[#0F4C5C]" : "bg-white/10 text-[#EAF4F8]"
                    }`}
                  >
                    {effectiveOffline ? "أوفلاين" : "مزامن ✓"}
                  </span>
                </div>
                <h1 className="text-2xl md:text-[28px] font-black leading-snug text-white mt-1.5">
                  أهلاً كابتن {activeCoach.fullNameAr}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white text-[#0F4C5C] text-xs font-black hover:bg-[#EAF4F8] cursor-pointer shadow-soft-luxury"
              >
                <Icon name="qr_code_scanner" size={17} />
                <span>مسح QR بالكاميرا</span>
              </button>
              <Link
                href={`/c/${activeCoach.slug}`}
                className="px-5 py-2.5 rounded-full bg-[#1D6E7D] text-white font-bold text-xs border border-white/20 hover:bg-[#237f90]"
              >
                {activeCoach.isVerifiedCoach ? "عرض ملفي العام بالشارات" : "عرض ملفي العام"}
              </Link>
              <Link
                href="/dashboard/athlete/settings"
                className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15"
              >
                إعدادات البروفايل والصورة
              </Link>
            </div>
          </section>
        )}

        {activeCoach && !activeCoach.isVerifiedCoach && (
          <div className="rounded-2xl bg-[#EAF4F8] border border-[#1D6E7D]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Icon name="verified" size={20} className="text-[#1D6E7D] shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-black text-[#0F4C5C]">
                  ملفك منشور وظاهر الآن للسباحين في الرئيسية والبحث ودفتر الكباتن
                </span>
                <span className="text-[11px] text-ink-muted">
                  التوثيق اختياري بالكامل، وإكماله يمنحك الشارة الخضراء وأولوية أعلى في نتائج
                  الظهور.
                </span>
              </div>
            </div>
            <Link
              href="/claim?mode=coach"
              className="shrink-0 px-4 py-2 rounded-full bg-[#0F4C5C] text-white text-xs font-bold text-center hover:bg-[#1D6E7D]"
            >
              توثيق الحساب (اختياري) ←
            </Link>
          </div>
        )}

        {statusMsg && (
          <div
            className={`rounded-2xl p-4 flex items-center justify-between border animate-captenly-enter ${
              statusMsg.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <span className="text-sm font-bold">{statusMsg.msg}</span>
            <button
              type="button"
              onClick={() => setStatusMsg(null)}
              className="text-xs underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Bilateral Host Club Link & Delegated QR Governance Panel */}
        <CoachHostLinksPanel
          facilities={facilities}
          facilityLinks={facilityLinks}
          coachId={linkedCoachId}
          coachMemberCode={activeCoach?.SingleCoachId}
          coachNameAr={coachDisplayName}
          onRequestHostLink={requestCoachHostClubLink}
          onFeedback={setStatusMsg}
        />

        {/* Direct Manual Subscription Code Check-in Bar */}
        <section className="rounded-3xl bg-[#0F4C5C] text-white p-5 shadow-soft-luxury border border-[#1D6E7D]/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 text-[#EAF4F8] flex items-center justify-center shrink-0">
              <Icon name="keyboard" size={20} />
            </div>
            <div>
              <h2 className="font-black text-sm text-white">
                خصم الحصة بإدخال كود الاشتراك يدوياً أو بمسح الـ QR
              </h2>
              <p className="text-xs text-[#EAF4F8]/85 mt-0.5">
                لحصصك الخاصة أو المجموعات المفوّض بمسحها داخل الأندية (مثل{" "}
                <span className="font-mono font-bold text-white">SUB-4821-08</span>).
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualSubCode.trim()) return;
              const res = checkInBySubscriptionCode(
                manualSubCode.trim(),
                undefined,
                manualSubNote.trim() || "حضور مسجل بواسطة الكابتن بكود الاشتراك",
                linkedCoachId,
                { scanSource: "coach_poolside" }
              );
              setStatusMsg({ ok: res.ok, msg: res.messageAr });
              if (res.ok) {
                setManualSubCode("");
                setManualSubNote("");
              }
            }}
            className="flex flex-wrap sm:flex-nowrap items-center gap-2"
          >
            <input
              required
              value={manualSubCode}
              onChange={(e) => setManualSubCode(e.target.value)}
              placeholder="SUB-XXXX-XX"
              className="rounded-xl bg-white/10 text-white placeholder:text-white/60 px-3.5 py-2.5 text-xs font-mono border border-white/20 outline-none w-full sm:w-44"
            />
            <input
              value={manualSubNote}
              onChange={(e) => setManualSubNote(e.target.value)}
              placeholder="ملاحظة الحصة (اختياري)"
              className="rounded-xl bg-white/10 text-white placeholder:text-white/60 px-3.5 py-2.5 text-xs border border-white/20 outline-none w-full sm:w-44"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-white text-[#0F4C5C] text-xs font-black hover:bg-[#EAF4F8] shrink-0 cursor-pointer"
            >
              خصم حصة ✓
            </button>
          </form>
        </section>

        {/* Main Operations Grid: Enroll Swimmer + Bio & PB Logger */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleEnroll}
            className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-soft-luxury flex flex-col gap-4 border border-sand-border"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-black text-[#0F4C5C]">
                  إضافة مشترك جديد وتوليد كود اشتراك متجدد (SUB-XXXX)
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  امسح QR السباح أو أدخل اسمه وكود عضويته لتفعيل باقة جديدة بحساب مية المنشأة
                  ومقابل التدريب شفافاً.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#1D6E7D] text-white text-xs font-bold hover:bg-[#0F4C5C] cursor-pointer"
                >
                  <Icon name="qr_code_scanner" size={16} />
                  <span>مسح QR</span>
                </button>
                <button
                  type="button"
                  disabled={syncingCloud}
                  onClick={async () => {
                    setSyncingCloud(true);
                    await syncLedgersFromServer();
                    setSyncingCloud(false);
                  }}
                  title="مزامنة الدفاتر من السحابة"
                  className="w-8 h-8 rounded-full bg-[#F7F9FA] border border-sand-border flex items-center justify-center text-[#0F4C5C] hover:bg-[#EAF4F8] disabled:opacity-50 cursor-pointer"
                >
                  <Icon name="sync" size={15} className={syncingCloud ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#0F4C5C]">اسم السباح *</label>
                <input
                  required={!matchedMember}
                  value={athleteNameInput}
                  onChange={(e) => setAthleteNameInput(e.target.value)}
                  placeholder={matchedMember?.fullNameAr || "اسم السباح المتدرب"}
                  className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-sand-border"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#0F4C5C]">
                  كود عضوية السباح أو الابن (اختياري)
                </label>
                <input
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                  placeholder="CAP-M-XXXX أو CAP-JR-XXXX"
                  className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 font-mono text-xs outline-none border border-sand-border"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#0F4C5C]">
                  مكان التدريب (النادي / المسبح)
                </label>
                <select
                  value={selectedFacId}
                  onChange={(e) => setSelectedFacId(e.target.value)}
                  className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-sand-border"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#0F4C5C]">الحصص</label>
                  <select
                    value={sessionsCount}
                    onChange={(e) => setSessionsCount(Number(e.target.value) as 8 | 12 | 24)}
                    className="rounded-xl bg-[#F7F9FA] px-3 py-2.5 text-xs outline-none border border-sand-border"
                  >
                    <option value={8}>8 حصص</option>
                    <option value={12}>12 حصة</option>
                    <option value={24}>24 حصة</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#0F4C5C]">مقابل التدريب (ج.م)</label>
                  <input
                    type="number"
                    min={0}
                    value={feeEgp}
                    onChange={(e) => setFeeEgp(e.target.value)}
                    placeholder="مثلاً: 650"
                    className="rounded-xl bg-[#F7F9FA] px-3 py-2.5 text-xs outline-none border border-sand-border"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#0F4C5C]">اسم الباقة (اختياري)</label>
              <input
                value={packageTitle}
                onChange={(e) => setPackageTitle(e.target.value)}
                placeholder={`مثال: باقة تأسيس ${sessionsCount} حصص`}
                className="rounded-xl bg-[#F7F9FA] px-3.5 py-2 text-xs outline-none border border-sand-border"
              />
            </div>

            {/* Dynamic Water + Training Cost Preview Strip */}
            <div className="rounded-2xl bg-[#EAF4F8] border border-[#1D6E7D]/25 p-3.5 text-xs flex flex-wrap items-center justify-between gap-2 text-[#0F4C5C]">
              <div>
                {enrollPricingPreview.hostLink ? (
                  <span>
                    مرتبط بـ <strong>{enrollPricingPreview.hostLink.displayNameAr}</strong> (
                    {enrollPricingPreview.hostLink.agreementType === "fixed_monthly"
                      ? "اتفاق شهري مقطوع"
                      : "مية بالحصة"}
                    )
                  </span>
                ) : (
                  <span>حسبة ديناميكية حسب تسعير المية المحدد في المنشأة</span>
                )}
              </div>
              <div className="font-black tabular-nums">
                مية ({enrollPricingPreview.calc.waterTotalEgp} ج) + تدريب (
                {enrollPricingPreview.calc.trainingFeeEgp} ج) = الإجمالي{" "}
                {enrollPricingPreview.calc.netTotalEgp} ج.م
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full bg-[#0F4C5C] text-white font-black text-xs hover:bg-[#1D6E7D] shadow-soft-luxury cursor-pointer"
            >
              تفعيل الباقة وإصدار كود الاشتراك والـ QR للسباح فوراً ✓
            </button>
          </form>

          {/* Bio & Coach PB Logger */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white rounded-3xl p-6 shadow-soft-luxury border border-sand-border flex flex-col gap-3">
              <h3 className="font-black text-sm text-[#0F4C5C]">
                تحديث النبذة والسيرة المهنية للكابتن
              </h3>
              <textarea
                rows={3}
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                placeholder="اكتب نبذتك المهنية وتخصصك وخبراتك في السباحة..."
                className="rounded-xl bg-[#F7F9FA] p-3 text-xs outline-none border border-sand-border leading-relaxed"
              />
              <button
                type="button"
                onClick={() => {
                  if (!bioDraft.trim()) {
                    setStatusMsg({ ok: false, msg: "يرجى كتابة النبذة المهنية أولاً قبل الحفظ." });
                    return;
                  }
                  if (activeCoach) {
                    const res = validateAndSaveCoachBio(activeCoach.id, bioDraft);
                    setStatusMsg({ ok: res.ok, msg: res.messageAr });
                  } else {
                    updateCurrentPersonaProfile({ bioAr: bioDraft.trim() });
                    setStatusMsg({
                      ok: true,
                      msg: "تم تحديث وحفظ النبذة المهنية في ملفك ✓",
                    });
                  }
                }}
                className="py-2.5 rounded-full bg-[#1D6E7D] text-white font-bold text-xs hover:bg-[#0F4C5C] cursor-pointer"
              >
                حفظ النبذة في ملفي العام ✓
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const chosenSwimmer = coachSwimmers.find((s) => s.id === pbSelectedAthleteId);
                const swimmerName =
                  chosenSwimmer?.nameAr || pbSwimmerName.trim() || "سبّاح متدرب";
                const targetAthleteId = chosenSwimmer?.id || `athlete-${Date.now()}`;
                recordCoachSkillAndPB({
                  athleteId: targetAthleteId,
                  swimmerNameAr: swimmerName,
                  eventTitleAr: pbEventTitle.trim() || "سباق حر",
                  currentValue: Number(pbTimeSeconds) || 0,
                  unitAr: pbUnitAr,
                  coachNameAr: coachDisplayName,
                  facilityNameAr:
                    facilities.find((f) => f.id === selectedFacId)?.nameAr || currentPersona.city,
                  skills: {
                    athleteId: targetAthleteId,
                    evaluatedDateAr: "اليوم — تقييم الكابتن",
                    coachNameAr: coachDisplayName,
                    metrics: [
                      { labelAr: "التنفس والانسيابية", score: pbSkills[0] },
                      { labelAr: "ضربة الرجلين", score: pbSkills[1] },
                      { labelAr: "دوران الذراعين", score: pbSkills[2] },
                      { labelAr: "الغطس والدوران", score: pbSkills[3] },
                      { labelAr: "التحمل والسرعة", score: pbSkills[4] },
                    ],
                    coachFeedbackAr:
                      pbFeedbackNote.trim() ||
                      `تقييم موثق لقيمة ${pbTimeSeconds} ${pbUnitAr} في سباق ${pbEventTitle}.`,
                  },
                });
                setStatusMsg({
                  ok: true,
                  msg: `تم تسجيل الرقم القياسي (${pbTimeSeconds} ${pbUnitAr}) والتقييم المهاري للسباح «${swimmerName}» ومزامنته لحسابه بنجاح!`,
                });
                setPbSwimmerName("");
                setPbEventTitle("");
                setPbTimeSeconds("");
                setPbFeedbackNote("");
              }}
              className="bg-white rounded-3xl p-6 shadow-soft-luxury border border-sand-border flex flex-col gap-3"
            >
              <h3 className="font-black text-sm text-[#0F4C5C]">
                تسجيل رقم قياسي وتقييم مهاري موثق للسباح
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {coachSwimmers.length > 0 ? (
                  <select
                    value={pbSelectedAthleteId}
                    onChange={(e) => setPbSelectedAthleteId(e.target.value)}
                    className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-sand-border"
                  >
                    <option value="">اختر سبّاحاً من متدربيك (أو أدخل يدوياً)</option>
                    {coachSwimmers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameAr}
                      </option>
                    ))}
                  </select>
                ) : null}
                {(!pbSelectedAthleteId || coachSwimmers.length === 0) && (
                  <input
                    required={!pbSelectedAthleteId}
                    value={pbSwimmerName}
                    onChange={(e) => setPbSwimmerName(e.target.value)}
                    placeholder="اسم السباح"
                    className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-sand-border"
                  />
                )}
                <input
                  required
                  value={pbEventTitle}
                  onChange={(e) => setPbEventTitle(e.target.value)}
                  placeholder="السباق / التمرين (50م حرة)"
                  className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-sand-border"
                />
                <input
                  required
                  type="number"
                  step="0.1"
                  value={pbTimeSeconds}
                  onChange={(e) => setPbTimeSeconds(e.target.value)}
                  placeholder="القيمة (مثلاً: 31.8)"
                  className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-sand-border"
                />
                <select
                  value={pbUnitAr}
                  onChange={(e) => setPbUnitAr(e.target.value)}
                  className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs font-bold outline-none border border-sand-border"
                >
                  <option value="ثانية">الوحدة: ثانية (الأقل أسرع)</option>
                  <option value="متر">الوحدة: متر</option>
                  <option value="لفة">الوحدة: لفة</option>
                  <option value="تكرار">الوحدة: تكرار</option>
                  <option value="نقطة">الوحدة: نقطة</option>
                </select>
                <select
                  value={pbRatingOverall}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 4;
                    setPbRatingOverall(e.target.value);
                    setPbSkills([v, v, v, v, v]);
                  }}
                  className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-sand-border"
                >
                  <option value="5">التقييم العام: 5/5 ممتاز</option>
                  <option value="4">التقييم العام: 4/5 متقدم</option>
                  <option value="3">التقييم العام: 3/5 جيد</option>
                </select>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {["التنفس", "الرجلين", "الذراعين", "الدوران", "التحمل"].map((label, idx) => (
                  <div key={label} className="flex flex-col gap-0.5 text-center">
                    <span className="text-[10px] text-ink-muted">{label}</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={pbSkills[idx]}
                      onChange={(e) => {
                        const next = [...pbSkills] as [number, number, number, number, number];
                        next[idx] = Math.max(1, Math.min(5, Number(e.target.value) || 3));
                        setPbSkills(next);
                      }}
                      className="rounded-lg bg-[#F7F9FA] py-1 text-center text-xs font-bold border border-sand-border"
                    />
                  </div>
                ))}
              </div>
              <input
                value={pbFeedbackNote}
                onChange={(e) => setPbFeedbackNote(e.target.value)}
                placeholder="ملاحظة الكابتن للسباح أو ولي الأمر (اختياري)"
                className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-sand-border"
              />
              <button
                type="submit"
                className="py-2.5 rounded-full bg-[#0F4C5C] text-white font-black text-xs hover:bg-[#1D6E7D] cursor-pointer"
              >
                اعتماد التوقيت والتقييم للسباح ✓
              </button>
            </form>
          </div>
        </div>

        {/* Dynamic Unlimited Schedule Cards */}
        <section className="bg-white rounded-3xl p-6 shadow-soft-luxury border border-sand-border flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-black text-[#0F4C5C]">
              بطاقات عروض الحصص والمواعيد والأسعار على ملفي العام (عدد لا نهائي)
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              أضف أي عدد من بطاقات المواعيد والأسعار لكل فئة أو توقيت (الساعة، مدة الحصة، السعر،
              والتفاصيل).
            </p>
          </div>
          <DynamicScheduleCardsBuilder
            mode="coach"
            targetId={activeCoach?.id}
            coachOffers={activeCoach?.sessionOffers || []}
            onFeedback={setStatusMsg}
          />
        </section>

        {/* Active Subscribers List with Group Filters & Governance Enforcement */}
        <section className="bg-white rounded-3xl p-6 shadow-soft-luxury border border-sand-border flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#0F4C5C]">
                قائمة متدربي الكابتن وأكواد اشتراكاتهم ({visibleLedgers.length}) • استفسارات
                واتساب ({verifiedLeads.length})
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                تظهر هنا حالة خصم الحصص حسب صلاحية كل نادٍ (مباشر من البوابة أو بتفويض مسح للمدرب).
              </p>
            </div>
            <Link
              href="/dashboard/ledger"
              className="text-xs font-bold text-[#1D6E7D] hover:underline shrink-0"
            >
              فتح سجل الحصص الكامل ←
            </Link>
          </div>

          {myApprovedLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRosterGroupFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                  rosterGroupFilter === "all"
                    ? "bg-[#0F4C5C] text-white"
                    : "bg-[#F7F9FA] text-ink-slate hover:bg-[#EAF4F8]"
                }`}
              >
                الكل ({coachLedgers.length})
              </button>
              <button
                type="button"
                onClick={() => setRosterGroupFilter("private")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                  rosterGroupFilter === "private"
                    ? "bg-[#0F4C5C] text-white"
                    : "bg-[#F7F9FA] text-ink-slate hover:bg-[#EAF4F8]"
                }`}
              >
                متدربون خاصون ({coachLedgers.filter((l) => !l.linkedEntityId).length})
              </button>
              {myApprovedLinks.map((lnk) => (
                <button
                  key={lnk.id}
                  type="button"
                  onClick={() => setRosterGroupFilter(lnk.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                    rosterGroupFilter === lnk.id
                      ? "bg-[#0F4C5C] text-white"
                      : "bg-[#F7F9FA] text-ink-slate hover:bg-[#EAF4F8]"
                  }`}
                >
                  {lnk.facilityNameAr || lnk.displayNameAr}
                </button>
              ))}
            </div>
          )}

          {visibleLedgers.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#F7F9FA] text-center text-xs text-ink-muted">
              لا توجد دفاتر مطابقة حالياً — امسح كود عضوية السبّاح أو فعّل له باقة جديدة لتظهر هنا.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleLedgers.map((l) => {
                const isExpired = Boolean(
                  l.isCodeExpired || l.status === "completed" || l.completedSessions >= l.totalSessions
                );
                const perm = getLedgerScanPermission(l);
                const lastCheckin = l.checkins[l.checkins.length - 1];
                return (
                  <div
                    key={l.id}
                    className="rounded-2xl bg-[#F7F9FA] p-4 flex flex-col justify-between gap-2.5 border border-sand-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/dashboard/ledger?id=${l.id}`}
                            className="font-black text-sm text-[#0F4C5C] hover:text-[#1D6E7D] truncate"
                          >
                            {l.athleteNameAr}
                          </Link>
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-black border ${
                              isExpired
                                ? "bg-rose-50 text-rose-700 border-rose-200 line-through"
                                : "bg-[#EAF4F8] text-[#0F4C5C] border-[#1D6E7D]/30"
                            }`}
                          >
                            {l.subscriptionCode || l.ledgerCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-muted truncate mt-0.5">
                          {l.facilityNameAr} • {l.completedSessions} من {l.totalSessions} حصص
                        </div>
                        {lastCheckin && (
                          <div className="text-[10px] text-[#1D6E7D] mt-0.5">
                            آخر حضور: {lastCheckin.dateAr}
                            {lastCheckin.scannedByNameAr ? ` (${lastCheckin.scannedByNameAr})` : ""}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-sand-border/70">
                      {!isExpired ? (
                        perm.canScan ? (
                          <button
                            type="button"
                            onClick={() => {
                              const res = checkInSession(
                                l.id,
                                l.pinCode,
                                "qr_scan",
                                "حضور مسجل بواسطة الكابتن",
                                { scanSource: "coach_poolside" }
                              );
                              setStatusMsg({ ok: res.ok, msg: res.messageAr });
                            }}
                            className="px-3.5 py-1.5 rounded-full bg-[#0F4C5C] text-white text-xs font-bold hover:bg-[#1D6E7D] cursor-pointer"
                          >
                            خصم حصة ✓
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                            <Icon name="lock" size={12} />
                            يُمسح عند بوابة المنشأة
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const res = renewSwimmerSubscription({
                              ledgerId: l.id,
                              totalSessions: l.totalSessions,
                              packageTitleAr: l.packageTitleAr,
                            });
                            setStatusMsg({ ok: res.ok, msg: res.messageAr });
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-[#1D6E7D] text-white text-xs font-bold hover:bg-[#0F4C5C] cursor-pointer"
                        >
                          تجديد بكود جديد ↻
                        </button>
                      )}
                      <Link
                        href={`/dashboard/ledger?id=${l.id}`}
                        className="text-[11px] font-bold text-[#1D6E7D] hover:underline"
                      >
                        تفاصيل الدفتر ←
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Coach Articles Manager */}
        <section className="bg-white rounded-3xl p-6 shadow-soft-luxury border border-sand-border">
          <AuthorArticlesManager
            authorType="coach"
            authorEntityId={activeCoach?.id}
            authorSlug={activeCoach?.slug}
            authorNameAr={coachDisplayName}
            authorRoleAr={activeCoach?.titleAr || currentPersona.personaTitleAr}
            onFeedback={setStatusMsg}
          />
        </section>
      </div>

      <QrCameraScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        scopeCoachId={linkedCoachId}
        onLedgerCheckedIn={(_ledgerId, messageAr) => {
          setStatusMsg({ ok: true, msg: messageAr });
        }}
        onMemberDetectedForEnroll={({ memberCode: detectedCode, athleteNameAr }) => {
          setMemberCode(detectedCode);
          if (athleteNameAr) setAthleteNameInput(athleteNameAr);
          setStatusMsg({
            ok: true,
            msg: `تم مسح كود العضوية ${detectedCode}${
              athleteNameAr ? ` (${athleteNameAr})` : ""
            } — اضغط تفعيل لإصدار كود الاشتراك فوراً.`,
          });
        }}
      />
    </div>
  );
}
