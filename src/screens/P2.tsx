"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { AvatarUploader } from "@/components/editorial/AvatarUploader";

export default function Phone2() {
  const {
    currentPersona,
    minorAthletes,
    addMinorAthlete,
    pbRecords,
    addNewPBRecord,
    skillEvaluation,
    sessionLedgers,
  } = useCaptenly();

  const [showFamily, setShowFamily] = useState(
    Boolean(currentPersona.hasParentSupervision || currentPersona.role === "parent")
  );
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("8");
  const [eventTitle, setEventTitle] = useState("50م سباحة حرة");
  const [newVal, setNewVal] = useState("33.1");

  const myLedgers = sessionLedgers.filter((l) => l.athleteId === currentPersona.id);
  const myPBs = pbRecords.filter(
    (p) =>
      p.athleteId === currentPersona.id ||
      (showFamily && minorAthletes.some((m) => m.id === p.athleteId))
  );

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-on-surface min-h-screen px-margin pt-4 pb-24 flex flex-col gap-4">
      {/* Identity Card with Profile Picture Upload */}
      <section className="rounded-2xl bg-dark-slate text-surface-card p-5 shadow-md flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 rounded-2xl p-2 shrink-0">
            <AvatarUploader size="md" darkSurface labelAr="تغيير الصورة" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="px-2.5 py-0.5 rounded-full bg-deep-carbon text-electric-volt font-mono text-[11px] font-bold">
              {currentPersona.memberCode || "CAP-M-5190"}
            </span>
            <h1 className="font-card-title text-lg text-surface-card mt-1 leading-snug">
              {currentPersona.fullNameAr}
            </h1>
            <span className="text-[11px] text-surface-container-high">
              {currentPersona.role === "parent" ? "حساب ولي أمر" : "حساب رياضي مستقل ✓"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/dashboard/ledger"
            className="py-2.5 rounded-full bg-electric-volt text-dark-slate text-xs font-bold text-center"
          >
            دفتر الحصص QR ({myLedgers.length})
          </Link>
          <Link
            href="/dashboard/athlete/settings"
            className="py-2.5 rounded-full bg-white/10 text-surface-card text-xs font-bold text-center"
          >
            الإعدادات والأمان
          </Link>
        </div>
      </section>

      {/* Personal Best Records */}
      <section className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-3">
        <h2 className="font-card-title text-dark-slate">الجواز الرياضي وأرقامي القياسية</h2>
        <div className="flex flex-col gap-2">
          {myPBs.map((rec) => (
            <div key={rec.id} className="rounded-xl bg-surface-snow p-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-dark-slate">{rec.eventTitleAr}</div>
                <div className="text-[10px] text-text-muted">{rec.athleteNameAr}</div>
              </div>
              <div className="font-black text-base text-deep-olive">
                {rec.currentValue} {rec.unitAr}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addNewPBRecord({
              athleteId: currentPersona.id,
              athleteNameAr: currentPersona.fullNameAr,
              sportType: "swimming",
              eventTitleAr: eventTitle,
              currentValue: Number(newVal) || 33,
              previousValue: 35,
              unitAr: "ثانية",
              verificationSource: "self_entered",
              verificationLabelAr: "سجل شخصي من الموبايل",
              coachNameAr: "متابعة ذاتية",
              facilityNameAr: currentPersona.city,
            });
          }}
          className="flex gap-2 pt-2 border-t border-surface-container"
        >
          <input
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            className="flex-1 rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
          />
          <input
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            className="w-16 rounded-xl bg-surface-snow px-2.5 py-2 text-xs outline-none border border-surface-container"
          />
          <button type="submit" className="px-3.5 py-2 rounded-xl bg-dark-slate text-electric-volt text-xs font-bold">
            + سجل
          </button>
        </form>
      </section>

      {/* Skill Metrics */}
      <section className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-3">
        <h2 className="font-card-title-sm text-dark-slate">التقييم المهاري (5 محاور)</h2>
        {skillEvaluation.metrics.map((m) => (
          <div key={m.labelAr} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-bold">
              <span>{m.labelAr}</span>
              <span className="text-deep-olive">{m.score}/5</span>
            </div>
            <div className="h-2 rounded-full bg-surface-snow overflow-hidden">
              <div className="h-full bg-deep-olive rounded-full" style={{ width: `${(m.score / 5) * 100}%` }} />
            </div>
          </div>
        ))}
      </section>

      {/* Optional Family Supervision */}
      <section className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-3 border border-surface-container">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-card-title-sm text-sm text-dark-slate">إشراف ولي الأمر للأبناء</div>
            <span className="text-[10px] text-text-muted">خيار إضافي 100% — غير إلزامي</span>
          </div>
          <button
            type="button"
            onClick={() => setShowFamily((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${
              showFamily ? "bg-lime-tint text-deep-olive" : "bg-dark-slate text-electric-volt"
            }`}
          >
            {showFamily ? "إخفاء" : "تفعيل"}
          </button>
        </div>

        {showFamily && (
          <div className="flex flex-col gap-2 pt-2 border-t border-surface-container">
            {minorAthletes.map((child) => (
              <div key={child.id} className="rounded-xl bg-surface-snow p-3 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-dark-slate">
                    {child.fullNameAr} ({child.age} سنوات)
                  </div>
                  <div className="text-[11px] text-deep-olive">{child.starTitleAr}</div>
                </div>
                <Icon name="verified" className="text-deep-olive text-[16px]" />
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!childName.trim()) return;
                addMinorAthlete({
                  fullNameAr: childName.trim(),
                  age: Number(childAge) || 8,
                  gender: "male",
                  primarySport: "swimming",
                });
                setChildName("");
              }}
              className="flex gap-2"
            >
              <input
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="اسم الطفل"
                className="flex-1 rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
              />
              <input
                type="number"
                min={4}
                max={14}
                value={childAge}
                onChange={(e) => setChildAge(e.target.value)}
                className="w-14 rounded-xl bg-surface-snow px-2 py-2 text-xs outline-none border border-surface-container"
              />
              <button type="submit" className="px-3.5 py-2 rounded-xl bg-deep-olive text-white text-xs font-bold">
                + إضافة
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
