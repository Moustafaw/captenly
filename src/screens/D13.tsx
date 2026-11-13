"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { AvatarUploader } from "@/components/editorial/AvatarUploader";

export default function Desktop13() {
  const {
    coaches,
    facilities,
    sessionLedgers,
    memberRegistry,
    enrollSwimmerByMemberCode,
    checkInSession,
    publishSchoolPackage,
    validateAndSaveCoachBio,
    verifiedLeads,
    currentPersona,
  } = useCaptenly();

  const activeCoach =
    coaches.find((c) => c.id === currentPersona.linkedCoachId) || coaches[0] || null;

  // Member Code enrollment
  const [memberCode, setMemberCode] = useState("CAP-M-5190");
  const [selectedFacId, setSelectedFacId] = useState(facilities[0]?.id || "");
  const [packageTitle, setPackageTitle] = useState("باقة التأسيس والمتابعة — 8 حصص");
  const [sessionsCount, setSessionsCount] = useState<8 | 12 | 24>(8);
  const [feeEgp, setFeeEgp] = useState("750");
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  // Publish School Card
  const [schoolPkgName, setSchoolPkgName] = useState("مدرسة الأطفال الصباحية (8 حصص)");
  const [schoolPkgPrice, setSchoolPkgPrice] = useState("700");

  // Bio Law 3/1985 check
  const [bioDraft, setBioDraft] = useState(
    activeCoach?.bioAr || "مدرب سباحة تأسيس وإنقاذ مائي معتمد، التزام كامل بتدريب اللياقة والمهارات المائية."
  );

  const matchedMember = useMemo(
    () => memberRegistry.find((m) => m.memberCode.toUpperCase() === memberCode.trim().toUpperCase()),
    [memberRegistry, memberCode]
  );

  const handleEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    const res = enrollSwimmerByMemberCode({
      memberCode,
      athleteNameAr: matchedMember?.fullNameAr,
      facilityId: selectedFacId,
      coachId: activeCoach?.id,
      packageTitleAr: packageTitle,
      totalSessions: sessionsCount,
      amountEgp: Number(feeEgp) || 750,
    });
    setStatusMsg({ ok: res.ok, msg: res.messageAr });
  };

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        {/* Coach Verification Notice if 0 self-registered verified coaches yet */}
        {!activeCoach ? (
          <section className="rounded-[20px] bg-dark-slate text-surface-card p-6 md:p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="px-3 py-1 rounded-full bg-deep-carbon text-electric-volt text-xs font-bold w-fit">
                بوابة الكابتن وتفعيل السباحين
              </span>
              <h1 className="font-hero-headline text-[24px] md:text-[30px]">
                لوحة تحكم الكابتن: اربط السباحين بكود العضوية وأصدر الشارات الخضراء
              </h1>
              <p className="text-xs text-surface-container-high max-w-2xl">
                لا يتم إظهار ملفك العام للجمهور إلا بعد استكمال خطوة توثيق الشهادات ورقم الهاتف. يمكنك الآن تجربة أدوات الكابتن أو إتمام توثيق ملفك في 3 دقائق.
              </p>
            </div>
            <Link
              href="/claim?mode=coach"
              className="px-6 py-3 rounded-full bg-electric-volt text-dark-slate font-card-title-sm text-xs shrink-0 text-center"
            >
              وثّق حسابك ككابتن الآن ✓
            </Link>
          </section>
        ) : (
          <section className="rounded-[20px] bg-dark-slate text-surface-card p-6 md:p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 rounded-2xl p-2">
                <AvatarUploader size="lg" darkSurface initialUrl={activeCoach.avatarUrl} labelAr="تحديث الصورة" />
              </div>
              <div>
                <span className="px-3 py-1 rounded-full bg-lime-tint text-deep-olive text-xs font-bold">
                  ✓ كابتن موثق ({activeCoach.SingleCoachId})
                </span>
                <h1 className="text-[22px] md:text-[25px] font-extrabold leading-snug text-surface-card mt-2">
                  أهلاً كابتن {activeCoach.fullNameAr}
                </h1>
                <p className="text-xs text-surface-container-high mt-1">
                  الشارات النشطة: {activeCoach.badges.length} • عمولة المنصة: 0%
                </p>
              </div>
            </div>
            <Link
              href={`/c/${activeCoach.slug}`}
              className="px-5 py-2.5 rounded-full bg-electric-volt text-dark-slate font-card-title-sm text-xs"
            >
              عرض ملفي العام بالشارات
            </Link>
          </section>
        )}

        {statusMsg && (
          <div
            className={`rounded-2xl p-4 flex items-center justify-between border ${
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

        {/* Main Operations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          {/* 1. Enroll Swimmer by Member Code */}
          <form
            onSubmit={handleEnroll}
            className="lg:col-span-7 bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-section-title text-dark-slate">
                  إضافة وتفعيل باقة سباح بكود العضوية (CAP-M-XXXX)
                </h2>
                <p className="font-body-compact text-text-muted mt-0.5">
                  أدخل كود العضوية الذي استلمته من السباح مع عدد الحصص والمبلغ، وسيتم تفعيل الـ QR ودفتر الحصص أوفلاين عنده فوراً.
                </p>
              </div>
              <span className="text-deep-olive text-[11px] font-extrabold shrink-0">
                QR فوري
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">كود عضوية السباح *</label>
                <input
                  required
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                  placeholder="CAP-M-5190"
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 font-mono text-sm outline-none border border-surface-container"
                />
                {matchedMember && (
                  <span className="text-[11px] font-bold text-deep-olive">
                    ✓ السباح: {matchedMember.fullNameAr} ({matchedMember.city})
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">مكان التدريب (النادي / المسبح)</label>
                <select
                  value={selectedFacId}
                  onChange={(e) => setSelectedFacId(e.target.value)}
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm outline-none border border-surface-container"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">اسم الباقة</label>
                <input
                  value={packageTitle}
                  onChange={(e) => setPackageTitle(e.target.value)}
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm outline-none border border-surface-container"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">الحصص</label>
                  <select
                    value={sessionsCount}
                    onChange={(e) => setSessionsCount(Number(e.target.value) as 8 | 12 | 24)}
                    className="rounded-xl bg-surface-snow px-3 py-2.5 text-sm outline-none border border-surface-container"
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
                    className="rounded-xl bg-surface-snow px-3 py-2.5 text-sm outline-none border border-surface-container"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm hover:opacity-95 shadow-sm"
            >
              حفظ وتفعيل الـ QR ودفتر الحصص للسباح فوراً ✓
            </button>
          </form>

          {/* 2. Publish School Card & Law 3 Bio */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const res = publishSchoolPackage({
                  facilityId: selectedFacId,
                  nameAr: schoolPkgName,
                  sessionsCount: 8,
                  sessionsPerWeek: 2,
                  durationMinutes: 60,
                  baseMonthlyEgp: Number(schoolPkgPrice) || 700,
                });
                setStatusMsg({ ok: res.ok, msg: res.messageAr });
              }}
              className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-3"
            >
              <h2 className="font-card-title text-dark-slate">نشر كارت مدرسة سباحة جديدة</h2>
              <input
                value={schoolPkgName}
                onChange={(e) => setSchoolPkgName(e.target.value)}
                className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm outline-none border border-surface-container"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={schoolPkgPrice}
                  onChange={(e) => setSchoolPkgPrice(e.target.value)}
                  className="w-32 rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm outline-none border border-surface-container"
                />
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-deep-olive text-white font-badge-label text-xs"
                >
                  نشر الباقة في المنصة
                </button>
              </div>
            </form>

            <div className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-2.5">
              <h3 className="font-card-title-sm text-dark-slate">فحص السيرة المهنية (قانون 3/1985)</h3>
              <textarea
                rows={2}
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                className="rounded-xl bg-surface-snow p-3 text-xs outline-none border border-surface-container"
              />
              <button
                type="button"
                onClick={() => {
                  if (activeCoach) {
                    const res = validateAndSaveCoachBio(activeCoach.id, bioDraft);
                    setStatusMsg({ ok: res.ok, msg: res.messageAr });
                  } else {
                    setStatusMsg({
                      ok: !bioDraft.includes("علاج طبيعي"),
                      msg: bioDraft.includes("علاج طبيعي")
                        ? "مخالف للقانون 3/1985: مصطلح علاج طبيعي محظور لغير الأطباء."
                        : "النص المهني سليم ومتوافق مع المعايير ✓",
                    });
                  }
                }}
                className="py-2 rounded-full bg-surface-snow hover:bg-lime-tint text-dark-slate font-bold text-xs"
              >
                فحص وحفظ النبذة
              </button>
            </div>
          </div>
        </div>

        {/* Active Coach Check-in Ledgers */}
        <section className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-section-title text-dark-slate">
              متدربو الكابتن النشطون ({sessionLedgers.length}) • استفسارات الواتساب ({verifiedLeads.length})
            </h2>
            <Link href="/dashboard/ledger" className="text-xs font-bold text-deep-olive hover:underline">
              فتح ماسح الـ QR والأوفلاين ←
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessionLedgers.map((l) => (
              <div
                key={l.id}
                className="rounded-2xl bg-surface-snow p-4 flex items-center justify-between gap-2 border border-surface-container/60"
              >
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/ledger?id=${l.id}`}
                    className="font-card-title-sm text-dark-slate hover:text-deep-olive truncate block"
                  >
                    {l.athleteNameAr}
                  </Link>
                  <div className="text-[11px] text-text-muted truncate">
                    {l.facilityNameAr} • {l.completedSessions}/{l.totalSessions} حصص
                  </div>
                  <Link
                    href={`/dashboard/ledger?id=${l.id}`}
                    className="text-[11px] font-bold text-deep-olive hover:underline mt-0.5 inline-block"
                  >
                    فتح الدفتر والـ QR ←
                  </Link>
                </div>
                <button
                  type="button"
                  disabled={l.completedSessions >= l.totalSessions}
                  onClick={() => {
                    const res = checkInSession(l.id, l.pinCode, "qr_scan", "حضور مسجل بواسطة الكابتن");
                    setStatusMsg({ ok: res.ok, msg: res.messageAr });
                  }}
                  className="px-3.5 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold disabled:opacity-40 shrink-0"
                >
                  خصم حصة ✓
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
