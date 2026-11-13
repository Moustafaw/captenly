"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { ProfileSocialPillsRow } from "@/components/editorial/AthleteProfileSocialEditor";

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

  const [tab, setTab] = useState<"analytics" | "family">("analytics");
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("8");
  const [eventTitle, setEventTitle] = useState("50م سباحة حرة");
  const [newVal, setNewVal] = useState("32.4");

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

  const avgScore = useMemo(() => {
    if (!skillEvaluation.metrics.length) return "0";
    const sum = skillEvaluation.metrics.reduce((s, m) => s + m.score, 0);
    return (sum / skillEvaluation.metrics.length).toFixed(1);
  }, [skillEvaluation]);

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-on-surface min-h-screen px-margin pt-4 pb-24 flex flex-col gap-4">
      {/* Modern Profile Header Card */}
      <section className="rounded-3xl bg-dark-slate text-surface-card p-5 shadow-md flex flex-col gap-3.5">
        <div className="flex items-start gap-3.5">
          <div className="bg-white/10 rounded-full p-1 shrink-0">
            {currentPersona.avatarUrl ? (
              <img
                src={currentPersona.avatarUrl}
                alt={currentPersona.fullNameAr}
                className="w-14 h-14 rounded-full object-cover border-2 border-electric-volt"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-deep-carbon text-electric-volt flex items-center justify-center font-extrabold text-sm border border-white/15">
                {currentPersona.fullNameAr?.slice(0, 2) || "سب"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-deep-carbon text-electric-volt font-mono text-[10px] font-bold">
                {currentPersona.memberCode || "CAP-M-5190"}
              </span>
              <span className="text-[10px] text-surface-container-high">{currentPersona.city}</span>
            </div>
            <h1 className="font-card-title text-base text-surface-card mt-1 leading-snug">
              {currentPersona.fullNameAr}
            </h1>
            <p className="text-[11px] text-surface-container-high mt-0.5 line-clamp-2">
              {currentPersona.bioAr || "سبّاح نشط على كابتنلي • متابعة الأرقام القياسية وحصص QR"}
            </p>
            <ProfileSocialPillsRow />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-deep-carbon py-2 text-center">
            <div className="text-sm font-black text-electric-volt">{myPBs.length}</div>
            <div className="text-[10px] text-surface-container-high">أرقام PB</div>
          </div>
          <div className="rounded-2xl bg-deep-carbon py-2 text-center">
            <div className="text-sm font-black text-electric-volt">{avgScore}/5</div>
            <div className="text-[10px] text-surface-container-high">المهارة</div>
          </div>
          <div className="rounded-2xl bg-deep-carbon py-2 text-center">
            <div className="text-sm font-black text-electric-volt">{myLedgers.length}</div>
            <div className="text-[10px] text-surface-container-high">حصص QR</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/dashboard/ledger"
            className="py-2 rounded-full bg-electric-volt text-dark-slate text-xs font-bold text-center"
          >
            دفتر الحصص QR
          </Link>
          <Link
            href="/dashboard/athlete/settings"
            className="py-2 rounded-full bg-white/10 text-surface-card text-xs font-bold text-center"
          >
            تعديل الصورة والإعدادات
          </Link>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { key: "analytics", label: "الأرقام والأداء" },
          { key: "family", label: `الأبناء (${minorAthletes.length})` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as typeof tab)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold shrink-0 ${
              tab === item.key ? "bg-dark-slate text-electric-volt" : "bg-surface-card text-text-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "analytics" && (
        <>
          <section className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <h2 className="font-card-title text-dark-slate">أرقامي القياسية (PB)</h2>
            <div className="flex flex-col gap-2">
              {myPBs.map((rec) => {
                const pct =
                  rec.previousValue > 0
                    ? Number((((rec.previousValue - rec.currentValue) / rec.previousValue) * 100).toFixed(1))
                    : 0;
                return (
                  <div key={rec.id} className="rounded-xl bg-surface-snow p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-dark-slate">{rec.eventTitleAr}</div>
                      <div className="text-[10px] text-text-muted">
                        {rec.athleteNameAr} {pct > 0 ? `• ↑ تطور +${pct}%` : ""}
                      </div>
                    </div>
                    <div className="font-black text-base text-deep-olive">
                      {rec.currentValue} {rec.unitAr}
                    </div>
                  </div>
                );
              })}
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
        </>
      )}

      {tab === "family" && (
        <section className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-3 border border-surface-container">
          <div className="font-card-title-sm text-sm text-dark-slate">متابعة الأبناء (اختياري)</div>
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
            className="flex gap-2 pt-2 border-t border-surface-container"
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
        </section>
      )}
    </div>
  );
}
