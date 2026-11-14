"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { DynamicScheduleCardsBuilder } from "@/components/editorial/DynamicScheduleCardsBuilder";
import { AuthorArticlesManager } from "@/components/editorial/AuthorArticlesManager";
import { QrCameraScannerModal } from "@/components/qr/QrCameraScannerModal";

export default function Desktop13() {
  const {
    coaches,
    facilities,
    sessionLedgers,
    memberRegistry,
    enrollSwimmerByMemberCode,
    checkInSession,
    checkInBySubscriptionCode,
    renewSwimmerSubscription,
    validateAndSaveCoachBio,
    recordCoachSkillAndPB,
    verifiedLeads,
    currentPersona,
    isAuthenticated,
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
  const [packageTitle, setPackageTitle] = useState("باقة التأسيس والمتابعة — 8 حصص");
  const [sessionsCount, setSessionsCount] = useState<8 | 12 | 24>(8);
  const [feeEgp, setFeeEgp] = useState("650");
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);

  // Bio Law 3/1985 check
  const [bioDraft, setBioDraft] = useState(
    activeCoach?.bioAr ||
      currentPersona.bioAr ||
      "مدرب سباحة تأسيس وإنقاذ مائي معتمد، التزام كامل بتدريب اللياقة والمهارات المائية."
  );

  // Coach PB & Skill Assessment logger
  const [pbSwimmerName, setPbSwimmerName] = useState("");
  const [pbEventTitle, setPbEventTitle] = useState("");
  const [pbTimeSeconds, setPbTimeSeconds] = useState("");
  const [pbRatingOverall, setPbRatingOverall] = useState("5");

  const matchedMember = useMemo(
    () =>
      memberRegistry.find(
        (m) => m.memberCode.toUpperCase() === memberCode.trim().toUpperCase()
      ),
    [memberRegistry, memberCode]
  );

  const handleEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    const res = enrollSwimmerByMemberCode({
      memberCode: memberCode.trim() || `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`,
      athleteNameAr: athleteNameInput.trim() || matchedMember?.fullNameAr || "سباح متدرب",
      facilityId: selectedFacId,
      coachId: activeCoach?.id || currentPersona.id,
      packageTitleAr: packageTitle,
      totalSessions: sessionsCount,
      amountEgp: Number(feeEgp) || 0,
    });
    setStatusMsg({ ok: res.ok, msg: res.messageAr });
    if (res.ok) {
      setMemberCode("");
      setAthleteNameInput("");
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

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        {/* Coach Header */}
        {!activeCoach ? (
          <section className="rounded-[20px] bg-dark-slate text-surface-card p-6 md:p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="px-3 py-1 rounded-full bg-deep-carbon text-electric-volt text-xs font-bold w-fit">
                بوابة الكابتن وتفعيل السباحين
              </span>
              <h1 className="font-hero-headline text-[24px] md:text-[30px]">
                أهلاً كابتن {currentPersona.fullNameAr} — وثّق ملفك لإصدار الشارات الخضراء
              </h1>
              <p className="text-xs text-surface-container-high max-w-2xl">
                أكمل توثيق شهاداتك ورقم التواصل ليظهر ملفك العام للجمهور وتتمكن من نشر بطاقات المواعيد والأسعار ومقالاتك الرياضية.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/claim?mode=coach"
                className="px-6 py-3 rounded-full bg-electric-volt text-dark-slate font-card-title-sm text-xs text-center"
              >
                وثّق حسابك ككابتن الآن ✓
              </Link>
              <Link
                href="/dashboard/athlete/settings"
                className="px-4 py-3 rounded-full bg-white/10 text-white text-xs font-bold"
              >
                إعدادات الحساب والصورة
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-[20px] bg-dark-slate text-surface-card p-6 md:p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={currentPersona.avatarUrl || activeCoach.avatarUrl || "/screens/3dff88737bec.jpg"}
                alt={activeCoach.fullNameAr}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-electric-volt shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-lime-tint text-deep-olive text-xs font-bold">
                    ✓ كابتن موثق ({activeCoach.SingleCoachId})
                  </span>
                  <span className="text-xs text-surface-variant">
                    {activeCoach.city} • الشارات النشطة: {activeCoach.badges.length}
                  </span>
                </div>
                <h1 className="text-[22px] md:text-[26px] font-extrabold leading-snug text-surface-card mt-1.5">
                  أهلاً كابتن {activeCoach.fullNameAr}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-deep-olive text-white text-xs font-bold hover:brightness-105"
              >
                <Icon name="qr_code_scanner" className="text-[16px]" />
                <span>مسح QR بالكاميرا</span>
              </button>
              <Link
                href={`/c/${activeCoach.slug}`}
                className="px-5 py-2.5 rounded-full bg-electric-volt text-dark-slate font-card-title-sm text-xs"
              >
                عرض ملفي العام بالشارات
              </Link>
              <Link
                href="/dashboard/athlete/settings"
                className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
              >
                إعدادات البروفايل والصورة
              </Link>
            </div>
          </section>
        )}

        {statusMsg && (
          <div
            className={`rounded-2xl p-4 flex items-center justify-between border animate-captenly-enter ${
              statusMsg.ok
                ? "bg-lime-tint/70 border-deep-olive text-dark-slate"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            <span className="text-sm font-bold">{statusMsg.msg}</span>
            <button type="button" onClick={() => setStatusMsg(null)} className="text-xs underline">
              إغلاق
            </button>
          </div>
        )}

        {/* Direct Manual Subscription Code Check-in Bar */}
        <section className="rounded-[20px] bg-dark-slate text-white p-5 shadow-md border border-electric-volt/25 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-electric-volt text-dark-slate flex items-center justify-center shrink-0">
              <Icon name="keyboard" className="text-[20px]" />
            </div>
            <div>
              <h2 className="font-card-title-sm text-electric-volt">
                خصم الحصة بإدخال كود الاشتراك يدوياً (بدون كاميرا) أو بمسح الـ QR
              </h2>
              <p className="text-xs text-white/80">
                أدخل كود الاشتراك المتجدد للسباح (مثل <span className="font-mono text-electric-volt">SUB-4821-08</span>) لتسجيل حضوره فوراً؛ ينتهي الكود تلقائياً بانتهاء حصص الباقة.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualSubCode.trim()) return;
              const res = checkInBySubscriptionCode(
                manualSubCode.trim(),
                manualSubNote.trim() || "حضور مسجل بواسطة الكابتن بكود الاشتراك"
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
              className="rounded-xl bg-deep-carbon text-white px-3.5 py-2.5 text-xs font-mono border border-white/15 outline-none w-full sm:w-44"
            />
            <input
              value={manualSubNote}
              onChange={(e) => setManualSubNote(e.target.value)}
              placeholder="ملاحظة الحصة (اختياري)"
              className="rounded-xl bg-deep-carbon text-white px-3 py-2.5 text-xs border border-white/15 outline-none w-full sm:w-44"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-electric-volt text-dark-slate text-xs font-extrabold hover:brightness-105 shrink-0"
            >
              خصم حصة بالكود ✓
            </button>
          </form>
        </section>

        {/* Main Operations Grid: Enroll Swimmer + Law 3/1985 Bio */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <form
            onSubmit={handleEnroll}
            className="lg:col-span-7 bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-4 border border-surface-container"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-section-title text-dark-slate">
                  إضافة مشترك جديد وتوليد كود اشتراك متجدد (SUB-XXXX)
                </h2>
                <p className="font-body-compact text-text-muted mt-0.5">
                  امسح QR السباح أو أدخل اسمه وكود عضويته لتفعيل باقة جديدة بكود اشتراك مستقل ينتهي بانتهاء حصصها.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-deep-olive text-white text-xs font-bold hover:brightness-105 shadow-xs"
                >
                  <Icon name="qr_code_scanner" className="text-[16px]" />
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
                  className="w-8 h-8 rounded-full bg-surface-snow border border-surface-container flex items-center justify-center text-dark-slate hover:bg-lime-tint/50 disabled:opacity-50"
                >
                  <Icon name="sync" className={`text-[15px] ${syncingCloud ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">اسم السباح *</label>
                <input
                  required={!matchedMember}
                  value={athleteNameInput}
                  onChange={(e) => setAthleteNameInput(e.target.value)}
                  placeholder={matchedMember?.fullNameAr || "اسم السباح المتدرب"}
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">كود عضوية السباح (اختياري)</label>
                <input
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                  placeholder="CAP-M-XXXX"
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 font-mono text-xs outline-none border border-surface-container"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">مكان التدريب (النادي / المسبح)</label>
                <select
                  value={selectedFacId}
                  onChange={(e) => setSelectedFacId(e.target.value)}
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
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
                  <label className="text-xs font-bold text-dark-slate">الحصص</label>
                  <select
                    value={sessionsCount}
                    onChange={(e) => setSessionsCount(Number(e.target.value) as 8 | 12 | 24)}
                    className="rounded-xl bg-surface-snow px-3 py-2.5 text-xs outline-none border border-surface-container"
                  >
                    <option value={8}>8 حصص</option>
                    <option value={12}>12 حصة</option>
                    <option value={24}>24 حصة</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">الرسوم ج.م</label>
                  <input
                    type="number"
                    value={feeEgp}
                    onChange={(e) => setFeeEgp(e.target.value)}
                    className="rounded-xl bg-surface-snow px-3 py-2.5 text-xs outline-none border border-surface-container"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm hover:opacity-95 shadow-sm"
            >
              تفعيل الباقة وإصدار كود الاشتراك والـ QR للسباح فوراً ✓
            </button>
          </form>

            {/* Bio & Coach PB Logger */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-surface-container flex flex-col gap-3">
                <h3 className="font-card-title-sm text-dark-slate">
                  تحديث النبذة والسيرة المهنية للكابتن
                </h3>
                <textarea
                  rows={3}
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  className="rounded-xl bg-surface-snow p-3 text-xs outline-none border border-surface-container leading-relaxed"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (activeCoach) {
                      const res = validateAndSaveCoachBio(activeCoach.id, bioDraft);
                      setStatusMsg({ ok: res.ok, msg: res.messageAr });
                    } else {
                      setStatusMsg({
                        ok: true,
                        msg: "تم تحديث وحفظ النبذة المهنية في ملفك ✓",
                      });
                    }
                  }}
                  className="py-2.5 rounded-full bg-deep-olive text-white font-bold text-xs"
                >
                  حفظ النبذة في ملفي العام ✓
                </button>
              </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const score = Math.max(1, Math.min(5, Number(pbRatingOverall) || 4));
                recordCoachSkillAndPB({
                  swimmerNameAr: pbSwimmerName.trim() || "سبّاح كابتنلي",
                  eventTitleAr: pbEventTitle.trim() || "سباق حر",
                  currentValue: Number(pbTimeSeconds) || 0,
                  unitAr: "ثانية",
                  coachNameAr: activeCoach?.fullNameAr || currentPersona.fullNameAr,
                  facilityNameAr:
                    facilities.find((f) => f.id === selectedFacId)?.nameAr || currentPersona.city,
                  skills: {
                    athleteId: "persona-athlete",
                    evaluatedDateAr: "اليوم — تقييم الكابتن",
                    coachNameAr: activeCoach?.fullNameAr || currentPersona.fullNameAr,
                    metrics: [
                      { labelAr: "التنفس والانسيابية", score },
                      { labelAr: "ضربة الرجلين", score },
                      { labelAr: "دوران الذراعين", score: Math.max(1, score - 1) },
                      { labelAr: "الغطس والدوران", score },
                      { labelAr: "التحمل والسرعة", score },
                    ],
                    coachFeedbackAr: `تقييم موثق لزمن ${pbTimeSeconds} ثانية في سباق ${pbEventTitle}.`,
                  },
                });
                setStatusMsg({
                  ok: true,
                  msg: `تم تسجيل الرقم القياسي والتقييم المعتمد للسباح «${pbSwimmerName}» بنجاح!`,
                });
                setPbSwimmerName("");
                setPbEventTitle("");
                setPbTimeSeconds("");
              }}
              className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-surface-container flex flex-col gap-3"
            >
              <h3 className="font-card-title-sm text-dark-slate">
                تسجيل رقم قياسي وتقييم مهاري موثق للسباح
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  value={pbSwimmerName}
                  onChange={(e) => setPbSwimmerName(e.target.value)}
                  placeholder="اسم السباح"
                  className="rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
                />
                <input
                  required
                  value={pbEventTitle}
                  onChange={(e) => setPbEventTitle(e.target.value)}
                  placeholder="السباق (50م حرة)"
                  className="rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
                />
                <input
                  required
                  type="number"
                  step="0.1"
                  value={pbTimeSeconds}
                  onChange={(e) => setPbTimeSeconds(e.target.value)}
                  placeholder="الزمن بالثواني (31.8)"
                  className="rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
                />
                <select
                  value={pbRatingOverall}
                  onChange={(e) => setPbRatingOverall(e.target.value)}
                  className="rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
                >
                  <option value="5">التقييم: 5/5 ممتاز</option>
                  <option value="4">التقييم: 4/5 متقدم</option>
                  <option value="3">التقييم: 3/5 جيد</option>
                </select>
              </div>
              <button
                type="submit"
                className="py-2.5 rounded-full bg-dark-slate text-electric-volt font-bold text-xs"
              >
                اعتماد التوقيت والتقييم للسباح ✓
              </button>
            </form>
          </div>
        </div>

        {/* Dynamic Unlimited Schedule Cards */}
        <section className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-surface-container flex flex-col gap-4">
          <div>
            <h2 className="font-section-title text-dark-slate">
              بطاقات عروض الحصص والمواعيد والأسعار على ملفي العام (عدد لا نهائي)
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              أضف أي عدد من بطاقات المواعيد والأسعار لكل فئة أو توقيت (الساعة، مدة الحصة، السعر، والتفاصيل).
            </p>
          </div>
          <DynamicScheduleCardsBuilder
            mode="coach"
            targetId={activeCoach?.id}
            coachOffers={activeCoach?.sessionOffers || []}
            onFeedback={setStatusMsg}
          />
        </section>

        {/* Active Subscribers List with Subscription Codes */}
        <section className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-surface-container flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-section-title text-dark-slate">
              قائمة متدربي الكابتن وأكواد اشتراكاتهم ({sessionLedgers.length}) • استفسارات واتساب ({verifiedLeads.length})
            </h2>
            <Link href="/dashboard/ledger" className="text-xs font-bold text-deep-olive hover:underline">
              فتح سجل الحصص الكامل ←
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessionLedgers.map((l) => {
              const isExpired = Boolean(
                l.isCodeExpired || l.status === "completed" || l.completedSessions >= l.totalSessions
              );
              return (
                <div
                  key={l.id}
                  className="rounded-2xl bg-surface-snow p-4 flex flex-col justify-between gap-2.5 border border-surface-container/80"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/dashboard/ledger?id=${l.id}`}
                          className="font-card-title-sm text-dark-slate hover:text-deep-olive truncate"
                        >
                          {l.athleteNameAr}
                        </Link>
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-black border ${
                            isExpired
                              ? "bg-red-50 text-red-700 border-red-200 line-through"
                              : "bg-lime-tint text-deep-olive border-deep-olive/30"
                          }`}
                        >
                          {l.subscriptionCode || l.ledgerCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted truncate mt-0.5">
                        {l.facilityNameAr} • {l.completedSessions}/{l.totalSessions} حصص
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-container/60">
                    {!isExpired ? (
                      <button
                        type="button"
                        onClick={() => {
                          const res = checkInSession(
                            l.id,
                            l.pinCode,
                            "qr_scan",
                            "حضور مسجل بواسطة الكابتن"
                          );
                          setStatusMsg({ ok: res.ok, msg: res.messageAr });
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
                      >
                        خصم حصة ✓
                      </button>
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
                        className="px-3.5 py-1.5 rounded-full bg-deep-olive text-white text-xs font-bold"
                      >
                        تجديد بكود جديد ↻
                      </button>
                    )}
                    <Link
                      href={`/dashboard/ledger?id=${l.id}`}
                      className="text-[11px] font-bold text-deep-olive hover:underline"
                    >
                      تفاصيل الدفتر ←
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Coach Articles Manager */}
        <section className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-surface-container">
          <AuthorArticlesManager
            authorType="coach"
            authorEntityId={activeCoach?.id}
            authorSlug={activeCoach?.slug}
            authorNameAr={activeCoach?.fullNameAr || currentPersona.fullNameAr}
            authorRoleAr={activeCoach?.titleAr || currentPersona.personaTitleAr}
            onFeedback={setStatusMsg}
          />
        </section>
      </div>

      <QrCameraScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onLedgerCheckedIn={(_ledgerId, messageAr) => {
          setStatusMsg({ ok: true, msg: messageAr });
        }}
        onMemberDetectedForEnroll={({ memberCode: detectedCode, athleteNameAr }) => {
          setMemberCode(detectedCode);
          if (athleteNameAr) setAthleteNameInput(athleteNameAr);
          setStatusMsg({
            ok: true,
            msg: `تم مسح كود العضوية ${detectedCode}${athleteNameAr ? ` (${athleteNameAr})` : ""} — اضغط تفعيل لإصدار كود الاشتراك فوراً.`,
          });
        }}
      />
    </div>
  );
}
