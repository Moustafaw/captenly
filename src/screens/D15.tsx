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

function calcImprovementPct(
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

export default function Desktop15() {
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
  const [activeTab, setActiveTab] = useState<"analytics" | "ledgers" | "family">("analytics");
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(() =>
    isParentOnlyIntent && minorAthletes.length > 0 ? minorAthletes[0].id : ""
  );

  // Child form
  const [childFormOpen, setChildFormOpen] = useState(false);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("8");

  // Add PB Record form
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

  const avgSkillScore = useMemo(() => {
    if (!activeSkillEvaluation.metrics.length) return 0;
    const total = activeSkillEvaluation.metrics.reduce((sum, m) => sum + m.score, 0);
    return (total / activeSkillEvaluation.metrics.length).toFixed(1);
  }, [activeSkillEvaluation]);

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName.trim() || !canManageFamily) return;
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
      verificationLabelAr: "سجل شخصي عبر الجواز الرياضي",
      coachNameAr: "متابعة ذاتية",
      facilityNameAr: userLocation.isSpecified ? userLocation.city : "تسجيل شخصي",
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

  if (currentPersona.role === "coach" || currentPersona.role === "facility_manager") {
    return (
      <RoleAccessDeniedScreen
        titleAr="لوحة السبّاح وولي الأمر"
        descriptionAr="هذه الصفحة مخصصة لحسابات السبّاحين وأولياء الأمور لمتابعة الأرقام القياسية ودفاتر الحصص."
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
    <div className="screen-root bg-[#F7F9FA] font-body-default text-body-default text-[#0F172A] antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1180px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-6">
        {/* Option B Luxury Profile Header Card */}
        <section className="relative rounded-[24px] bg-white text-[#0F172A] p-6 md:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] border border-[#0F172A]/8 overflow-hidden flex flex-col gap-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#EAF4F8]/80 blur-3xl"
          />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start gap-5 flex-1 min-w-0">
              <div className="relative shrink-0">
                {currentPersona.avatarUrl ? (
                  <img
                    src={currentPersona.avatarUrl}
                    alt={currentPersona.fullNameAr}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#1D6E7D] shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center font-extrabold text-xl border-2 border-[#1D6E7D]/30">
                    {currentPersona.fullNameAr?.slice(0, 2) || "سب"}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#1D6E7D] text-white border-2 border-white flex items-center justify-center shadow-sm">
                  <Icon name="verified" className="text-[13px]" />
                </span>
              </div>

              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[24px] md:text-[28px] font-extrabold leading-snug text-[#0F172A]">
                    {currentPersona.fullNameAr}
                  </h1>
                  {currentPersona.memberCode && (
                    <span className="px-3 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20 font-mono text-xs font-bold">
                      {currentPersona.memberCode}
                    </span>
                  )}
                  {currentPersona.city && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F7F9FA] text-[#475569] border border-[#0F172A]/8 text-[11px] font-bold inline-flex items-center gap-1">
                      <Icon name="location_on" className="text-[12px] text-[#1D6E7D]" />
                      <span>{currentPersona.city}</span>
                    </span>
                  )}
                </div>

                {currentPersona.bioAr ? (
                  <p className="text-xs md:text-sm text-[#475569] leading-relaxed max-w-2xl">
                    {currentPersona.bioAr}
                  </p>
                ) : (
                  <Link
                    href="/dashboard/athlete/settings"
                    className="text-xs text-[#1D6E7D] font-bold hover:underline w-fit inline-flex items-center gap-1"
                  >
                    <Icon name="edit" className="text-[13px]" />
                    <span>أضف نبذة تعريفية لملفك +</span>
                  </Link>
                )}

                <ProfileSocialPillsRow />
              </div>
            </div>

            {/* Quick Stats Pill + Actions */}
            <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
              <div className="grid grid-cols-3 gap-2.5 w-full sm:w-auto">
                <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/8 px-4 py-2.5 text-center">
                  <div className="text-lg font-black text-[#1D6E7D]">{myPBs.length}</div>
                  <div className="text-[10px] font-bold text-[#64748B]">أرقام PB</div>
                </div>
                <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/8 px-4 py-2.5 text-center">
                  <div className="text-lg font-black text-[#1D6E7D]">
                    {hasSkillEvaluation ? `${avgSkillScore}/5` : "—"}
                  </div>
                  <div className="text-[10px] font-bold text-[#64748B]">تقييم المهارة</div>
                </div>
                <div className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/8 px-4 py-2.5 text-center">
                  <div className="text-lg font-black text-[#1D6E7D]">{myLedgers.length}</div>
                  <div className="text-[10px] font-bold text-[#64748B]">دفاتر QR</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/ledger"
                  className="px-5 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-card-title-sm text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Icon name="qr_code_2" className="text-[16px]" />
                  <span>كود العضوية والحصص</span>
                </Link>
                <Link
                  href="/dashboard/athlete/settings"
                  className="px-4 py-2.5 rounded-full bg-[#F7F9FA] hover:bg-[#EAF4F8] text-[#0F172A] hover:text-[#1D6E7D] border border-[#0F172A]/10 font-badge-label text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Icon name="settings" className="text-[15px]" />
                  <span>تعديل الصورة والملف الشخصي</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Staff Role Account Switcher Card (when user has been granted a staff role at a facility) */}
        {myStaffAssignments.some((st) => st.invitationStatus !== "declined") && (
          <section className="rounded-2xl bg-[#EAF4F8]/80 border border-[#1D6E7D]/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs animate-captenly-enter">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#1D6E7D] text-white flex items-center justify-center shrink-0">
                <Icon name="swap_horiz" className="text-[22px]" />
              </div>
              <div>
                <h2 className="font-card-title-sm text-[#0F172A]">
                  دعوات وصلاحيات العمل بالمنشأة
                </h2>
                <p className="text-xs text-[#475569] mt-0.5">
                  اقبل الدعوة أولاً لتفعيل صلاحيتك، أو بدّل حسابك مباشرة لواجهة المنشأة المخصصة لدورك الوظيفي.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {myStaffAssignments
                .filter((st) => st.invitationStatus !== "declined")
                .map((st) =>
                  st.invitationStatus === "pending" ? (
                    <div
                      key={st.id}
                      className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3.5 py-2 border border-[#1D6E7D]/20"
                    >
                      <span className="text-xs font-bold text-[#0F172A]">
                        دعوة: {st.roleTitleAr} ({st.facilityNameAr})
                      </span>
                      <button
                        type="button"
                        onClick={() => respondToStaffInvitation(st.facilityId, st.id, "accepted")}
                        className="px-3 py-1.5 rounded-full bg-[#1D6E7D] text-white text-xs font-bold"
                      >
                        قبول الدعوة ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => respondToStaffInvitation(st.facilityId, st.id, "declined")}
                        className="px-3 py-1.5 rounded-full bg-red-50 text-[#DC2626] text-xs font-bold"
                      >
                        رفض ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        switchToStaffMode(st.id);
                        router.push("/dashboard/facility");
                      }}
                      className={`px-4 py-2.5 rounded-full text-xs font-extrabold transition-all ${
                        activeStaffAssignment?.id === st.id
                          ? "bg-[#155460] text-white"
                          : "bg-[#1D6E7D] hover:bg-[#155460] text-white"
                      }`}
                    >
                      تبديل الحساب إلى: {st.roleTitleAr} ({st.facilityNameAr}) ←
                    </button>
                  )
                )}
            </div>
          </section>
        )}

        {/* Clean Modern Profile Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto bg-white p-1.5 rounded-2xl border border-[#0F172A]/8 shadow-[0_2px_12px_rgba(15,23,42,0.02)] w-fit max-w-full">
          {[
            { key: "analytics", label: "أرقامي وتحليل الأداء", icon: "monitoring" },
            { key: "ledgers", label: `حصصي QR (${myLedgers.length})`, icon: "qr_code_2" },
            ...(canManageFamily
              ? [{ key: "family", label: `الأبناء والأسرة (${minorAthletes.length})`, icon: "family_restroom" }]
              : []),
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`px-5 py-2.5 rounded-xl font-badge-label text-xs flex items-center gap-2 shrink-0 transition-all ${
                activeTab === t.key
                  ? "bg-[#1D6E7D] text-white shadow-sm"
                  : "text-[#475569] hover:text-[#1D6E7D] hover:bg-[#EAF4F8]/50"
              }`}
            >
              <Icon name={t.icon} className="text-[16px]" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Child Filter Selector (only shown when member has added children) */}
        {activeTab === "analytics" && canManageFamily && minorAthletes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-[#0F172A]/8 shadow-[0_2px_12px_rgba(15,23,42,0.02)]">
            <span className="text-xs font-bold text-[#64748B] ml-1">عرض تطور وتقييم:</span>
            <button
              type="button"
              onClick={() => setSelectedAthleteId("")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                !selectedAthleteId
                  ? "bg-[#1D6E7D] text-white"
                  : "bg-[#F7F9FA] text-[#0F172A] border border-[#0F172A]/8 hover:bg-[#EAF4F8]"
              }`}
            >
              جميع سجلات الأسرة / حسابي
            </button>
            {minorAthletes.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => setSelectedAthleteId(child.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  selectedAthleteId === child.id
                    ? "bg-[#1D6E7D] text-white"
                    : "bg-[#F7F9FA] text-[#0F172A] border border-[#0F172A]/8 hover:bg-[#EAF4F8]"
                }`}
              >
                {child.fullNameAr} ({child.age} س)
              </button>
            ))}
          </div>
        )}

        {/* Tab 1: Performance Analytics & PB Tracking */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 bg-white rounded-[24px] p-6 border border-[#0F172A]/8 shadow-[0_4px_24px_rgba(15,23,42,0.03)] flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-section-title text-[#0F172A]">
                  سجل الأرقام القياسية ونسب التطور (PB)
                </h2>
                <span className="text-[11px] font-bold text-[#1D6E7D] bg-[#EAF4F8] px-3 py-1 rounded-full">
                  يُحسب التحسن تلقائياً مع كل سباق
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {myPBs.map((rec) => {
                  const pct = calcImprovementPct(rec.previousValue, rec.currentValue, rec.unitAr);
                  const barWidth = Math.max(20, Math.min(100, Math.round(100 - (rec.currentValue / 90) * 60)));
                  return (
                    <div
                      key={rec.id}
                      className="rounded-2xl bg-[#F7F9FA] p-4 flex flex-col gap-2 border border-[#0F172A]/8"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-card-title-sm text-[#0F172A] flex items-center gap-2 flex-wrap">
                            <span>{rec.eventTitleAr}</span>
                            <span className="text-xs text-[#1D6E7D] font-bold">({rec.athleteNameAr})</span>
                            {rec.verificationSource === "coach_reviewed" && (
                              <span className="px-2 py-0.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-[10px] font-bold">
                                ✓ موثق من كابتن {rec.coachNameAr}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#64748B] mt-0.5">
                            {rec.verificationLabelAr} • {rec.facilityNameAr}
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="text-xl font-black text-[#1D6E7D]">
                            {rec.currentValue} <span className="text-xs">{rec.unitAr}</span>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 text-[11px]">
                            <span className="text-[#64748B]">السابق: {rec.previousValue}</span>
                            {pct !== null && pct > 0 && (
                              <span className="text-[#1D6E7D] font-extrabold">↑ +{pct}%</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Visual speed progress bar */}
                      <div className="h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-l from-[#1D6E7D] to-[#38BDF8] rounded-full"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleAddPB}
                className="pt-3 border-t border-[#0F172A]/8 grid grid-cols-1 sm:grid-cols-6 gap-2"
              >
                {canManageFamily && minorAthletes.length > 0 && (
                  <select
                    value={pbTargetAthleteId || (effectiveAthleteId === currentPersona.id ? "self" : effectiveAthleteId)}
                    onChange={(e) => setPbTargetAthleteId(e.target.value)}
                    className="sm:col-span-2 rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs font-bold outline-none border border-[#0F172A]/10"
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
                )}
                <input
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="السباق (مثلاً: 50م حرة)"
                  className="sm:col-span-2 rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D]"
                />
                <select
                  value={pbUnitAr}
                  onChange={(e) => setPbUnitAr(e.target.value)}
                  className="rounded-xl bg-[#F7F9FA] px-2.5 py-2 text-xs font-bold outline-none border border-[#0F172A]/10"
                >
                  <option value="ثانية">ثانية</option>
                  <option value="متر">متر</option>
                  <option value="لفة">لفة</option>
                  <option value="تكرار">تكرار</option>
                  <option value="نقطة">نقطة</option>
                </select>
                <input
                  required
                  type="number"
                  step="0.1"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  placeholder={`الرقم الجديد (${pbUnitAr})`}
                  className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D]"
                />
                <input
                  type="number"
                  step="0.1"
                  value={prevVal}
                  onChange={(e) => setPrevVal(e.target.value)}
                  placeholder="السابق (اختياري)"
                  className="rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D]"
                />
                <button
                  type="submit"
                  className={`${
                    canManageFamily && minorAthletes.length > 0 ? "sm:col-span-6" : ""
                  } rounded-xl bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-xs py-2.5 px-4 shadow-sm transition-colors`}
                >
                  + تسجيل رقم قياسي جديد
                </button>
              </form>
            </section>

            <section className="lg:col-span-5 bg-white rounded-[24px] p-6 border border-[#0F172A]/8 shadow-[0_4px_24px_rgba(15,23,42,0.03)] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-section-title text-[#0F172A]">التقييم المهاري (5 محاور)</h2>
                <span className="text-xs font-extrabold text-[#1D6E7D] bg-[#EAF4F8] px-3 py-1 rounded-full">
                  {hasSkillEvaluation ? `${avgSkillScore} / 5` : "لم يُقيّم بعد"}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {activeSkillEvaluation.metrics.map((m) => (
                  <div key={m.labelAr} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs font-bold text-[#0F172A]">
                      <span>{m.labelAr}</span>
                      <span className="text-[#1D6E7D]">{m.score} / 5</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#EAF4F8] overflow-hidden">
                      <div
                        className="h-full bg-[#1D6E7D] rounded-full transition-all"
                        style={{ width: `${(m.score / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {hasSkillEvaluation && activeSkillEvaluation.coachFeedbackAr ? (
                <p className="text-xs text-[#475569] bg-[#F7F9FA] border border-[#0F172A]/6 p-3.5 rounded-xl leading-relaxed">
                  {activeSkillEvaluation.coachNameAr && (
                    <strong className="text-[#0F172A]">
                      ملاحظة الكابتن ({activeSkillEvaluation.coachNameAr}):{" "}
                    </strong>
                  )}
                  {activeSkillEvaluation.coachFeedbackAr}
                </p>
              ) : (
                <p className="text-xs text-[#64748B] bg-[#F7F9FA] border border-[#0F172A]/6 p-3.5 rounded-xl leading-relaxed">
                  لم يُسجّل تقييم مهاري من الكابتن بعد.
                </p>
              )}
            </section>
          </div>
        )}

        {/* Tab 2: QR Session Ledgers Summary */}
        {activeTab === "ledgers" && (
          <section className="bg-white rounded-[24px] p-6 border border-[#0F172A]/8 shadow-[0_4px_24px_rgba(15,23,42,0.03)] flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-section-title text-[#0F172A]">دفاتر الحصص المرتبطة بكود عضويتك</h2>
              <Link
                href="/dashboard/ledger"
                className="px-4 py-2 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold shadow-sm transition-colors"
              >
                فتح شاشة الـ QR الكاملة ←
              </Link>
            </div>
            {myLedgers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myLedgers.map((l) => {
                  const isExpired = Boolean(
                    l.isCodeExpired || l.status === "completed" || l.completedSessions >= l.totalSessions
                  );
                  return (
                    <div
                      key={l.id}
                      className="rounded-2xl bg-[#F7F9FA] p-4 border border-[#0F172A]/8 flex justify-between items-center gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-card-title-sm text-[#0F172A]">{l.facilityNameAr}</span>
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-xs font-black border ${
                              isExpired
                                ? "bg-red-50 text-red-700 border-red-200 line-through"
                                : "bg-[#EAF4F8] text-[#1D6E7D] border-[#1D6E7D]/25"
                            }`}
                          >
                            {l.subscriptionCode || l.ledgerCode}
                          </span>
                        </div>
                        <div className="text-xs text-[#64748B] mt-0.5">
                          {l.packageTitleAr} •{" "}
                          {isExpired ? "كود الاشتراك منتهي الصلاحية" : "كود الاشتراك ساري ✓"}
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="text-lg font-black text-[#1D6E7D]">
                          {Math.max(0, l.totalSessions - l.completedSessions)} متبقية
                        </div>
                        <div className="text-[11px] text-[#64748B]">من {l.totalSessions} حصة</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#64748B]">
                لا توجد باقات مفعلة حالياً — شارك كود عضويتك <strong className="font-mono text-[#1D6E7D]">{currentPersona.memberCode}</strong> مع الكابتن أو الأكاديمية لتفعيل باقتك فوراً.
              </p>
            )}
          </section>
        )}

        {/* Tab 3: Family / Minor Athletes Supervision (optional in unified swimmer & family account) */}
        {canManageFamily && activeTab === "family" && (
          <section className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-section-title text-[#0F172A]">متابعة الأبناء والأسرة (اختياري)</h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  إذا كنت ولي أمر وتتابع سبّاحين صغاراً (تحت 14 سنة)، يمكنك إضافة ملفاتهم هنا لمتابعة حضورهم وأرقامهم القياسية من نفس حسابك الموحد (قانون 151 لسنة 2020).
                </p>
              </div>
              <Link
                href="/dashboard/athlete/settings/family"
                className="text-xs font-bold text-[#1D6E7D] hover:underline shrink-0"
              >
                تعديل أو حذف ملفات الأبناء ←
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {minorAthletes.map((child) => {
                const childLedger = sessionLedgers.find((l) => l.athleteId === child.id);
                const facLabel = childLedger?.facilityNameAr || child.activeFacilityNameAr;
                const coachLabel = childLedger?.coachNameAr || child.activeCoachNameAr;
                return (
                  <div key={child.id} className="rounded-2xl bg-[#F7F9FA] border border-[#0F172A]/8 p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-card-title-sm text-[#0F172A]">
                          {child.fullNameAr} ({child.age} سنوات)
                        </span>
                        {child.childMemberCode && (
                          <code
                            dir="ltr"
                            className="px-2 py-0.5 rounded bg-[#EAF4F8] text-[#1D6E7D] font-mono text-[11px] font-bold"
                          >
                            {child.childMemberCode}
                          </code>
                        )}
                      </div>
                      {child.currentStarLevel > 0 && child.starTitleAr && (
                        <div className="text-xs text-[#1D6E7D] font-bold mt-0.5">{child.starTitleAr}</div>
                      )}
                      {(coachLabel || facLabel) ? (
                        <div className="text-[11px] text-[#64748B] mt-0.5">
                          {[coachLabel, facLabel].filter(Boolean).join(" • ")}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#64748B] mt-0.5">
                          غير مربوط بأكاديمية أو كابتن بعد
                        </div>
                      )}
                    </div>
                    <Icon name="verified" className="text-[#1D6E7D] text-[20px] shrink-0" />
                  </div>
                );
              })}
            </div>

            {childFormOpen ? (
              <form onSubmit={handleAddChild} className="flex flex-wrap gap-2 items-center pt-2">
                <input
                  required
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="اسم الطفل الثلاثي"
                  className="rounded-xl bg-[#F7F9FA] px-3.5 py-2 text-xs outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D]"
                />
                <input
                  type="number"
                  min={4}
                  max={14}
                  value={childAge}
                  onChange={(e) => setChildAge(e.target.value)}
                  className="w-20 rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-[#0F172A]/10"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold shadow-sm"
                >
                  حفظ الطفل
                </button>
                <button
                  type="button"
                  onClick={() => setChildFormOpen(false)}
                  className="text-xs text-[#64748B] underline"
                >
                  إلغاء
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setChildFormOpen(true)}
                className="px-4 py-2 rounded-full bg-[#EAF4F8] hover:bg-[#DCEEF5] text-[#1D6E7D] border border-[#1D6E7D]/20 text-xs font-bold w-fit transition-colors"
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
