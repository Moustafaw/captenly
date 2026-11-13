"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { DynamicScheduleCardsBuilder } from "@/components/editorial/DynamicScheduleCardsBuilder";
import { QrCameraScannerModal } from "@/components/qr/QrCameraScannerModal";

export default function FacilityDashboardPage() {
  const {
    facilities,
    sessionLedgers,
    verifiedLeads,
    memberRegistry,
    enrollSwimmerByMemberCode,
    checkInSession,
    publishSchoolPackage,
    confirmFacilityPrices60d,
    currentPersona,
    isAuthenticated,
    syncLedgersFromServer,
  } = useCaptenly();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);

  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(
    currentPersona.linkedFacilityId || facilities[0]?.id || ""
  );
  const facility = useMemo(
    () => facilities.find((f) => f.id === selectedFacilityId) || facilities[0],
    [facilities, selectedFacilityId]
  );

  // Member Code Enrollment Form
  const [memberCodeInput, setMemberCodeInput] = useState("");
  const [athleteNameInput, setAthleteNameInput] = useState("");
  const [pkgTitleInput, setPkgTitleInput] = useState(
    facility?.pricePackages[0]?.nameAr || ""
  );
  const [sessionsCount, setSessionsCount] = useState<8 | 12 | 24>(8);
  const [amountEgp, setAmountEgp] = useState<string>(
    facility?.pricePackages[0]?.baseMonthlyEgp ? String(facility.pricePackages[0].baseMonthlyEgp) : ""
  );

  // Publish Package Form
  const [newPkgName, setNewPkgName] = useState("");
  const [newPkgSessions, setNewPkgSessions] = useState("8");
  const [newPkgPrice, setNewPkgPrice] = useState("");

  // Feedback message
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const facilityLedgers = useMemo(
    () => (facility ? sessionLedgers.filter((l) => l.facilityId === facility.id) : []),
    [sessionLedgers, facility]
  );
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

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="لوحة إدارة المنشأة تتطلب تسجيل الدخول"
        descriptionAr="سجّل دخولك بحساب إدارة الأكاديمية أو المسبح لإدارة بطاقات المواعيد والأسعار وتفعيل دفاتر الحصص للمتدربين."
      />
    );
  }

  if (!facility) return null;

  const isUnclaimed = facility.supplyStatus === "seeded_unclaimed";

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = enrollSwimmerByMemberCode({
      memberCode: memberCodeInput,
      athleteNameAr: athleteNameInput || matchedMember?.fullNameAr,
      facilityId: facility.id,
      packageTitleAr: pkgTitleInput || "باقة سباحة",
      totalSessions: sessionsCount,
      amountEgp: Number(amountEgp) || 0,
    });
    setFeedback({ ok: res.ok, msg: res.messageAr });
  };

  const handlePublishPkg = (e: React.FormEvent) => {
    e.preventDefault();
    const res = publishSchoolPackage({
      facilityId: facility.id,
      nameAr: newPkgName.trim(),
      sessionsCount: Number(newPkgSessions) || 8,
      sessionsPerWeek: Number(newPkgSessions) >= 12 ? 3 : 2,
      durationMinutes: 60,
      baseMonthlyEgp: Number(newPkgPrice) || 0,
    });
    setFeedback({ ok: res.ok, msg: res.messageAr });
  };

  return (
    <div className="min-h-screen bg-canvas-alabaster pt-6 pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        {/* Header Bar */}
        <section className="rounded-[20px] bg-dark-slate text-surface-card p-6 md:p-8 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-bold ${
                  isUnclaimed ? "text-amber-300" : "text-electric-volt"
                }`}
              >
                {isUnclaimed ? "منشأة بانتظار التفعيل الرسمي" : "✓ صفحة منشأة موثقة"}
              </span>
              <span className="text-xs text-surface-variant">{facility.city} • {facility.district}</span>
            </div>
            <h1 className="font-hero-headline text-[26px] md:text-[32px]">
              لوحة تحكم المنشأة: {facility.nameAr}
            </h1>
            <p className="font-body-compact text-surface-container-high">
              ربط السباحين بكود العضوية، تفعيل دفاتر الحصص والـ QR أوفلاين، ونشر كروت الباقات المحدثة — بعمولة 0%.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <select
              value={facility.id}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              className="rounded-full bg-deep-carbon text-surface-card px-4 py-2.5 text-xs font-bold outline-none border border-white/10"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nameAr}
                </option>
              ))}
            </select>

            {isUnclaimed ? (
              <Link
                href={`/claim/${facility.slug}`}
                className="px-5 py-2.5 rounded-full bg-electric-volt text-dark-slate font-card-title-sm text-center hover:brightness-105 shadow"
              >
                وثّق إدارة المنشأة مجاناً
              </Link>
            ) : (
              <Link
                href={`/academy/${facility.slug}`}
                className="px-5 py-2.5 rounded-full bg-electric-volt text-dark-slate font-card-title-sm text-center"
              >
                معاينة الصفحة العامة
              </Link>
            )}
          </div>
        </section>

        {feedback && (
          <div
            className={`rounded-2xl p-4 flex items-center justify-between border ${
              feedback.ok
                ? "bg-lime-tint/70 border-deep-olive text-dark-slate"
                : "bg-red-50 border-red-300 text-red-900"
            }`}
          >
            <div className="flex items-center gap-2 font-card-title-sm">
              <Icon name={feedback.ok ? "check_circle" : "warning"} className="text-[20px]" />
              <span>{feedback.msg}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-bold underline"
            >
              إخفاء
            </button>
          </div>
        )}

        {/* Value Metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-card rounded-[16px] p-5 shadow-sm">
            <span className="text-xs text-text-muted">مشاهدات الصفحة (شهرياً)</span>
            <div className="text-3xl font-black text-dark-slate mt-1">
              {facility.monthlyMetrics.profileViews}
            </div>
          </div>
          <div className="bg-surface-card rounded-[16px] p-5 shadow-sm">
            <span className="text-xs text-text-muted">ظهور في جدول المقارنة</span>
            <div className="text-3xl font-black text-deep-olive mt-1">
              {facility.monthlyMetrics.comparisonAppearances}
            </div>
          </div>
          <div className="bg-surface-card rounded-[16px] p-5 shadow-sm">
            <span className="text-xs text-text-muted">استفسارات واتساب الموثقة</span>
            <div className="text-3xl font-black text-action-whatsapp mt-1">
              {facility.monthlyMetrics.verifiedWhatsappLeads}
            </div>
          </div>
          <div className="bg-surface-card rounded-[16px] p-5 shadow-sm">
            <span className="text-xs text-text-muted">دفاتر الحصص النشطة (QR)</span>
            <div className="text-3xl font-black text-dark-slate mt-1">
              {facilityLedgers.length || facility.monthlyMetrics.activeSessionLedgers}
            </div>
          </div>
        </section>

        {/* Core Operations Grid: Enroll Swimmer by Member Code + Publish Package */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          {/* 1. تفعيل باقة سباح بكود العضوية */}
          <form
            onSubmit={handleEnrollSubmit}
            className="lg:col-span-7 bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-section-title text-dark-slate">
                  تسجيل سباح بكود العضوية وتفعيل الـ QR فوراً
                </h2>
                <p className="font-body-compact text-text-muted mt-0.5">
                  امسح باركود السباح بالكاميرا أو أدخل كود عضويته (CAP-M-XXXX) لتفعيل دفتر الحصص والمزامنة سحابياً فوراً.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-deep-olive text-white text-xs font-bold hover:brightness-105 shadow-xs"
                >
                  <Icon name="qr_code_scanner" className="text-[16px]" />
                  <span>مسح QR بالكاميرا</span>
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
                <label className="text-xs font-bold text-dark-slate">كود عضوية المتدرب *</label>
                <input
                  required
                  value={memberCodeInput}
                  onChange={(e) => setMemberCodeInput(e.target.value)}
                  placeholder="CAP-M-XXXX"
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 font-mono text-sm text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                />
                {matchedMember && (
                  <span className="text-[11px] font-bold text-deep-olive">
                    ✓ تم العثور على العضو: {matchedMember.fullNameAr}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">اسم المتدرب (تلقائي أو مخصص)</label>
                <input
                  value={athleteNameInput}
                  onChange={(e) => setAthleteNameInput(e.target.value)}
                  placeholder={matchedMember?.fullNameAr || "يملأ تلقائياً من الكود"}
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">الباقة التدريبية</label>
                <input
                  value={pkgTitleInput}
                  onChange={(e) => setPkgTitleInput(e.target.value)}
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">عدد الحصص</label>
                  <select
                    value={sessionsCount}
                    onChange={(e) => setSessionsCount(Number(e.target.value) as 8 | 12 | 24)}
                    className="rounded-xl bg-surface-snow px-3 py-2.5 text-sm text-dark-slate outline-none border border-surface-container"
                  >
                    <option value={8}>8 حصص</option>
                    <option value={12}>12 حصة</option>
                    <option value={24}>24 حصة</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">المبلغ (ج.م)</label>
                  <input
                    type="number"
                    value={amountEgp}
                    onChange={(e) => setAmountEgp(e.target.value)}
                    className="rounded-xl bg-surface-snow px-3 py-2.5 text-sm text-dark-slate outline-none border border-surface-container"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm hover:opacity-95 shadow-sm"
            >
              حفظ وتفعيل باقة السباح وكود الـ QR الآن
            </button>
          </form>

          {/* 2. نشر كارت باقة جديد وتأكيد الأسعار */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <form
              onSubmit={handlePublishPkg}
              className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-3"
            >
              <h2 className="font-card-title text-dark-slate">نشر كارت مدرسة / باقة جديدة</h2>
              <input
                required
                value={newPkgName}
                onChange={(e) => setNewPkgName(e.target.value)}
                placeholder="اسم الباقة أو المدرسة"
                className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm text-dark-slate outline-none border border-surface-container"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={newPkgSessions}
                  onChange={(e) => setNewPkgSessions(e.target.value)}
                  placeholder="عدد الحصص"
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm text-dark-slate outline-none border border-surface-container"
                />
                <input
                  type="number"
                  value={newPkgPrice}
                  onChange={(e) => setNewPkgPrice(e.target.value)}
                  placeholder="السعر ج.م"
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm text-dark-slate outline-none border border-surface-container"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-full bg-deep-olive text-white font-badge-label hover:opacity-95"
              >
                نشر الباقة في نتائج البحث فوراً
              </button>
            </form>

            <div className="bg-surface-card rounded-[20px] p-6 shadow-sm flex items-center justify-between gap-3">
              <div>
                <div className="font-card-title-sm text-dark-slate">تأكيد تحديث الأسعار (دورة 60 يوم)</div>
                <div className="text-xs text-text-muted mt-0.5">
                  آخر تأكيد: {facility.priceLastVerifiedDate}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  confirmFacilityPrices60d(facility.id);
                  setFeedback({
                    ok: true,
                    msg: `تم تأكيد صحة أسعار «${facility.nameAr}» لمدة 60 يوماً قادماً.`,
                  });
                }}
                className="px-4 py-2 rounded-full bg-lime-tint text-deep-olive font-badge-label text-xs shrink-0 hover:brightness-95"
              >
                تأكيد الأسعار الآن ✓
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Unlimited Schedule & School Cards Manager */}
        <section className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
          <div>
            <h2 className="font-section-title text-dark-slate">
              إدارة بطاقات المواعيد والمدارس (عدد لا نهائي)
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              أنشئ أي عدد من البطاقات لكل فئة وتوقيت وساعة حصة ومدتها وسعرها ومزيد من التفاصيل — وتظهر مباشرة في العمود الجانبي لصفحة المنشأة.
            </p>
          </div>
          <DynamicScheduleCardsBuilder
            mode="facility"
            targetId={facility.id}
            facilityPrograms={facility.schoolPrograms || []}
            onFeedback={setFeedback}
          />
        </section>

        {/* Active Facility Ledgers */}
        <section className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-section-title text-dark-slate">
              دفاتر الحصص المفعّلة لهذه المنشأة ({facilityLedgers.length})
            </h2>
            <Link href="/dashboard/ledger" className="text-xs font-bold text-deep-olive hover:underline">
              فتح عارض الـ QR والأوفلاين ←
            </Link>
          </div>

          {facilityLedgers.length === 0 ? (
            <p className="font-body-compact text-text-muted py-4">
              لا توجد دفاتر مفعّلة بعد على هذه المنشأة. استخدم نموذج «تسجيل سباح بكود العضوية» أعلاه لتفعيل أول متدرب.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {facilityLedgers.map((l) => (
                <div
                  key={l.id}
                  className="rounded-2xl bg-surface-snow p-4 flex items-center justify-between gap-3 border border-surface-container/60"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/ledger?id=${l.id}`}
                      className="font-card-title-sm text-dark-slate hover:text-deep-olive truncate block"
                    >
                      {l.athleteNameAr}
                    </Link>
                    <div className="text-xs text-text-muted truncate">
                      {l.packageTitleAr} • PIN: <span className="font-mono font-bold">{l.pinCode}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-bold text-deep-olive">
                        الحصص المسجلة: {l.completedSessions} من {l.totalSessions}
                      </span>
                      <Link
                        href={`/dashboard/ledger?id=${l.id}`}
                        className="text-[11px] font-bold text-dark-slate hover:underline"
                      >
                        عرض الدفتر والـ QR ←
                      </Link>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={l.completedSessions >= l.totalSessions}
                    onClick={() => {
                      const res = checkInSession(l.id, l.pinCode, "qr_scan", "تأكيد حضور من لوحة المنشأة");
                      setFeedback({ ok: res.ok, msg: res.messageAr });
                    }}
                    className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt font-badge-label text-xs disabled:opacity-40 shrink-0"
                  >
                    تسجيل حصة ✓
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Leads */}
        {facilityLeads.length > 0 && (
          <section className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-3">
            <h2 className="font-section-title text-dark-slate">
              استفسارات واتساب المهيكلة ({facilityLeads.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {facilityLeads.map((lead) => (
                <div key={lead.id} className="rounded-xl bg-surface-snow p-4 flex justify-between items-center">
                  <div>
                    <div className="font-card-title-sm text-dark-slate">
                      {lead.inquirerNameAr} — <span className="font-mono text-deep-olive">{lead.referralCode}</span>
                    </div>
                    <div className="text-xs text-text-muted">
                      {lead.requestedSpecialtyAr} • العمر: {lead.athleteAge} • {lead.preferredScheduleAr}
                    </div>
                  </div>
                  <span className="text-[11px] text-text-muted">{lead.createdAtAr}</span>
                </div>
              ))}
            </div>
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
          setMemberCodeInput(detectedCode);
          if (athleteNameAr) setAthleteNameInput(athleteNameAr);
          setFeedback({
            ok: true,
            msg: `تم مسح كود العضوية ${detectedCode}${athleteNameAr ? ` (${athleteNameAr})` : ""} — اختر الباقة واضغط تفعيل لتشغيل الـ QR عند المتدرب فوراً.`,
          });
        }}
      />
    </div>
  );
}
