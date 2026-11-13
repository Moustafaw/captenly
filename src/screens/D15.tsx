"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { AvatarUploader } from "@/components/editorial/AvatarUploader";

export default function Desktop15() {
  const {
    currentPersona,
    minorAthletes,
    addMinorAthlete,
    pbRecords,
    addNewPBRecord,
    skillEvaluation,
    sessionLedgers,
  } = useCaptenly();

  const [showFamilyOptional, setShowFamilyOptional] = useState(
    Boolean(currentPersona.hasParentSupervision || currentPersona.role === "parent")
  );
  const [childFormOpen, setChildFormOpen] = useState(false);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("8");

  // Add PB Record form
  const [eventTitle, setEventTitle] = useState("50م سباحة حرة");
  const [newVal, setNewVal] = useState("33.1");
  const [prevVal, setPrevVal] = useState("34.5");
  const [unitAr, setUnitAr] = useState("ثانية");

  const myLedgers = sessionLedgers.filter((l) => l.athleteId === currentPersona.id);
  const myPBs = pbRecords.filter(
    (p) =>
      p.athleteId === currentPersona.id ||
      (showFamilyOptional && minorAthletes.some((m) => m.id === p.athleteId))
  );

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
    addNewPBRecord({
      athleteId: currentPersona.id,
      athleteNameAr: currentPersona.fullNameAr,
      sportType: "swimming",
      eventTitleAr: eventTitle,
      currentValue: Number(newVal) || 33,
      previousValue: Number(prevVal) || 35,
      unitAr,
      verificationSource: "self_entered",
      verificationLabelAr: "سجل شخصي عبر الجواز الرياضي",
      coachNameAr: "متابعة ذاتية",
      facilityNameAr: currentPersona.city,
    });
  };

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1220px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        {/* Identity Header */}
        <section className="rounded-[20px] bg-dark-slate text-surface-card p-6 md:p-8 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 flex-1 min-w-0">
            <div className="bg-white/10 rounded-2xl p-3 shrink-0">
              <AvatarUploader size="lg" darkSurface labelAr="رفع صورة شخصية" />
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-deep-carbon text-electric-volt font-mono text-xs font-bold">
                  كود العضوية: {currentPersona.memberCode || "CAP-M-5190"}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 text-xs">
                  {currentPersona.role === "parent" ? "حساب ولي أمر" : "حساب رياضي مستقل ✓"}
                </span>
              </div>
              <h1 className="text-[22px] md:text-[25px] font-extrabold leading-snug text-surface-card">
                ملف الرياضي: {currentPersona.fullNameAr}
              </h1>
              <p className="font-body-compact text-xs md:text-sm text-surface-container-high leading-relaxed">
                الجواز الرقمي والأرقام القياسية — تُدار باقاتك وسجلاتك بشكل مستقل تماماً، مع إتاحة إشراف ولي الأمر للأبناء كخيار إضافي فقط.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/dashboard/ledger"
              className="px-5 py-2.5 rounded-full bg-electric-volt text-dark-slate font-card-title-sm text-xs flex items-center gap-1.5"
            >
              <Icon name="qr_code_2" className="text-[16px]" />
              <span>دفتر الحصص والـ QR ({myLedgers.length})</span>
            </Link>
            <Link
              href="/dashboard/athlete/settings"
              className="px-5 py-2.5 rounded-full bg-white/10 text-surface-card font-badge-label text-xs"
            >
              الإعدادات والخصوصية
            </Link>
          </div>
        </section>

        {/* PB Records + Skill Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <section className="lg:col-span-7 bg-surface-card rounded-[20px] p-6 shadow-sm flex flex-col gap-4">
            <h2 className="font-section-title text-dark-slate">
              الجواز الرياضي والأرقام القياسية الشخصية (PB)
            </h2>

            <div className="flex flex-col gap-2.5">
              {myPBs.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-2xl bg-surface-snow p-4 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-card-title-sm text-dark-slate">
                      {rec.eventTitleAr} — <span className="text-deep-olive">{rec.athleteNameAr}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {rec.verificationLabelAr} • {rec.facilityNameAr}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-xl font-black text-deep-olive">
                      {rec.currentValue} {rec.unitAr}
                    </div>
                    <div className="text-[11px] text-text-muted">السابق: {rec.previousValue}</div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddPB} className="pt-3 border-t border-surface-container grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="السباق / التمرين"
                className="col-span-2 rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
              />
              <input
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                placeholder="الرقم الجديد"
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
            <h2 className="font-section-title text-dark-slate">التقييم المهاري (5 محاور)</h2>
            <div className="flex flex-col gap-3">
              {skillEvaluation.metrics.map((m) => (
                <div key={m.labelAr} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-dark-slate">
                    <span>{m.labelAr}</span>
                    <span className="text-deep-olive">{m.score} / 5</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-snow overflow-hidden">
                    <div
                      className="h-full bg-deep-olive rounded-full"
                      style={{ width: `${(m.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-muted bg-surface-snow p-3 rounded-xl">
              {skillEvaluation.coachFeedbackAr}
            </p>
          </section>
        </div>

        {/* Optional Parent Supervision Section */}
        <section className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-surface-container flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-section-title text-dark-slate">إشراف ولي الأمر ومتابعة الأبناء</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-surface-snow text-text-muted text-[11px] font-bold">
                  خيار إضافي 100% — غير إلزامي
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                مخصص فقط للأمهات والأهالي الراغبين في متابعة حصص أطفالهم تحت 14 سنة من حسابهم.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFamilyOptional((v) => !v)}
              className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 ${
                showFamilyOptional
                  ? "bg-lime-tint text-deep-olive"
                  : "bg-dark-slate text-electric-volt"
              }`}
            >
              {showFamilyOptional ? "إخفاء قسم الأبناء ✓" : "تفعيل متابعة الأبناء (اختياري)"}
            </button>
          </div>

          {showFamilyOptional && (
            <div className="flex flex-col gap-4 pt-2 border-t border-surface-container">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {minorAthletes.map((child) => (
                  <div
                    key={child.id}
                    className="rounded-2xl bg-surface-snow p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-card-title-sm text-dark-slate">
                        {child.fullNameAr} ({child.age} سنوات)
                      </div>
                      <div className="text-xs text-deep-olive font-bold mt-0.5">{child.starTitleAr}</div>
                      <div className="text-[11px] text-text-muted">{child.activeFacilityNameAr}</div>
                    </div>
                    <Link
                      href="/dashboard/ledger"
                      className="px-3 py-1.5 rounded-full bg-surface-card text-xs font-bold text-dark-slate shadow-sm"
                    >
                      الحصص
                    </Link>
                  </div>
                ))}
              </div>

              {childFormOpen ? (
                <form onSubmit={handleAddChild} className="flex flex-wrap items-center gap-2">
                  <input
                    required
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="اسم الطفل"
                    className="rounded-xl bg-surface-snow px-4 py-2 text-xs outline-none border border-surface-container"
                  />
                  <input
                    type="number"
                    min={4}
                    max={14}
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                    className="w-24 rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
                  >
                    حفظ
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
                  + إضافة طفل للمتابعة العائلية
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
