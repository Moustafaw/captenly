"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { ProfileSocialPillsRow } from "@/components/editorial/AthleteProfileSocialEditor";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { RoleAccessDeniedScreen } from "@/components/auth/RoleAccessDeniedScreen";
import { isMemberAccountRole } from "@/types/captenly";

function calcMobileImprovementPct(
  previousValue: number,
  currentValue: number,
  unitAr?: string
): number | null {
  if (!previousValue || previousValue <= 0) return null;
  const normalizedUnit = (unitAr || "").trim();
  const higherIsBetter = ["متر", "سم", "كجم", "نقطة", "مرة", "تكرار", "لفة"].some((u) =>
    normalizedUnit.includes(u)
  );
  const pct = higherIsBetter
    ? ((currentValue - previousValue) / previousValue) * 100
    : ((previousValue - currentValue) / previousValue) * 100;
  return Number(pct.toFixed(1));
}

export default function Phone2() {
  const router = useRouter();
  const {
    currentPersona,
    userLocation,
    isAuthenticated,
    minorAthletes,
    addMinorAthlete,
    pbRecords,
    addNewPBRecord,
    getSkillEvaluationForAthlete,
    sessionLedgers,
    myStaffAssignments,
    activeStaffAssignment,
    switchToStaffMode,
    respondToStaffInvitation,
  } = useCaptenly();

  const canManageFamily = isMemberAccountRole(currentPersona.role);
  const isParentOnlyIntent = currentPersona.accountIntent === "parent_only";
  const [tab, setTab] = useState<"analytics" | "ledgers" | "family">("analytics");
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(() =>
    isParentOnlyIntent && minorAthletes.length > 0 ? minorAthletes[0].id : ""
  );
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("8");
  const [eventTitle, setEventTitle] = useState("");
  const [newVal, setNewVal] = useState("");
  const [prevVal, setPrevVal] = useState("");
  const [pbUnitAr, setPbUnitAr] = useState("ثانية");
  const [pbTargetAthleteId, setPbTargetAthleteId] = useState<string>("");

  const effectiveAthleteId = useMemo(() => {
    if (canManageFamily && selectedAthleteId && minorAthletes.some((m) => m.id === selectedAthleteId)) {
      return selectedAthleteId;
    }
    if (canManageFamily && isParentOnlyIntent && minorAthletes.length > 0 && selectedAthleteId !== "self") {
      return minorAthletes[0].id;
    }
    return currentPersona.id;
  }, [canManageFamily, selectedAthleteId, minorAthletes, currentPersona.id, isParentOnlyIntent]);

  const selectedAthleteName = useMemo(() => {
    if (effectiveAthleteId === currentPersona.id) return currentPersona.fullNameAr;
    return minorAthletes.find((m) => m.id === effectiveAthleteId)?.fullNameAr || currentPersona.fullNameAr;
  }, [effectiveAthleteId, currentPersona.id, currentPersona.fullNameAr, minorAthletes]);

  const myLedgers = sessionLedgers.filter((l) => {
    if (canManageFamily && selectedAthleteId && selectedAthleteId !== "self") {
      return l.athleteId === selectedAthleteId;
    }
    if (canManageFamily && selectedAthleteId === "self") {
      return (
        l.athleteId === currentPersona.id ||
        (Boolean(currentPersona.memberCode) &&
          l.memberCode?.toUpperCase() === currentPersona.memberCode?.toUpperCase())
      );
    }
    return (
      l.athleteId === currentPersona.id ||
      (currentPersona.memberCode &&
        l.memberCode?.toUpperCase() === currentPersona.memberCode.toUpperCase()) ||
      (canManageFamily && minorAthletes.some((m) => m.id === l.athleteId))
    );
  });
  const myPBs = useMemo(() => {
    if (canManageFamily && selectedAthleteId && selectedAthleteId !== "self") {
      return pbRecords.filter((p) => p.athleteId === effectiveAthleteId);
    }
    if (canManageFamily && selectedAthleteId === "self") {
      return pbRecords.filter((p) => p.athleteId === currentPersona.id);
    }
    return pbRecords.filter(
      (p) =>
        p.athleteId === currentPersona.id ||
        (canManageFamily && minorAthletes.some((m) => m.id === p.athleteId))
    );
  }, [pbRecords, currentPersona.id, canManageFamily, minorAthletes, selectedAthleteId, effectiveAthleteId]);

  const activeSkillEvaluation = useMemo(
    () => getSkillEvaluationForAthlete(effectiveAthleteId),
    [getSkillEvaluationForAthlete, effectiveAthleteId]
  );

  const hasSkillEvaluation = useMemo(
    () => activeSkillEvaluation.metrics.some((m) => m.score > 0),
    [activeSkillEvaluation]
  );

  const avgScore = useMemo(() => {
    if (!activeSkillEvaluation.metrics.length) return "0";
    const sum = activeSkillEvaluation.metrics.reduce((s, m) => s + m.score, 0);
    return (sum / activeSkillEvaluation.metrics.length).toFixed(1);
  }, [activeSkillEvaluation]);

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="ملفك الرياضي وجواز السفر المائي"
        descriptionAr="أنشئ حسابك أو سجّل دخولك في Captenly للحصول على كود عضوية فريد ومتابعة أرقامك القياسية."
      />
    );
  }

  if (currentPersona.role === "coach" || currentPersona.role === "facility_manager") {
    return (
      <RoleAccessDeniedScreen
        titleAr="لوحة السبّاح وولي الأمر"
        descriptionAr="هذه الصفحة مخصصة لحسابات السبّاحين وأولياء الأمور."
        fallbackHref={
          currentPersona.role === "facility_manager" ? "/dashboard/facility" : "/dashboard/coach"
        }
        fallbackLabelAr={
          currentPersona.role === "facility_manager" ? "الانتقال للوحة المنشأة" : "الانتقال للوحة الكابتن"
        }
      />
    );
  }

  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-[#0F172A] min-h-screen px-margin pt-4 pb-24 flex flex-col gap-4">
      {/* Option B Luxury Mobile Profile Header Card */}
      <section className="relative rounded-[24px] bg-white text-[#0F172A] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] border border-[#0F172A]/8 overflow-hidden flex flex-col gap-3.5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -left-12 w-40 h-40 rounded-full bg-[#EAF4F8]/90 blur-2xl"
        />
        <div className="relative z-10 flex items-start gap-3.5">
          <div className="relative shrink-0">
            {currentPersona.avatarUrl ? (
              <img
                src={currentPersona.avatarUrl}
                alt={currentPersona.fullNameAr}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#1D6E7D] shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center font-extrabold text-sm border-2 border-[#1D6E7D]/30">
                {currentPersona.fullNameAr?.slice(0, 2) || "سب"}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#1D6E7D] text-white border-2 border-white flex items-center justify-center">
              <Icon name="verified" className="text-[11px]" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {currentPersona.memberCode && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20 font-mono text-[10px] font-bold">
                  {currentPersona.memberCode}
                </span>
              )}
              {currentPersona.city && (
                <span className="text-[10px] font-bold text-[#64748B]">{currentPersona.city}</span>
              )}
            </div>
            <h1 className="font-card-title text-base text-[#0F172A] mt-1 leading-snug">
              {currentPersona.fullNameAr}
            </h1>
            {currentPersona.bioAr ? (
              <p className="text-[11px] text-[#475569] mt-0.5 line-clamp-2">
                {currentPersona.bioAr}
              </p>
            ) : (
              <Link href="/dashboard/athlete/settings" className="text-[11px] text-[#1D6E7D] font-bold mt-0.5 inline-block hover:underline">
                أضف نبذة تعريفية +
              </Link>
            )}
            <ProfileSocialPillsRow />
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/8 py-2.5 text-center">
            <div className="text-sm font-black text-[#1D6E7D]">{myPBs.length}</div>
            <div className="text-[10px] font-bold text-[#64748B]">أرقام PB</div>
          </div>
          <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/8 py-2.5 text-center">
            <div className="text-sm font-black text-[#1D6E7D]">
              {hasSkillEvaluation ? `${avgScore}/5` : "—"}
            </div>
            <div className="text-[10px] font-bold text-[#64748B]">المهارة</div>
          </div>
          <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/8 py-2.5 text-center">
            <div className="text-sm font-black text-[#1D6E7D]">{myLedgers.length}</div>
            <div className="text-[10px] font-bold text-[#64748B]">حصص QR</div>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-2">
          <Link
            href="/dashboard/ledger"
            className="py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold text-center shadow-sm transition-colors"
          >
            دفتر الحصص QR
          </Link>
          <Link
            href="/dashboard/athlete/settings"
            className="py-2.5 rounded-full bg-[#F7F9FA] border border-[#0F172A]/10 text-[#0F172A] text-xs font-bold text-center hover:bg-[#EAF4F8] transition-colors"
          >
            تعديل الصورة والإعدادات
          </Link>
        </div>
      </section>

      {/* Staff Role Account Switcher on Mobile */}
      {myStaffAssignments.some((st) => st.invitationStatus !== "declined") && (
        <section className="rounded-2xl bg-[#EAF4F8] border border-[#1D6E7D]/25 p-4 flex flex-col gap-2.5">
          <div className="text-xs font-extrabold text-[#0F172A] flex items-center gap-1.5">
            <Icon name="swap_horiz" className="text-[18px] text-[#1D6E7D]" />
            <span>دعوات وصلاحيات العمل بالمنشأة</span>
          </div>
          {myStaffAssignments
            .filter((st) => st.invitationStatus !== "declined")
            .map((st) =>
              st.invitationStatus === "pending" ? (
                <div
                  key={st.id}
                  className="rounded-xl bg-white p-3 border border-[#1D6E7D]/20 flex flex-col gap-2"
                >
                  <div className="text-xs font-bold text-[#0F172A]">
                    دعوة: {st.roleTitleAr} ({st.facilityNameAr})
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => respondToStaffInvitation(st.facilityId, st.id, "accepted")}
                      className="flex-1 py-2 rounded-full bg-[#1D6E7D] text-white text-xs font-bold"
                    >
                      قبول ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => respondToStaffInvitation(st.facilityId, st.id, "declined")}
                      className="flex-1 py-2 rounded-full bg-red-50 text-[#DC2626] text-xs font-bold"
                    >
                      رفض ✕
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    switchToStaffMode(st.id);
                    router.push("/dashboard/facility");
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-extrabold ${
                    activeStaffAssignment?.id === st.id
                      ? "bg-[#155460] text-white"
                      : "bg-[#1D6E7D] text-white"
                  }`}
                >
                  تبديل إلى: {st.roleTitleAr} ({st.facilityNameAr}) ←
                </button>
              )
            )}
        </section>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { key: "analytics", label: "الأرقام والأداء" },
          { key: "ledgers", label: `حصصي QR (${myLedgers.length})` },
          ...(canManageFamily ? [{ key: "family", label: `الأبناء والأسرة (${minorAthletes.length})` }] : []),
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as typeof tab)}
            className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 border transition-colors ${
              tab === item.key
                ? "bg-[#1D6E7D] border-[#1D6E7D] text-white shadow-sm"
                : "bg-white border-[#0F172A]/8 text-[#64748B]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "analytics" && (
        <>
          {canManageFamily && minorAthletes.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedAthleteId("");
                  setPbTargetAthleteId("");
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 border ${
                  !selectedAthleteId ? "bg-[#1D6E7D] border-[#1D6E7D] text-white" : "bg-white border-[#0F172A]/10 text-[#0F172A]"
                }`}
              >
                كل الأسرة
              </button>
              {!isParentOnlyIntent && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAthleteId("self");
                    setPbTargetAthleteId("self");
                  }}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 border ${
                    selectedAthleteId === "self"
                      ? "bg-[#1D6E7D] border-[#1D6E7D] text-white"
                      : "bg-white border-[#0F172A]/10 text-[#0F172A]"
                  }`}
                >
                  حسابي ({currentPersona.fullNameAr.split(" ")[0]})
                </button>
              )}
              {minorAthletes.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => {
                    setSelectedAthleteId(child.id);
                    setPbTargetAthleteId(child.id);
                  }}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 border ${
                    selectedAthleteId === child.id
                      ? "bg-[#1D6E7D] border-[#1D6E7D] text-white"
                      : "bg-white border-[#0F172A]/10 text-[#0F172A]"
                  }`}
                >
                  {child.fullNameAr}
                </button>
              ))}
            </div>
          )}

          <section className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-3">
            <h2 className="font-card-title text-[#0F172A]">أرقامي القياسية (PB)</h2>
            <div className="flex flex-col gap-2">
              {myPBs.map((rec) => {
                const pct = calcMobileImprovementPct(rec.previousValue, rec.currentValue, rec.unitAr);
                return (
                  <div key={rec.id} className="rounded-xl bg-[#F7F9FA] border border-[#0F172A]/6 p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-[#0F172A]">{rec.eventTitleAr}</div>
                      <div className="text-[10px] text-[#64748B]">
                        {rec.athleteNameAr}{" "}
                        {pct !== null && pct > 0 ? `• ↑ تطور +${pct}%` : ""}
                      </div>
                    </div>
                    <div className="font-black text-base text-[#1D6E7D]">
                      {rec.currentValue} {rec.unitAr}
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!eventTitle.trim() || !Number(newVal)) return;
                const targetId =
                  canManageFamily && pbTargetAthleteId && pbTargetAthleteId !== "self"
                    ? pbTargetAthleteId
                    : effectiveAthleteId;
                const targetName =
                  targetId === currentPersona.id
                    ? currentPersona.fullNameAr
                    : minorAthletes.find((m) => m.id === targetId)?.fullNameAr || selectedAthleteName;
                addNewPBRecord({
                  athleteId: targetId,
                  athleteNameAr: targetName,
                  sportType: "swimming",
                  eventTitleAr: eventTitle.trim(),
                  currentValue: Number(newVal) || 0,
                  previousValue: Number(prevVal) || 0,
                  unitAr: pbUnitAr,
                  verificationSource: "self_entered",
                  verificationLabelAr: "سجل شخصي من الموبايل",
                  coachNameAr: "متابعة ذاتية",
                  facilityNameAr: userLocation.isSpecified ? userLocation.city : "تسجيل شخصي",
                });
                setEventTitle("");
                setNewVal("");
                setPrevVal("");
              }}
              className="grid grid-cols-2 gap-2.5 pt-3 border-t border-[#E2E8F0]"
            >
              {canManageFamily && minorAthletes.length > 0 && (
                <div className="col-span-2 flex flex-col gap-1">
                  <label htmlFor="p2-pb-athlete" className="text-[11px] font-bold text-[#475569]">
                    السبّاح المستهدف
                  </label>
                  <select
                    id="p2-pb-athlete"
                    aria-label="السبّاح المستهدف"
                    value={pbTargetAthleteId || (effectiveAthleteId === currentPersona.id ? "self" : effectiveAthleteId)}
                    onChange={(e) => setPbTargetAthleteId(e.target.value)}
                    className="w-full rounded-2xl bg-[#F7F9FA] px-3 py-2.5 text-xs font-bold text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1]"
                  >
                    {!isParentOnlyIntent && (
                      <option value="self">السبّاح: {currentPersona.fullNameAr} (حسابي)</option>
                    )}
                    {minorAthletes.map((child) => (
                      <option key={child.id} value={child.id}>
                        الابن: {child.fullNameAr}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-span-2 flex flex-col gap-1">
                <label htmlFor="p2-pb-event" className="text-[11px] font-bold text-[#475569]">
                  السباق أو التمرين *
                </label>
                <input
                  id="p2-pb-event"
                  aria-label="السباق أو التمرين"
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="مثال: 50م سباحة حرة"
                  className="w-full rounded-2xl bg-[#F7F9FA] px-3 py-2.5 text-xs font-semibold text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="p2-pb-unit" className="text-[11px] font-bold text-[#475569]">
                  الوحدة
                </label>
                <select
                  id="p2-pb-unit"
                  aria-label="وحدة القياس"
                  value={pbUnitAr}
                  onChange={(e) => setPbUnitAr(e.target.value)}
                  className="w-full rounded-2xl bg-[#F7F9FA] px-2.5 py-2.5 text-xs font-bold text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1]"
                >
                  <option value="ثانية">ثانية</option>
                  <option value="متر">متر</option>
                  <option value="لفة">لفة</option>
                  <option value="تكرار">تكرار</option>
                  <option value="نقطة">نقطة</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="p2-pb-new" className="text-[11px] font-bold text-[#475569]">
                  الرقم الجديد ({pbUnitAr}) *
                </label>
                <input
                  id="p2-pb-new"
                  aria-label={`الرقم الجديد (${pbUnitAr})`}
                  required
                  type="number"
                  step="0.1"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  placeholder="مثال: 29.5"
                  className="w-full rounded-2xl bg-[#F7F9FA] px-3 py-2.5 text-xs font-semibold text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1]"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <label htmlFor="p2-pb-prev" className="text-[11px] font-bold text-[#475569]">
                  الرقم السابق (اختياري)
                </label>
                <input
                  id="p2-pb-prev"
                  aria-label="الرقم السابق للمقارنة (اختياري)"
                  type="number"
                  step="0.1"
                  value={prevVal}
                  onChange={(e) => setPrevVal(e.target.value)}
                  placeholder="مثال: 31.0"
                  className="w-full rounded-2xl bg-[#F7F9FA] px-3 py-2.5 text-xs font-semibold text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1]"
                />
              </div>
              <button
                type="submit"
                className="col-span-2 px-3.5 py-2.5 rounded-2xl bg-[#1D6E7D] hover:bg-[#165966] text-white text-xs font-black transition cursor-pointer"
              >
                + سجل
              </button>
            </form>
          </section>

          <section className="bg-white rounded-3xl p-4 border border-[#E2E8F0] shadow-[0_6px_22px_rgba(11,28,46,0.04)] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-sm text-[#0B1C2E]">التقييم المهاري (5 محاور)</h2>
              <span className="text-xs font-black text-[#1D6E7D] px-2.5 py-0.5 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/20">
                {hasSkillEvaluation ? `${avgScore} / 5` : "لم يُقيّم بعد"}
              </span>
            </div>
            {activeSkillEvaluation.metrics.map((m) => (
              <div key={m.labelAr} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[#0B1C2E]">{m.labelAr}</span>
                  <span className="text-[#1D6E7D] font-black">{m.score}/5</span>
                </div>
                <div className="h-2 rounded-full bg-[#EAF4F8] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-l from-[#00ACC1] to-[#1D6E7D] rounded-full transition-all"
                    style={{ width: `${(m.score / 5) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {hasSkillEvaluation && activeSkillEvaluation.coachFeedbackAr ? (
              <p className="text-[11px] text-[#64748B] bg-[#F7F9FA] border border-[#E2E8F0] p-3 rounded-2xl leading-relaxed">
                {activeSkillEvaluation.coachNameAr && (
                  <strong className="text-[#0B1C2E]">
                    ملاحظة الكابتن ({activeSkillEvaluation.coachNameAr}):{" "}
                  </strong>
                )}
                {activeSkillEvaluation.coachFeedbackAr}
              </p>
            ) : (
              <p className="text-[11px] text-[#64748B] bg-[#F7F9FA] border border-[#E2E8F0] p-3 rounded-2xl leading-relaxed">
                لم يُسجّل تقييم مهاري من الكابتن بعد.
              </p>
            )}
          </section>
        </>
      )}

      {tab === "ledgers" && (
        <section className="bg-white rounded-3xl p-4 shadow-[0_6px_22px_rgba(11,28,46,0.04)] flex flex-col gap-3 border border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <span className="font-black text-sm text-[#0B1C2E]">دفاتر الحصص وأكواد الاشتراك</span>
            <Link
              href="/dashboard/ledger"
              className="px-3.5 py-1.5 rounded-full bg-[#1D6E7D] hover:bg-[#165966] text-white text-[11px] font-black transition"
            >
              شاشة الـ QR ←
            </Link>
          </div>
          {myLedgers.length > 0 ? (
            myLedgers.map((l) => {
              const isExpired = Boolean(
                l.isCodeExpired || l.status === "completed" || l.completedSessions >= l.totalSessions
              );
              return (
                <div
                  key={l.id}
                  className="rounded-2xl bg-[#F7F9FA] p-3.5 border border-[#E2E8F0] flex justify-between items-center gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-xs text-[#0B1C2E]">{l.facilityNameAr}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-black border ${
                          isExpired
                            ? "bg-red-50 text-red-700 border-red-200 line-through"
                            : "bg-[#EAF4F8] text-[#1D6E7D] border-[#00ACC1]/25"
                        }`}
                      >
                        {l.subscriptionCode || l.ledgerCode}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#64748B] font-semibold mt-0.5">{l.packageTitleAr}</div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-sm font-black text-[#1D6E7D]">
                      {Math.max(0, l.totalSessions - l.completedSessions)} متبقية
                    </div>
                    <div className="text-[10px] text-[#64748B] font-semibold">من {l.totalSessions} حصة</div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-[#64748B]">
              لا توجد باقات مفعلة حالياً — شارك كود عضويتك{" "}
              <strong className="font-mono text-[#1D6E7D]">{currentPersona.memberCode}</strong> مع الأكاديمية أو الكابتن.
            </p>
          )}
        </section>
      )}

      {canManageFamily && tab === "family" && (
        <section className="bg-white rounded-3xl p-4 shadow-[0_6px_22px_rgba(11,28,46,0.04)] flex flex-col gap-3 border border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <div className="font-black text-sm text-[#0B1C2E]">متابعة الأبناء (اختياري)</div>
            <Link
              href="/dashboard/athlete/settings/family"
              className="text-[11px] font-black text-[#1D6E7D] hover:underline"
            >
              إدارة وتعديل ←
            </Link>
          </div>
          {minorAthletes.map((child) => {
            const childLedger = sessionLedgers.find((l) => l.athleteId === child.id);
            const facLabel = childLedger?.facilityNameAr || child.activeFacilityNameAr;
            const coachLabel = childLedger?.coachNameAr || child.activeCoachNameAr;
            return (
              <div
                key={child.id}
                className="rounded-2xl bg-[#F7F9FA] border border-[#E2E8F0] p-3.5 flex justify-between items-center gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-[#0B1C2E]">
                      {child.fullNameAr} ({child.age} سنوات)
                    </span>
                    {child.childMemberCode && (
                      <code
                        dir="ltr"
                        className="px-2 py-0.5 rounded-full bg-[#EAF4F8] border border-[#00ACC1]/20 text-[#1D6E7D] font-mono text-[10px] font-black"
                      >
                        {child.childMemberCode}
                      </code>
                    )}
                  </div>
                  {child.currentStarLevel > 0 && child.starTitleAr && (
                    <div className="text-[11px] text-[#1D6E7D] font-bold mt-0.5">{child.starTitleAr}</div>
                  )}
                  <div className="text-[10px] text-[#64748B] font-semibold mt-0.5">
                    {coachLabel || facLabel
                      ? [coachLabel, facLabel].filter(Boolean).join(" • ")
                      : "غير مربوط بأكاديمية بعد"}
                  </div>
                </div>
                <Icon name="verified" className="text-[#00ACC1] text-[18px] shrink-0" />
              </div>
            );
          })}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!childName.trim()) return;
              const clampedAge = Math.min(17, Math.max(3, Number(childAge) || 8));
              addMinorAthlete({
                fullNameAr: childName.trim(),
                age: clampedAge,
                gender: "male",
                primarySport: "swimming",
              });
              setChildName("");
            }}
            className="flex gap-2 pt-3 border-t border-[#E2E8F0]"
          >
            <input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="اسم الطفل"
              className="flex-1 rounded-2xl bg-[#F7F9FA] px-3 py-2.5 text-xs font-semibold text-[#0B1C2E] outline-none border border-[#E2E8F0] focus:border-[#00ACC1]"
            />
            <input
              type="number"
              min={3}
              max={17}
              value={childAge}
              onChange={(e) => setChildAge(e.target.value)}
              className="w-14 rounded-2xl bg-[#F7F9FA] px-2 py-2.5 text-xs font-bold text-[#0B1C2E] text-center outline-none border border-[#E2E8F0] focus:border-[#00ACC1]"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-2xl bg-[#1D6E7D] hover:bg-[#165966] text-white text-xs font-black transition cursor-pointer"
            >
              + إضافة
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
