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

type CoachMobileSubTab = "ops" | "hosts" | "roster" | "profile";

export default function Phone12() {
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

  const [mobileTab, setMobileTab] = useState<CoachMobileSubTab>("ops");
  const [rosterGroupFilter, setRosterGroupFilter] = useState<string>("all");

  const [manualSubCode, setManualSubCode] = useState("");
  const [memberCode, setMemberCode] = useState("");
  const [athleteNameInput, setAthleteNameInput] = useState("");
  const [facId, setFacId] = useState(currentPersona.linkedFacilityId || facilities[0]?.id || "");
  const [sessionsCount, setSessionsCount] = useState<8 | 12 | 24>(8);
  const [feeEgp, setFeeEgp] = useState("");
  const [pkgTitle, setPkgTitle] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);

  const [bioDraft, setBioDraft] = useState(
    activeCoach?.bioAr || currentPersona.bioAr || ""
  );

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
    () => getFacilityEnrollPricing(facId, sessionsCount, Number(feeEgp) || 0),
    [getFacilityEnrollPricing, facId, sessionsCount, feeEgp]
  );

  const visibleLedgers = useMemo(() => {
    if (rosterGroupFilter === "all") return coachLedgers;
    if (rosterGroupFilter === "private") {
      return coachLedgers.filter((l) => !l.linkedEntityId);
    }
    return coachLedgers.filter((l) => l.linkedEntityId === rosterGroupFilter);
  }, [coachLedgers, rosterGroupFilter]);

  const matched = useMemo(
    () =>
      memberRegistry.find(
        (m) => m.memberCode.toUpperCase() === memberCode.trim().toUpperCase()
      ),
    [memberRegistry, memberCode]
  );

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="لوحة الكابتن وتفعيل السباحين"
        descriptionAr="سجّل دخولك أو أنشئ حساب كابتن على Captenly لإدارة عروض حصصك وتفعيل دفاتر المتدربين."
      />
    );
  }

  if (currentPersona.role !== "coach") {
    return (
      <RoleAccessDeniedScreen
        titleAr="لوحة إدارة الكابتن المعتمد"
        descriptionAr="هذه الواجهة مخصصة لحسابات الكباتن لإدارة المتدربين ومسح الـ QR وتحديث السجلات."
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
    <div
      className="screen-root bg-[#F7F9FA] font-body-default min-h-screen px-4 pt-5 pb-24 flex flex-col gap-4"
      dir="rtl"
    >
      {/* Option B Deep Ocean Coach Header */}
      <section className="rounded-3xl bg-[#0F4C5C] text-white p-5 shadow-soft-luxury flex flex-col gap-3 border border-[#1D6E7D]/40">
        {activeCoach ? (
          <>
            <div className="flex items-center gap-3">
              <img
                src={currentPersona.avatarUrl || activeCoach.avatarUrl || "/screens/3dff88737bec.jpg"}
                alt={activeCoach.fullNameAr}
                className="w-12 h-12 rounded-2xl object-cover border-2 border-[#EAF4F8]/50 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/15 text-[#EAF4F8]">
                    {activeCoach.isVerifiedCoach
                      ? `✓ موثق (${activeCoach.SingleCoachId})`
                      : `● كابتن نشط (${activeCoach.SingleCoachId})`}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      effectiveOffline ? "bg-amber-400 text-[#0F4C5C]" : "bg-white/10 text-[#EAF4F8]"
                    }`}
                  >
                    {effectiveOffline ? "أوفلاين" : "مزامن"}
                  </span>
                </div>
                <h1 className="font-black text-base truncate mt-1">
                  أهلاً كابتن {activeCoach.fullNameAr}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/c/${activeCoach.slug}`}
                className="px-3.5 py-1.5 rounded-full bg-white text-[#0F4C5C] text-xs font-black"
              >
                عرض ملفي العام
              </Link>
              <Link
                href="/dashboard/athlete/settings"
                className="px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-bold"
              >
                الإعدادات
              </Link>
              {!activeCoach.isVerifiedCoach && (
                <Link
                  href="/claim?mode=coach"
                  className="px-3 py-1.5 rounded-full bg-[#1D6E7D] text-white text-xs font-bold"
                >
                  توثيق اختياري ←
                </Link>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/15 text-[#EAF4F8] w-fit">
              بوابة الكابتن وتفعيل السباحين
            </span>
            <h1 className="font-black text-base">
              أهلاً كابتن {currentPersona.fullNameAr} — وثّق ملفك لإصدار الشارات
            </h1>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/claim?mode=coach"
                className="px-4 py-2 rounded-full bg-white text-[#0F4C5C] text-xs font-black"
              >
                وثّق حسابك ككابتن الآن ✓
              </Link>
              <Link
                href="/dashboard/athlete/settings"
                className="px-3.5 py-2 rounded-full bg-white/10 text-white text-xs font-bold"
              >
                الإعدادات والصورة
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Mobile Sub-tabs (Do NOT alter SiteDock bottom navigation!) */}
      <nav className="grid grid-cols-4 gap-1.5 bg-white p-1.5 rounded-2xl border border-sand-border shadow-soft-luxury">
        {[
          { id: "ops" as const, label: "الحضور", icon: "qr_code_scanner" },
          { id: "hosts" as const, label: "الأندية", icon: "hub" },
          { id: "roster" as const, label: "المتدربون", icon: "groups" },
          { id: "profile" as const, label: "الملف", icon: "tune" },
        ].map((t) => {
          const active = mobileTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setMobileTab(t.id)}
              className={`py-2 px-1 rounded-xl flex flex-col items-center gap-0.5 text-[11px] font-black transition-all cursor-pointer ${
                active ? "bg-[#0F4C5C] text-white" : "text-ink-slate hover:bg-[#EAF4F8]"
              }`}
            >
              <Icon name={t.icon} size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {feedback && (
        <div
          className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between border ${
            feedback.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <span>{feedback.msg}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline shrink-0 mr-2 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* TAB 1: Attendance Scan + New Subscriber Enrollment */}
      {mobileTab === "ops" && (
        <div className="flex flex-col gap-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualSubCode.trim()) return;
              const res = checkInBySubscriptionCode(
                manualSubCode.trim(),
                undefined,
                "حضور مسجل بواسطة الكابتن بكود الاشتراك",
                linkedCoachId,
                { scanSource: "coach_poolside" }
              );
              setFeedback({ ok: res.ok, msg: res.messageAr });
              if (res.ok) setManualSubCode("");
            }}
            className="rounded-3xl bg-[#0F4C5C] text-white p-4 flex flex-col gap-2.5 shadow-soft-luxury"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-white">
                خصم حصة بكود الاشتراك يدوياً أو بالـ QR
              </span>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-[#0F4C5C] text-[11px] font-black cursor-pointer"
              >
                <Icon name="qr_code_scanner" size={14} />
                <span>فتح الكاميرا</span>
              </button>
            </div>
            <div className="flex gap-1.5">
              <input
                required
                value={manualSubCode}
                onChange={(e) => setManualSubCode(e.target.value)}
                placeholder="كود الاشتراك: SUB-XXXX-XX"
                className="flex-1 min-w-0 rounded-xl bg-white/10 text-white placeholder:text-white/60 px-3 py-2 text-xs font-mono border border-white/20 outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-white text-[#0F4C5C] text-xs font-black shrink-0 cursor-pointer"
              >
                خصم حصة ✓
              </button>
            </div>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const { hostLink, pricingSnapshot, calc } = enrollPricingPreview;
              const res = enrollSwimmerByMemberCode({
                memberCode:
                  memberCode.trim() || `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`,
                athleteNameAr:
                  athleteNameInput.trim() || matched?.fullNameAr || "سباح متدرب",
                facilityId: facId,
                coachId: activeCoach?.id || currentPersona.id,
                packageTitleAr: pkgTitle.trim() || `باقة ${sessionsCount} حصص`,
                totalSessions: sessionsCount,
                amountEgp: calc.netTotalEgp,
                linkedEntityId: hostLink?.id,
                linkedEntityNameAr: hostLink?.displayNameAr,
                agreementTypeAtEnroll: hostLink?.agreementType,
                pricingSnapshot,
              });
              setFeedback({ ok: res.ok, msg: res.messageAr });
              if (res.ok) {
                setMemberCode("");
                setAthleteNameInput("");
                setPkgTitle("");
              }
            }}
            className="bg-white rounded-3xl p-4 shadow-soft-luxury border border-sand-border flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-black text-sm text-[#0F4C5C]">
                إضافة مشترك وتوليد كود اشتراك (SUB-XXXX)
              </h2>
              <button
                type="button"
                disabled={syncingCloud}
                onClick={async () => {
                  setSyncingCloud(true);
                  await syncLedgersFromServer();
                  setSyncingCloud(false);
                }}
                className="w-8 h-8 rounded-full bg-[#F7F9FA] border border-sand-border flex items-center justify-center text-[#0F4C5C] cursor-pointer"
              >
                <Icon name="sync" size={15} className={syncingCloud ? "animate-spin" : ""} />
              </button>
            </div>
            <input
              required={!matched}
              value={athleteNameInput}
              onChange={(e) => setAthleteNameInput(e.target.value)}
              placeholder={matched?.fullNameAr || "اسم السباح المتدرب *"}
              className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-sand-border"
            />
            <input
              value={memberCode}
              onChange={(e) => setMemberCode(e.target.value)}
              placeholder="كود السباح أو الابن (اختياري CAP-M-XXXX)"
              className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 font-mono text-xs outline-none border border-sand-border"
            />
            <select
              value={facId}
              onChange={(e) => setFacId(e.target.value)}
              className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-sand-border"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nameAr}
                </option>
              ))}
            </select>
            <input
              value={pkgTitle}
              onChange={(e) => setPkgTitle(e.target.value)}
              placeholder="اسم الباقة (مثلاً: باقة تأسيس 8 حصص)"
              className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-sand-border"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={sessionsCount}
                onChange={(e) => setSessionsCount(Number(e.target.value) as 8 | 12 | 24)}
                className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-sand-border"
              >
                <option value={8}>8 حصص</option>
                <option value={12}>12 حصة</option>
                <option value={24}>24 حصة</option>
              </select>
              <input
                type="number"
                min={0}
                value={feeEgp}
                onChange={(e) => setFeeEgp(e.target.value)}
                placeholder="مقابل التدريب ج.م"
                className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-sand-border"
              />
            </div>

            <div className="rounded-xl bg-[#EAF4F8] px-3 py-2 text-[11px] font-bold text-[#0F4C5C] flex items-center justify-between">
              <span>مية + تدريب:</span>
              <span className="tabular-nums font-black">
                {enrollPricingPreview.calc.waterTotalEgp} + {enrollPricingPreview.calc.trainingFeeEgp} ={" "}
                {enrollPricingPreview.calc.netTotalEgp} ج.م
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full bg-[#0F4C5C] text-white text-xs font-black hover:bg-[#1D6E7D] cursor-pointer"
            >
              تفعيل وإصدار كود الاشتراك والـ QR ✓
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: Bilateral Host Club Links & QR Permissions */}
      {mobileTab === "hosts" && (
        <CoachHostLinksPanel
          compact
          facilities={facilities}
          facilityLinks={facilityLinks}
          coachId={linkedCoachId}
          coachMemberCode={activeCoach?.SingleCoachId}
          coachNameAr={coachDisplayName}
          onRequestHostLink={requestCoachHostClubLink}
          onFeedback={setFeedback}
        />
      )}

      {/* TAB 3: Active Roster & PB Evaluation */}
      {mobileTab === "roster" && (
        <div className="flex flex-col gap-4">
          <section className="bg-white rounded-3xl p-4 shadow-soft-luxury border border-sand-border flex flex-col gap-3">
            <h3 className="font-black text-sm text-[#0F4C5C]">
              قائمة المتدربين وأكواد اشتراكاتهم ({visibleLedgers.length})
            </h3>

            {myApprovedLinks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setRosterGroupFilter("all")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                    rosterGroupFilter === "all" ? "bg-[#0F4C5C] text-white" : "bg-[#F7F9FA] text-ink-slate"
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setRosterGroupFilter("private")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                    rosterGroupFilter === "private" ? "bg-[#0F4C5C] text-white" : "bg-[#F7F9FA] text-ink-slate"
                  }`}
                >
                  خاص
                </button>
                {myApprovedLinks.map((lnk) => (
                  <button
                    key={lnk.id}
                    type="button"
                    onClick={() => setRosterGroupFilter(lnk.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                      rosterGroupFilter === lnk.id
                        ? "bg-[#0F4C5C] text-white"
                        : "bg-[#F7F9FA] text-ink-slate"
                    }`}
                  >
                    {lnk.facilityNameAr || lnk.displayNameAr}
                  </button>
                ))}
              </div>
            )}

            {visibleLedgers.length === 0 ? (
              <p className="text-xs text-ink-muted text-center py-3">
                لا توجد دفاتر مسجلة بعد — امسح كود عضوية السبّاح لتفعيل أول باقة.
              </p>
            ) : (
              visibleLedgers.map((l) => {
                const isExpired = Boolean(
                  l.isCodeExpired || l.status === "completed" || l.completedSessions >= l.totalSessions
                );
                const perm = getLedgerScanPermission(l);
                const lastCheckin = l.checkins[l.checkins.length - 1];
                return (
                  <div
                    key={l.id}
                    className="rounded-2xl bg-[#F7F9FA] border border-sand-border p-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/dashboard/ledger?id=${l.id}`}
                          className="font-bold text-xs text-[#0F4C5C] truncate"
                        >
                          {l.athleteNameAr}
                        </Link>
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-black border ${
                            isExpired
                              ? "bg-rose-50 text-rose-700 border-rose-200 line-through"
                              : "bg-[#EAF4F8] text-[#0F4C5C] border-[#1D6E7D]/25"
                          }`}
                        >
                          {l.subscriptionCode || l.ledgerCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-muted truncate mt-0.5">
                        {l.facilityNameAr} • {l.completedSessions} من {l.totalSessions} حصص
                        {lastCheckin ? ` • ${lastCheckin.dateAr}` : ""}
                      </div>
                    </div>
                    {!isExpired ? (
                      perm.canScan ? (
                        <button
                          type="button"
                          onClick={() => {
                            const res = checkInSession(
                              l.id,
                              l.pinCode,
                              "qr_scan",
                              "تأكيد حضور من موبايل الكابتن",
                              { scanSource: "coach_poolside" }
                            );
                            setFeedback({ ok: res.ok, msg: res.messageAr });
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#0F4C5C] text-white text-[11px] font-bold shrink-0 cursor-pointer"
                        >
                          خصم حصة ✓
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold shrink-0">
                          عبر البوابة
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
                          setFeedback({ ok: res.ok, msg: res.messageAr });
                        }}
                        className="px-3 py-1.5 rounded-full bg-[#1D6E7D] text-white text-[11px] font-bold shrink-0 cursor-pointer"
                      >
                        تجديد ↻
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </section>

          {/* Record PB & 5 Skills */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const chosenSwimmer = coachSwimmers.find((s) => s.id === pbSelectedAthleteId);
              const swimmerName = chosenSwimmer?.nameAr || pbSwimmerName.trim() || "سبّاح متدرب";
              const targetAthleteId = chosenSwimmer?.id || `athlete-${Date.now()}`;
              recordCoachSkillAndPB({
                athleteId: targetAthleteId,
                swimmerNameAr: swimmerName,
                eventTitleAr: pbEventTitle.trim() || "سباق حر",
                currentValue: Number(pbTimeSeconds) || 0,
                unitAr: pbUnitAr,
                coachNameAr: coachDisplayName,
                facilityNameAr:
                  facilities.find((f) => f.id === facId)?.nameAr || currentPersona.city,
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
              setFeedback({
                ok: true,
                msg: `تم تسجيل الرقم القياسي (${pbTimeSeconds} ${pbUnitAr}) للسباح «${swimmerName}» بنجاح!`,
              });
              setPbSwimmerName("");
              setPbEventTitle("");
              setPbTimeSeconds("");
              setPbFeedbackNote("");
            }}
            className="bg-white rounded-3xl p-4 shadow-soft-luxury border border-sand-border flex flex-col gap-2.5"
          >
            <h3 className="font-black text-sm text-[#0F4C5C]">تسجيل رقم قياسي وتقييم مهاري</h3>
            {coachSwimmers.length > 0 && (
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
            )}
            <div className="grid grid-cols-2 gap-2">
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
                placeholder="السباق (50م حرة)"
                className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-sand-border"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  required
                  type="number"
                  step="0.1"
                  value={pbTimeSeconds}
                  onChange={(e) => setPbTimeSeconds(e.target.value)}
                  placeholder="القيمة (31.8)"
                  className="rounded-xl bg-[#F7F9FA] px-2.5 py-2 text-xs outline-none border border-sand-border"
                />
                <select
                  value={pbUnitAr}
                  onChange={(e) => setPbUnitAr(e.target.value)}
                  className="rounded-xl bg-[#F7F9FA] px-2 py-2 text-xs font-bold outline-none border border-sand-border"
                >
                  <option value="ثانية">ثانية</option>
                  <option value="متر">متر</option>
                  <option value="لفة">لفة</option>
                  <option value="تكرار">تكرار</option>
                  <option value="نقطة">نقطة</option>
                </select>
              </div>
              <select
                value={pbRatingOverall}
                onChange={(e) => {
                  const v = Number(e.target.value) || 4;
                  setPbRatingOverall(e.target.value);
                  setPbSkills([v, v, v, v, v]);
                }}
                className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-sand-border"
              >
                <option value="5">5 / 5 ممتاز</option>
                <option value="4">4 / 5 متقدم</option>
                <option value="3">3 / 5 جيد</option>
              </select>
            </div>
            <div className="grid grid-cols-5 gap-1">
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
              placeholder="ملاحظة الكابتن للسباح (اختياري)"
              className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-sand-border"
            />
            <button
              type="submit"
              className="py-2.5 rounded-full bg-[#0F4C5C] text-white text-xs font-black hover:bg-[#1D6E7D] cursor-pointer"
            >
              اعتماد التوقيت والتقييم ✓
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: Coach Schedule Offers, Bio & Articles */}
      {mobileTab === "profile" && (
        <div className="flex flex-col gap-4">
          <section className="bg-white rounded-3xl p-4 shadow-soft-luxury border border-sand-border flex flex-col gap-3">
            <DynamicScheduleCardsBuilder
              mode="coach"
              targetId={activeCoach?.id}
              coachOffers={activeCoach?.sessionOffers || []}
              onFeedback={setFeedback}
            />
          </section>

          <section className="bg-white rounded-3xl p-4 shadow-soft-luxury border border-sand-border flex flex-col gap-2.5">
            <h3 className="font-black text-sm text-[#0F4C5C]">النبذة والسيرة المهنية للكابتن</h3>
            <textarea
              rows={3}
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value)}
              placeholder="اكتب نبذتك المهنية وتخصصك وخبراتك في تدريب السباحة..."
              className="rounded-xl bg-[#F7F9FA] p-3 text-xs outline-none border border-sand-border"
            />
            <button
              type="button"
              onClick={() => {
                if (!bioDraft.trim()) {
                  setFeedback({ ok: false, msg: "يرجى كتابة النبذة المهنية أولاً." });
                  return;
                }
                if (activeCoach) {
                  const res = validateAndSaveCoachBio(activeCoach.id, bioDraft);
                  setFeedback({ ok: res.ok, msg: res.messageAr });
                } else {
                  updateCurrentPersonaProfile({ bioAr: bioDraft.trim() });
                  setFeedback({ ok: true, msg: "تم تحديث وحفظ النبذة في ملفك ✓" });
                }
              }}
              className="py-2.5 rounded-full bg-[#1D6E7D] text-white text-xs font-black cursor-pointer"
            >
              حفظ النبذة ✓
            </button>
          </section>

          <section className="bg-white rounded-3xl p-4 shadow-soft-luxury border border-sand-border">
            <AuthorArticlesManager
              authorType="coach"
              authorEntityId={activeCoach?.id}
              authorSlug={activeCoach?.slug}
              authorNameAr={coachDisplayName}
              authorRoleAr={activeCoach?.titleAr || currentPersona.personaTitleAr}
              onFeedback={setFeedback}
            />
          </section>
        </div>
      )}

      <QrCameraScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        scopeCoachId={linkedCoachId}
        onLedgerCheckedIn={(_ledgerId, messageAr) => {
          setFeedback({ ok: true, msg: messageAr });
        }}
        onMemberDetectedForEnroll={({ memberCode: detectedCode, athleteNameAr }) => {
          setMobileTab("ops");
          setMemberCode(detectedCode);
          if (athleteNameAr) setAthleteNameInput(athleteNameAr);
          setFeedback({
            ok: true,
            msg: `تم التقاط كود العضوية ${detectedCode}${
              athleteNameAr ? ` (${athleteNameAr})` : ""
            } — اضغط تفعيل لإصدار كود الاشتراك.`,
          });
        }}
      />
    </div>
  );
}
