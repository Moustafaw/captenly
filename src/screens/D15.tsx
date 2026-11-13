"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { ProfileSocialPillsRow } from "@/components/editorial/AthleteProfileSocialEditor";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";

function calcImprovementPct(previousValue: number, currentValue: number): number | null {
  if (!previousValue || previousValue <= 0) return null;
  // In swimming timing (seconds), smaller is faster => improvement %
  const pct = ((previousValue - currentValue) / previousValue) * 100;
  return Number(pct.toFixed(1));
}

export default function Desktop15() {
  const {
    currentPersona,
    isAuthenticated,
    minorAthletes,
    addMinorAthlete,
    pbRecords,
    addNewPBRecord,
    skillEvaluation,
    sessionLedgers,
  } = useCaptenly();

  const [activeTab, setActiveTab] = useState<"analytics" | "ledgers" | "family">("analytics");

  // Child form
  const [childFormOpen, setChildFormOpen] = useState(false);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("8");

  // Add PB Record form
  const [eventTitle, setEventTitle] = useState("");
  const [newVal, setNewVal] = useState("");
  const [prevVal, setPrevVal] = useState("");

  const myLedgers = sessionLedgers.filter((l) => l.athleteId === currentPersona.id);
  const myPBs = useMemo(
    () =>
      pbRecords.filter(
        (p) =>
          p.athleteId === currentPersona.id ||
          minorAthletes.some((m) => m.id === p.athleteId)
      ),
    [pbRecords, currentPersona.id, minorAthletes]
  );

  const avgSkillScore = useMemo(() => {
    if (!skillEvaluation.metrics.length) return 0;
    const total = skillEvaluation.metrics.reduce((sum, m) => sum + m.score, 0);
    return (total / skillEvaluation.metrics.length).toFixed(1);
  }, [skillEvaluation]);

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName.trim()) return;
    addMinorAthlete({
      fullNameAr: childName.trim(),
      age: Number(childAge) || 8,
      gender: "male",
      primarySport: "swimming",
    });
    setChildName("");
    setChildFormOpen(false);
  };

  const handleAddPB = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !Number(newVal)) return;
    addNewPBRecord({
      athleteId: currentPersona.id,
      athleteNameAr: currentPersona.fullNameAr,
      sportType: "swimming",
      eventTitleAr: eventTitle.trim(),
      currentValue: Number(newVal) || 0,
      previousValue: Number(prevVal) || 0,
      unitAr: "ثانية",
      verificationSource: "self_entered",
      verificationLabelAr: "سجل شخصي عبر الجواز الرياضي",
      coachNameAr: "متابعة ذاتية",
      facilityNameAr: currentPersona.city,
    });
    setEventTitle("");
    setNewVal("");
    setPrevVal("");
  };

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="ملفك الرياضي وجواز السفر المائي"
        descriptionAr="أنشئ حسابك أو سجّل دخولك في Captenly للحصول على كود عضوية فريد، متابعة الأرقام القياسية، وحفظ دفاتر حصصك."
      />
    );
  }

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1180px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        {/* Modern Instagram / Threads / X-Inspired Profile Header */}
        <section className="rounded-[24px] bg-dark-slate text-surface-card p-6 md:p-8 shadow-lg flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start gap-5 flex-1 min-w-0">
              <div className="bg-white/10 rounded-full p-1.5 shrink-0">
                {currentPersona.avatarUrl ? (
                  <img
                    src={currentPersona.avatarUrl}
                    alt={currentPersona.fullNameAr}
                    className="w-20 h-20 rounded-full object-cover border-2 border-electric-volt"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-deep-carbon text-electric-volt flex items-center justify-center font-extrabold text-xl border border-white/15">
                    {currentPersona.fullNameAr?.slice(0, 2) || "سب"}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[24px] md:text-[28px] font-extrabold leading-snug text-surface-card">
                    {currentPersona.fullNameAr}
                  </h1>
                  {currentPersona.memberCode && (
                    <span className="px-3 py-1 rounded-full bg-deep-carbon text-electric-volt font-mono text-xs font-bold">
                      {currentPersona.memberCode}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[11px] font-bold">
                    {currentPersona.city}
                  </span>
                </div>

                <p className="text-xs md:text-sm text-surface-container-high leading-relaxed max-w-2xl">
                  {currentPersona.bioAr ||
                    "سبّاح نشط على كابتنلي • قارن المسابح، سجّل أرقامك القياسية، وتابع حضورك بـ QR."}
                </p>

                <ProfileSocialPillsRow />
              </div>
            </div>

            {/* Quick Stats Pill + Actions */}
            <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
              <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                <div className="rounded-2xl bg-deep-carbon px-4 py-2.5 text-center">
                  <div className="text-lg font-black text-electric-volt">{myPBs.length}</div>
                  <div className="text-[10px] text-surface-container-high">أرقام PB</div>
                </div>
                <div className="rounded-2xl bg-deep-carbon px-4 py-2.5 text-center">
                  <div className="text-lg font-black text-electric-volt">{avgSkillScore}/5</div>
                  <div className="text-[10px] text-surface-container-high">تقييم المهارة</div>
                </div>
                <div className="rounded-2xl bg-deep-carbon px-4 py-2.5 text-center">
                  <div className="text-lg font-black text-electric-volt">{myLedgers.length}</div>
                  <div className="text-[10px] text-surface-container-high">دفاتر QR</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/ledger"
                  className="px-4 py-2 rounded-full bg-electric-volt text-dark-slate font-card-title-sm text-xs flex items-center gap-1.5"
                >
                  <Icon name="qr_code_2" className="text-[16px]" />
                  <span>كود العضوية والحصص</span>
                </Link>
                <Link
                  href="/dashboard/athlete/settings"
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-surface-card font-badge-label text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Icon name="settings" className="text-[15px]" />
                  <span>تعديل الصورة والملف الشخصي</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Clean Modern Profile Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-surface-container">
          {[
            { key: "analytics", label: "أرقامي وتحليل الأداء", icon: "monitoring" },
            { key: "ledgers", label: `حصصي QR (${myLedgers.length})`, icon: "qr_code_2" },
            { key: "family", label: `الأبناء (${minorAthletes.length})`, icon: "family_restroom" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`px-5 py-2.5 rounded-t-2xl font-badge-label text-xs flex items-center gap-2 shrink-0 transition-colors ${
                activeTab === t.key
                  ? "bg-dark-slate text-electric-volt shadow-sm"
                  : "bg-surface-card text-text-muted hover:text-dark-slate"
              }`}
            >
              <Icon name={t.icon} className="text-[16px]" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Performance Analytics & PB Tracking */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
            <section className="lg:col-span-7 bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-section-title text-dark-slate">
                  سجل الأرقام القياسية ونسب التطور (PB)
                </h2>
                <span className="text-[11px] font-bold text-deep-olive bg-lime-tint px-3 py-1 rounded-full">
                  يُحسب التحسن تلقائياً مع كل سباق
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {myPBs.map((rec) => {
                  const pct = calcImprovementPct(rec.previousValue, rec.currentValue);
                  const barWidth = Math.max(20, Math.min(100, Math.round(100 - (rec.currentValue / 90) * 60)));
                  return (
                    <div
                      key={rec.id}
                      className="rounded-2xl bg-surface-snow p-4 flex flex-col gap-2 border border-surface-container/60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-card-title-sm text-dark-slate flex items-center gap-2 flex-wrap">
                            <span>{rec.eventTitleAr}</span>
                            <span className="text-xs text-deep-olive font-bold">({rec.athleteNameAr})</span>
                            {rec.verificationSource === "coach_reviewed" && (
                              <span className="px-2 py-0.5 rounded-full bg-lime-tint text-deep-olive text-[10px] font-bold">
                                ✓ موثق من كابتن {rec.coachNameAr}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-text-muted mt-0.5">
                            {rec.verificationLabelAr} • {rec.facilityNameAr}
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="text-xl font-black text-deep-olive">
                            {rec.currentValue} <span className="text-xs">{rec.unitAr}</span>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 text-[11px]">
                            <span className="text-text-muted">السابق: {rec.previousValue}</span>
                            {pct !== null && pct > 0 && (
                              <span className="text-deep-olive font-extrabold">↑ +{pct}%</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Visual speed progress bar */}
                      <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-l from-deep-olive to-electric-volt rounded-full"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleAddPB}
                className="pt-3 border-t border-surface-container grid grid-cols-2 sm:grid-cols-4 gap-2"
              >
                <input
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="السباق (مثلاً: 50م حرة)"
                  className="col-span-2 rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
                />
                <input
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  placeholder="الرقم الجديد (ث)"
                  className="rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-dark-slate text-electric-volt font-bold text-xs py-2"
                >
                  + تسجيل رقم جديد
                </button>
              </form>
            </section>

            <section className="lg:col-span-5 bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-section-title text-dark-slate">التقييم المهاري (5 محاور)</h2>
                <span className="text-xs font-extrabold text-deep-olive">{avgSkillScore} / 5</span>
              </div>
              <div className="flex flex-col gap-3">
                {skillEvaluation.metrics.map((m) => (
                  <div key={m.labelAr} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs font-bold text-dark-slate">
                      <span>{m.labelAr}</span>
                      <span className="text-deep-olive">{m.score} / 5</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-surface-snow overflow-hidden">
                      <div
                        className="h-full bg-deep-olive rounded-full transition-all"
                        style={{ width: `${(m.score / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-muted bg-surface-snow p-3.5 rounded-xl leading-relaxed">
                <strong className="text-dark-slate">ملاحظة الكابتن ({skillEvaluation.coachNameAr}):</strong>{" "}
                {skillEvaluation.coachFeedbackAr}
              </p>
            </section>
          </div>
        )}

        {/* Tab 2: QR Session Ledgers Summary */}
        {activeTab === "ledgers" && (
          <section className="bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-section-title text-dark-slate">دفاتر الحصص المرتبطة بكود عضويتك</h2>
              <Link
                href="/dashboard/ledger"
                className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
              >
                فتح شاشة الـ QR الكاملة ←
              </Link>
            </div>
            {myLedgers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myLedgers.map((l) => (
                  <div key={l.id} className="rounded-2xl bg-surface-snow p-4 border border-surface-container flex justify-between items-center">
                    <div>
                      <div className="font-card-title-sm text-dark-slate">{l.facilityNameAr}</div>
                      <div className="text-xs text-text-muted mt-0.5">{l.packageTitleAr}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-black text-deep-olive">
                        {Math.max(0, l.totalSessions - l.completedSessions)} متبقية
                      </div>
                      <div className="text-[11px] text-text-muted">من {l.totalSessions} حصة</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                لا توجد باقات مفعلة حالياً — شارك كود عضويتك <strong className="font-mono">{currentPersona.memberCode}</strong> مع الكابتن أو الأكاديمية لتفعيل باقتك فوراً.
              </p>
            )}
          </section>
        )}

        {/* Tab 3: Optional Family / Minor Athletes Supervision */}
        {activeTab === "family" && (
          <section className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-surface-container flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-section-title text-dark-slate">متابعة الأبناء والأسرة (اختياري)</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  أضف ملفات أبنائك لمتابعة حضورهم وأرقامهم القياسية من نفس حسابك وبموافقة ولي الأمر (قانون 151 لسنة 2020).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {minorAthletes.map((child) => (
                <div key={child.id} className="rounded-2xl bg-surface-snow p-4 flex items-center justify-between">
                  <div>
                    <div className="font-card-title-sm text-dark-slate">
                      {child.fullNameAr} ({child.age} سنوات)
                    </div>
                    <div className="text-xs text-deep-olive font-bold mt-0.5">{child.starTitleAr}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {child.activeCoachNameAr} • {child.activeFacilityNameAr}
                    </div>
                  </div>
                  <Icon name="verified" className="text-deep-olive text-[20px]" />
                </div>
              ))}
            </div>

            {childFormOpen ? (
              <form onSubmit={handleAddChild} className="flex flex-wrap gap-2 items-center pt-2">
                <input
                  required
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="اسم الطفل الثلاثي"
                  className="rounded-xl bg-surface-snow px-3.5 py-2 text-xs outline-none border border-surface-container"
                />
                <input
                  type="number"
                  min={4}
                  max={14}
                  value={childAge}
                  onChange={(e) => setChildAge(e.target.value)}
                  className="w-20 rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
                >
                  حفظ الطفل
                </button>
                <button
                  type="button"
                  onClick={() => setChildFormOpen(false)}
                  className="text-xs text-text-muted underline"
                >
                  إلغاء
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setChildFormOpen(true)}
                className="px-4 py-2 rounded-full bg-lime-tint text-deep-olive text-xs font-bold w-fit"
              >
                + إضافة ابن/ابنة للمتابعة العائلية
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
