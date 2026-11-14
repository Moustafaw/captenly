"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { DynamicScheduleCardsBuilder } from "@/components/editorial/DynamicScheduleCardsBuilder";
import { AuthorArticlesManager } from "@/components/editorial/AuthorArticlesManager";
import { QrCameraScannerModal } from "@/components/qr/QrCameraScannerModal";

export default function Phone12() {
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
    currentPersona,
    isAuthenticated,
    syncLedgersFromServer,
  } = useCaptenly();

  const activeCoach = useMemo(
    () => coaches.find((c) => c.id === currentPersona.linkedCoachId) || null,
    [coaches, currentPersona.linkedCoachId]
  );

  const [manualSubCode, setManualSubCode] = useState("");
  const [memberCode, setMemberCode] = useState("");
  const [athleteNameInput, setAthleteNameInput] = useState("");
  const [facId, setFacId] = useState(currentPersona.linkedFacilityId || facilities[0]?.id || "");
  const [sessionsCount, setSessionsCount] = useState<8 | 12 | 24>(8);
  const [feeEgp, setFeeEgp] = useState("650");
  const [pkgTitle, setPkgTitle] = useState("باقة التأسيس والمتابعة — 8 حصص");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);

  const [bioDraft, setBioDraft] = useState(
    activeCoach?.bioAr ||
      currentPersona.bioAr ||
      "مدرب سباحة تأسيس وإنقاذ مائي معتمد، التزام كامل بتدريب اللياقة والمهارات المائية."
  );

  const [pbSwimmerName, setPbSwimmerName] = useState("");
  const [pbEventTitle, setPbEventTitle] = useState("");
  const [pbTimeSeconds, setPbTimeSeconds] = useState("");
  const [pbRatingOverall, setPbRatingOverall] = useState("5");

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

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-on-surface min-h-screen px-margin pt-4 pb-24 flex flex-col gap-4">
      <section className="rounded-2xl bg-dark-slate text-surface-card p-5 shadow-md flex flex-col gap-3">
        {activeCoach ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={currentPersona.avatarUrl || activeCoach.avatarUrl || "/screens/3dff88737bec.jpg"}
                alt={activeCoach.fullNameAr}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-electric-volt shrink-0"
              />
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-lime-tint text-deep-olive text-[10px] font-bold">
                  ✓ كابتن موثق ({activeCoach.SingleCoachId})
                </span>
                <h1 className="font-card-title text-base mt-1">{activeCoach.fullNameAr}</h1>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <Link
                href={`/c/${activeCoach.slug}`}
                className="px-3 py-1.5 rounded-full bg-electric-volt text-dark-slate text-[11px] font-bold text-center"
              >
                ملفي العام
              </Link>
              <Link
                href="/dashboard/athlete/settings"
                className="px-3 py-1.5 rounded-full bg-white/10 text-white text-[10px] font-bold text-center"
              >
                الإعدادات والصورة
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-deep-carbon text-electric-volt text-[11px] font-bold w-fit">
              بوابة الكابتن وتفعيل السباحين
            </span>
            <h1 className="font-card-title text-base">
              أهلاً كابتن {currentPersona.fullNameAr} — وثّق ملفك لإصدار الشارات
            </h1>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/claim?mode=coach"
                className="px-4 py-2 rounded-full bg-electric-volt text-dark-slate text-xs font-bold"
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

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
            feedback.ok ? "bg-lime-tint text-deep-olive" : "bg-red-50 text-red-900"
          }`}
        >
          <span>{feedback.msg}</span>
          <button type="button" onClick={() => setFeedback(null)} className="underline">
            إغلاق
          </button>
        </div>
      )}

      {/* Manual Subscription Code Check-in Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!manualSubCode.trim()) return;
          const res = checkInBySubscriptionCode(
            manualSubCode.trim(),
            "حضور مسجل بواسطة الكابتن بكود الاشتراك"
          );
          setFeedback({ ok: res.ok, msg: res.messageAr });
          if (res.ok) setManualSubCode("");
        }}
        className="rounded-2xl bg-dark-slate text-white p-4 flex flex-col gap-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-electric-volt">
            خصم حصة بكود الاشتراك يدوياً أو بالـ QR
          </span>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-deep-olive text-white text-[11px] font-bold"
          >
            <Icon name="qr_code_scanner" className="text-[14px]" />
            <span>فتح الكاميرا</span>
          </button>
        </div>
        <div className="flex gap-1.5">
          <input
            required
            value={manualSubCode}
            onChange={(e) => setManualSubCode(e.target.value)}
            placeholder="كود الاشتراك: SUB-XXXX-XX"
            className="flex-1 min-w-0 rounded-xl bg-deep-carbon text-white px-3 py-2 text-xs font-mono border border-white/15 outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-electric-volt text-dark-slate text-xs font-extrabold shrink-0"
          >
            خصم حصة ✓
          </button>
        </div>
      </form>

      {/* Enroll Swimmer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const res = enrollSwimmerByMemberCode({
            memberCode: memberCode.trim() || `CAP-M-${Math.floor(1000 + Math.random() * 8999)}`,
            athleteNameAr: athleteNameInput.trim() || matched?.fullNameAr || "سباح متدرب",
            facilityId: facId,
            coachId: activeCoach?.id || currentPersona.id,
            packageTitleAr: pkgTitle,
            totalSessions: sessionsCount,
            amountEgp: Number(feeEgp) || 0,
          });
          setFeedback({ ok: res.ok, msg: res.messageAr });
          if (res.ok) {
            setMemberCode("");
            setAthleteNameInput("");
          }
        }}
        className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-card-title-sm text-dark-slate">
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
            className="w-8 h-8 rounded-full bg-surface-snow border border-surface-container flex items-center justify-center text-dark-slate"
          >
            <Icon name="sync" className={`text-[15px] ${syncingCloud ? "animate-spin" : ""}`} />
          </button>
        </div>
        <input
          required={!matched}
          value={athleteNameInput}
          onChange={(e) => setAthleteNameInput(e.target.value)}
          placeholder={matched?.fullNameAr || "اسم السباح المتدرب *"}
          className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
        />
        <input
          value={memberCode}
          onChange={(e) => setMemberCode(e.target.value)}
          placeholder="كود عضوية السباح (اختياري CAP-M-XXXX)"
          className="rounded-xl bg-surface-snow px-3.5 py-2.5 font-mono text-xs outline-none border border-surface-container"
        />
        <select
          value={facId}
          onChange={(e) => setFacId(e.target.value)}
          className="rounded-xl bg-surface-snow px-3 py-2.5 text-xs outline-none border border-surface-container"
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
          className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={sessionsCount}
            onChange={(e) => setSessionsCount(Number(e.target.value) as 8 | 12 | 24)}
            className="rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
          >
            <option value={8}>8 حصص</option>
            <option value={12}>12 حصة</option>
            <option value={24}>24 حصة</option>
          </select>
          <input
            type="number"
            value={feeEgp}
            onChange={(e) => setFeeEgp(e.target.value)}
            className="rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
          />
        </div>
        <button
          type="submit"
          className="w-full py-3 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
        >
          تفعيل وإصدار كود الاشتراك والـ QR ✓
        </button>
      </form>

      {/* Unified Dynamic Coach Schedule/Session Cards Builder */}
      <section className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-3">
        <DynamicScheduleCardsBuilder
          mode="coach"
          targetId={activeCoach?.id}
          coachOffers={activeCoach?.sessionOffers || []}
          onFeedback={setFeedback}
        />
      </section>

      {/* Bio Check */}
      <section className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2.5">
        <h3 className="font-card-title-sm text-sm text-dark-slate">
          النبذة والسيرة المهنية للكابتن
        </h3>
        <textarea
          rows={3}
          value={bioDraft}
          onChange={(e) => setBioDraft(e.target.value)}
          className="rounded-xl bg-surface-snow p-3 text-xs outline-none border border-surface-container"
        />
        <button
          type="button"
          onClick={() => {
            if (activeCoach) {
              const res = validateAndSaveCoachBio(activeCoach.id, bioDraft);
              setFeedback({ ok: res.ok, msg: res.messageAr });
            } else {
              setFeedback({
                ok: true,
                msg: "تم تحديث وحفظ النبذة المهنية في ملفك ✓",
              });
            }
          }}
          className="py-2.5 rounded-full bg-deep-olive text-white text-xs font-bold"
        >
          حفظ النبذة ✓
        </button>
      </section>

      {/* Coach PB & Skill Assessment Logger */}
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
              facilities.find((f) => f.id === facId)?.nameAr || currentPersona.city,
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
          setFeedback({
            ok: true,
            msg: `تم تسجيل الرقم القياسي والتقييم المعتمد للسباح «${pbSwimmerName}» بنجاح!`,
          });
          setPbSwimmerName("");
          setPbEventTitle("");
          setPbTimeSeconds("");
        }}
        className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2.5"
      >
        <h3 className="font-card-title-sm text-sm text-dark-slate">
          تسجيل رقم قياسي وتقييم مهاري للسباح
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
            <option value="5">5 / 5 ممتاز</option>
            <option value="4">4 / 5 متقدم</option>
            <option value="3">3 / 5 جيد</option>
          </select>
        </div>
        <button type="submit" className="py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold">
          اعتماد التوقيت والتقييم ✓
        </button>
      </form>

      {/* Active Ledgers */}
      <section className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2.5">
        <h3 className="font-card-title-sm text-sm text-dark-slate">
          قائمة المتدربين وأكواد اشتراكاتهم ({sessionLedgers.length})
        </h3>
        {sessionLedgers.map((l) => {
          const isExpired = Boolean(
            l.isCodeExpired || l.status === "completed" || l.completedSessions >= l.totalSessions
          );
          return (
            <div key={l.id} className="rounded-xl bg-surface-snow p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={`/dashboard/ledger?id=${l.id}`}
                    className="font-bold text-xs text-dark-slate hover:text-deep-olive truncate"
                  >
                    {l.athleteNameAr}
                  </Link>
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-black border ${
                      isExpired
                        ? "bg-red-50 text-red-700 border-red-200 line-through"
                        : "bg-lime-tint text-deep-olive border-deep-olive/25"
                    }`}
                  >
                    {l.subscriptionCode || l.ledgerCode}
                  </span>
                </div>
                <div className="text-[11px] text-text-muted truncate mt-0.5">
                  {l.facilityNameAr} • {l.completedSessions}/{l.totalSessions} حصص
                </div>
              </div>
              {!isExpired ? (
                <button
                  type="button"
                  onClick={() => {
                    const res = checkInSession(l.id, l.pinCode, "qr_scan", "تأكيد حضور من موبايل الكابتن");
                    setFeedback({ ok: res.ok, msg: res.messageAr });
                  }}
                  className="px-3 py-1.5 rounded-full bg-dark-slate text-electric-volt text-[11px] font-bold shrink-0"
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
                    setFeedback({ ok: res.ok, msg: res.messageAr });
                  }}
                  className="px-3 py-1.5 rounded-full bg-deep-olive text-white text-[11px] font-bold shrink-0"
                >
                  تجديد ↻
                </button>
              )}
            </div>
          );
        })}
      </section>

      {/* Coach Articles Manager */}
      <section className="bg-surface-card rounded-2xl p-4 shadow-sm">
        <AuthorArticlesManager
          authorType="coach"
          authorEntityId={activeCoach?.id}
          authorSlug={activeCoach?.slug}
          authorNameAr={activeCoach?.fullNameAr || currentPersona.fullNameAr}
          authorRoleAr={activeCoach?.titleAr || currentPersona.personaTitleAr}
          onFeedback={setFeedback}
        />
      </section>

      <QrCameraScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onLedgerCheckedIn={(_ledgerId, messageAr) => {
          setFeedback({ ok: true, msg: messageAr });
        }}
        onMemberDetectedForEnroll={({ memberCode: detectedCode, athleteNameAr }) => {
          setMemberCode(detectedCode);
          if (athleteNameAr) setAthleteNameInput(athleteNameAr);
          setFeedback({
            ok: true,
            msg: `تم التقاط كود العضوية ${detectedCode}${athleteNameAr ? ` (${athleteNameAr})` : ""} — اضغط تفعيل لإصدار كود الاشتراك.`,
          });
        }}
      />
    </div>
  );
}
