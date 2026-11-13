"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { AvatarUploader } from "@/components/editorial/AvatarUploader";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { DynamicScheduleCardsBuilder } from "@/components/editorial/DynamicScheduleCardsBuilder";

export default function Phone12() {
  const {
    coaches,
    facilities,
    sessionLedgers,
    memberRegistry,
    enrollSwimmerByMemberCode,
    checkInSession,
    publishSchoolPackage,
    currentPersona,
    isAuthenticated,
  } = useCaptenly();

  const activeCoach =
    coaches.find((c) => c.id === currentPersona.linkedCoachId) || coaches[0] || null;

  const [memberCode, setMemberCode] = useState("");
  const [facId, setFacId] = useState(facilities[0]?.id || "");
  const [sessionsCount, setSessionsCount] = useState<8 | 12 | 24>(8);
  const [feeEgp, setFeeEgp] = useState("");
  const [pkgTitle, setPkgTitle] = useState("باقة التأسيس والمتابعة — 8 حصص");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [schoolName, setSchoolName] = useState("");
  const [schoolPrice, setSchoolPrice] = useState("");

  const matched = useMemo(
    () => memberRegistry.find((m) => m.memberCode.toUpperCase() === memberCode.trim().toUpperCase()),
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
          <div className="flex items-center gap-3.5">
            <div className="bg-white/10 rounded-2xl p-2 shrink-0">
              <AvatarUploader size="md" darkSurface initialUrl={activeCoach.avatarUrl} labelAr="تحديث" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-lime-tint text-deep-olive text-[10px] font-bold">
                ✓ كابتن موثق ({activeCoach.SingleCoachId})
              </span>
              <h1 className="font-card-title text-lg mt-1">{activeCoach.fullNameAr}</h1>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-deep-carbon text-electric-volt text-[11px] font-bold w-fit">
              بوابة الكابتن وتفعيل السباحين
            </span>
            <h1 className="font-card-title text-lg">لوحة الكابتن: تفعيل الـ QR بكود العضوية</h1>
            <Link
              href="/claim?mode=coach"
              className="px-4 py-2 rounded-full bg-electric-volt text-dark-slate text-xs font-bold w-fit"
            >
              وثّق حسابك ككابتن الآن ✓
            </Link>
          </div>
        )}
      </section>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-bold ${
            feedback.ok ? "bg-lime-tint text-deep-olive" : "bg-red-50 text-red-900"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Enroll Swimmer by Member Code */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const res = enrollSwimmerByMemberCode({
            memberCode,
            athleteNameAr: matched?.fullNameAr,
            facilityId: facId,
            coachId: activeCoach?.id,
            packageTitleAr: pkgTitle,
            totalSessions: sessionsCount,
            amountEgp: Number(feeEgp) || 0,
          });
          setFeedback({ ok: res.ok, msg: res.messageAr });
        }}
        className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-3"
      >
        <h2 className="font-card-title-sm text-dark-slate">تفعيل باقة سباح بكود العضوية</h2>
        <input
          required
          value={memberCode}
          onChange={(e) => setMemberCode(e.target.value)}
          placeholder="كود العضوية (CAP-M-XXXX)"
          className="rounded-xl bg-surface-snow px-3.5 py-2.5 font-mono text-xs outline-none border border-surface-container"
        />
        {matched && (
          <span className="text-[11px] font-bold text-deep-olive">
            ✓ العضو: {matched.fullNameAr} ({matched.city})
          </span>
        )}
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
          حفظ وتفعيل الـ QR للسباح ✓
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

      {/* Quick Publish Package */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const res = publishSchoolPackage({
            facilityId: facId,
            nameAr: schoolName,
            sessionsCount: 8,
            sessionsPerWeek: 2,
            durationMinutes: 60,
            baseMonthlyEgp: Number(schoolPrice) || 0,
          });
          setFeedback({ ok: res.ok, msg: res.messageAr });
        }}
        className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2.5"
      >
        <h3 className="font-card-title-sm text-sm text-dark-slate">نشر كارت مدرسة جديدة</h3>
        <input
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          className="rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={schoolPrice}
            onChange={(e) => setSchoolPrice(e.target.value)}
            className="w-24 rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
          />
          <button type="submit" className="flex-1 py-2 rounded-full bg-deep-olive text-white text-xs font-bold">
            نشر الباقة
          </button>
        </div>
      </form>

      {/* Active Ledgers */}
      <section className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2.5">
        <h3 className="font-card-title-sm text-sm text-dark-slate">
          دفاتر المتدربين النشطة ({sessionLedgers.length})
        </h3>
        {sessionLedgers.map((l) => (
          <div key={l.id} className="rounded-xl bg-surface-snow p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/dashboard/ledger?id=${l.id}`}
                className="font-bold text-xs text-dark-slate hover:text-deep-olive truncate block"
              >
                {l.athleteNameAr}
              </Link>
              <div className="text-[11px] text-text-muted truncate">
                {l.facilityNameAr} • {l.completedSessions}/{l.totalSessions} حصص
              </div>
            </div>
            <button
              type="button"
              disabled={l.completedSessions >= l.totalSessions}
              onClick={() => {
                const res = checkInSession(l.id, l.pinCode, "qr_scan", "تأكيد حضور من موبايل الكابتن");
                setFeedback({ ok: res.ok, msg: res.messageAr });
              }}
              className="px-3 py-1.5 rounded-full bg-dark-slate text-electric-volt text-[11px] font-bold disabled:opacity-40 shrink-0"
            >
              خصم حصة ✓
            </button>
          </div>
        ))}
      </section>

      {/* Swimming Academy / School CTA — Coach Only */}
      <section className="rounded-2xl bg-dark-slate text-surface-card p-5 shadow-md flex flex-col gap-3">
        <div className="inline-flex items-center gap-1.5 text-electric-volt text-[11px] font-bold">
          <Icon name="pool" className="text-[15px]" />
          <span>لأصحاب أكاديميات السباحة والمدربين</span>
        </div>
        <h3 className="font-card-title-sm text-sm text-surface-card">
          هل تدير أكاديمية سباحة أو مدرسة مائية؟
        </h3>
        <p className="text-[11px] text-surface-container-high leading-relaxed">
          أنشئ صفحة منشأتك لنشر باقات السباحة واستلام اشتراكات أولياء الأمور مباشرة عبر واتساب.
        </p>
        <Link
          href="/dashboard/facility"
          className="px-4 py-2 rounded-full bg-electric-volt text-dark-slate font-bold text-xs text-center w-fit"
        >
          لوحة إدارة الأكاديمية ←
        </Link>
      </section>
    </div>
  );
}
