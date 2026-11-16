"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { QrCodeBox } from "@/components/editorial/QrCodeBox";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { QrCameraScannerModal } from "@/components/qr/QrCameraScannerModal";
import { isMemberAccountRole } from "@/types/captenly";

export default function Phone5() {
  const {
    currentPersona,
    isAuthenticated,
    facilities,
    memberRegistry,
    sessionLedgers,
    enrollSwimmerByMemberCode,
    checkInSession,
    checkInBySubscriptionCode,
    renewSwimmerSubscription,
    uploadInstaPayReceipt,
    confirmReceiptByProvider,
    effectiveOffline,
    offlineQueue,
    syncOfflineQueue,
    syncLedgersFromServer,
    activeStaffAssignment,
    minorAthletes,
  } = useCaptenly();

  const isCoach = currentPersona.role === "coach";
  const isFacility =
    currentPersona.role === "facility_manager" || Boolean(activeStaffAssignment);
  const isProvider = isCoach || isFacility;
  const staffRole = activeStaffAssignment?.role;
  const canScanAndEnroll =
    isCoach ||
    currentPersona.role === "facility_manager" ||
    (Boolean(activeStaffAssignment) && staffRole !== "accounts_manager");
  const linkedFacilityId =
    activeStaffAssignment?.facilityId || currentPersona.linkedFacilityId || "";
  const linkedCoachId = currentPersona.linkedCoachId || currentPersona.id;

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "renewal_due" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [manualSubCodeInput, setManualSubCodeInput] = useState("");

  const [newMemberCode, setNewMemberCode] = useState("");
  const [newAthleteName, setNewAthleteName] = useState("");
  const [newFacilityId, setNewFacilityId] = useState(linkedFacilityId);
  const [newSessionsCount, setNewSessionsCount] = useState<8 | 12 | 24>(8);
  const [newFeeEgp, setNewFeeEgp] = useState("");

  const roleLedgers = useMemo(() => {
    if (isFacility) {
      if (!linkedFacilityId) return [];
      return sessionLedgers.filter((l) => l.facilityId === linkedFacilityId);
    }
    if (isCoach) {
      return sessionLedgers.filter(
        (l) => l.coachId === linkedCoachId || l.coachNameAr === currentPersona.fullNameAr
      );
    }
    const isUnifiedMember = isMemberAccountRole(currentPersona.role);
    return sessionLedgers.filter(
      (l) =>
        l.athleteId === currentPersona.id ||
        (currentPersona.memberCode &&
          l.memberCode?.toUpperCase() === currentPersona.memberCode.toUpperCase()) ||
        (isUnifiedMember && minorAthletes.some((m) => m.id === l.athleteId))
    );
  }, [sessionLedgers, currentPersona, isFacility, isCoach, linkedFacilityId, linkedCoachId, minorAthletes]);

  const filteredLedgers = useMemo(() => {
    return roleLedgers.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${l.athleteNameAr} ${l.facilityNameAr} ${l.packageTitleAr} ${l.ledgerCode} ${l.subscriptionCode || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [roleLedgers, statusFilter, searchQuery]);

  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const id = new URLSearchParams(window.location.search).get("id");
      if (id) setSelectedId(id);
    }
  }, []);

  const activeLedger =
    filteredLedgers.find((l) => l.id === selectedId) ||
    filteredLedgers[0] ||
    roleLedgers[0] ||
    null;

  const [pinInput, setPinInput] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [refNum, setRefNum] = useState("");
  const [amountEgp, setAmountEgp] = useState("");

  const memberCode = currentPersona.memberCode || "";
  const pendingOfflineCount = offlineQueue.filter((q) => !q.synced).length;

  const matchedEnrollMember = useMemo(
    () =>
      memberRegistry.find(
        (m) => m.memberCode.toUpperCase() === newMemberCode.trim().toUpperCase()
      ),
    [memberRegistry, newMemberCode]
  );

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="دفتر الحصص الـ QR وكود العضوية"
        descriptionAr="سجّل دخولك أو أنشئ حسابك على Captenly للحصول على كود عضويتك ومتابعة حصصك."
      />
    );
  }

  const copyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(memberCode).catch(() => undefined);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-[#0F172A] min-h-screen px-margin pt-4 pb-24 flex flex-col gap-4">
      {/* Offline Mode Mobile Bar */}
      <div className="rounded-[20px] bg-gradient-to-br from-[#EAF4F8] via-[#F4FAFC] to-white text-[#0F172A] p-4 shadow-[0_4px_18px_rgba(15,23,42,0.03)] border border-[#1D6E7D]/18 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                effectiveOffline ? "bg-amber-500 text-white" : "bg-[#1D6E7D] text-white"
              }`}
            >
              <Icon
                name={effectiveOffline ? "wifi_off" : "qr_code_2"}
                className="text-[18px]"
              />
            </div>
            <span className="font-card-title-sm text-sm text-[#0F172A] truncate">
              {isCoach
                ? "دفاتر المتدربين (QR)"
                : isFacility
                ? "دفاتر مشتركين المنشأة"
                : "دفتر الحصص الـ QR أوفلاين"}
            </span>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              effectiveOffline
                ? "bg-amber-100 text-amber-800"
                : "bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20"
            }`}
          >
            {effectiveOffline ? "أوفلاين" : "أوفلاين ✓"}
          </span>
        </div>
        <p className="text-[11px] text-[#475569] leading-relaxed">
          {effectiveOffline
            ? "وضع المسبح أوفلاين: كل حصة تُحفظ محلياً وتُزامَن تلقائياً عند عودة الشبكة."
            : isProvider
            ? "كل سباح أو عميل لديه دفتر مستقل وباركود خاص به لمتابعة حصصه وتحصيلاته."
            : "كل باقة أو فرد لديه دفتر حصص مستقل ويعمل بدون إنترنت داخل الصالة."}
        </p>
        {pendingOfflineCount > 0 && (
          <button
            type="button"
            onClick={() => syncOfflineQueue()}
            className="w-full py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold shadow-sm transition-colors"
          >
            مزامنة {pendingOfflineCount} حصة محفوظة أوفلاين ↻
          </button>
        )}
      </div>

      {roleLedgers.length === 0 && !isProvider ? (
        <section className="bg-white rounded-[20px] p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col items-center text-center gap-4">
          <span className="text-[#1D6E7D] text-[11px] font-extrabold">
            جاهز للتفعيل مع كابتنك أو أكاديميتك
          </span>
          <h1 className="font-section-title-mobile text-[#0F172A] leading-snug">
            دفتر الحصص الرقمي يُفعّل تلقائياً لكل اشتراك مع كابتن أو أكاديمية موثقة
          </h1>
          <p className="text-xs text-[#64748B] leading-relaxed">
            أنت الآن بحساب <strong className="text-[#0F172A]">{currentPersona.fullNameAr}</strong> ولا توجد باقات نشطة بعد. شارك كود عضويتك مع الكابتن لتفعيل الـ QR أو استعرض حسابات متعددة الدفاتر أدناه:
          </p>

          <QrCodeBox value={`CAP-MEMBER:${memberCode}`} size={160} label={memberCode} />

          <div className="w-full rounded-xl bg-[#F7F9FA] border border-[#0F172A]/8 p-3.5 flex items-center justify-between gap-2">
            <div className="text-right">
              <div className="text-[10px] text-[#64748B]">كود عضويتك</div>
              <div className="font-mono font-black text-lg text-[#1D6E7D]">{memberCode}</div>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="px-4 py-2 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold shrink-0 shadow-sm transition-colors"
            >
              {copied ? "تم النسخ ✓" : "نسخ الكود"}
            </button>
          </div>

          <div className="w-full flex flex-col gap-2">
            <Link
              href="/explore"
              className="w-full py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold text-center transition-colors"
            >
              استكشف المسابح والأكاديميات ←
            </Link>
            <Link
              href="/dashboard/athlete"
              className="w-full py-2.5 rounded-full bg-[#F7F9FA] text-[#0F172A] text-xs font-bold border border-[#0F172A]/10 text-center"
            >
              ملفي الرياضي وتحليل الأداء
            </Link>
            <button
              type="button"
              disabled={syncingCloud}
              onClick={async () => {
                setSyncingCloud(true);
                await syncLedgersFromServer();
                setSyncingCloud(false);
              }}
              className="w-full py-2.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20 text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <Icon name="sync" className={`text-[15px] ${syncingCloud ? "animate-spin" : ""}`} />
              <span>{syncingCloud ? "جاري التحديث..." : "تحديث الدفاتر من السحابة"}</span>
            </button>
          </div>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Multi-Ledger Swimmers Directory */}
          <section className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-card-title-sm text-sm text-[#0F172A]">
                  {isProvider
                    ? `سجل السباحين والعملاء (${roleLedgers.length})`
                    : `دفاتري النشطة (${roleLedgers.length})`}
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  اختر متدرباً لعرض باقته أو تسجيل حضوره
                </p>
              </div>
              {isProvider && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {canScanAndEnroll && (
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-[11px] font-bold shadow-sm transition-colors"
                    >
                      <Icon name="qr_code_scanner" className="text-[14px]" />
                      <span>مسح QR</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={syncingCloud}
                    onClick={async () => {
                      setSyncingCloud(true);
                      await syncLedgersFromServer();
                      setSyncingCloud(false);
                    }}
                    title="مزامنة الدفاتر مع السحابة"
                    className="w-8 h-8 rounded-full bg-[#F7F9FA] border border-[#0F172A]/10 flex items-center justify-center text-[#0F172A] disabled:opacity-50"
                  >
                    <Icon name="sync" className={`text-[15px] ${syncingCloud ? "animate-spin" : ""}`} />
                  </button>
                  {canScanAndEnroll && (
                    <button
                      type="button"
                      onClick={() => setShowEnrollForm((v) => !v)}
                      className="px-3 py-1.5 rounded-full bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/25 text-[11px] font-bold"
                    >
                      {showEnrollForm ? "إغلاق" : "+ مشترك"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Inline Quick Enroll on Mobile */}
            {canScanAndEnroll && showEnrollForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const res = enrollSwimmerByMemberCode({
                    memberCode: newMemberCode,
                    athleteNameAr: newAthleteName.trim() || matchedEnrollMember?.fullNameAr,
                    facilityId: newFacilityId || linkedFacilityId,
                    coachId: isCoach ? currentPersona.id : undefined,
                    packageTitleAr: `باقة تدريبية — ${newSessionsCount} حصص`,
                    totalSessions: newSessionsCount,
                    amountEgp: Number(newFeeEgp) || 0,
                  });
                  setMsg({ ok: res.ok, text: res.messageAr });
                  if (res.ok && res.ledger) {
                    setSelectedId(res.ledger.id);
                    setNewAthleteName("");
                    setShowEnrollForm(false);
                  }
                }}
                className="rounded-xl bg-[#F7F9FA] p-3 border border-[#1D6E7D]/25 flex flex-col gap-2"
              >
                <div className="text-xs font-bold text-[#0F172A]">إضافة سباح بكود العضوية</div>
                <input
                  required
                  value={newMemberCode}
                  onChange={(e) => setNewMemberCode(e.target.value)}
                  placeholder="كود العضوية (CAP-M-XXXX)"
                  className="rounded-xl bg-white px-3 py-2 font-mono text-xs outline-none border border-[#0F172A]/10"
                />
                <input
                  value={newAthleteName}
                  onChange={(e) => setNewAthleteName(e.target.value)}
                  placeholder={matchedEnrollMember?.fullNameAr || "اسم السباح (تلقائي أو اكتب الاسم)"}
                  className="rounded-xl bg-white px-3 py-2 text-xs outline-none border border-[#0F172A]/10"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newSessionsCount}
                    onChange={(e) => setNewSessionsCount(Number(e.target.value) as 8 | 12 | 24)}
                    className="rounded-xl bg-white px-2.5 py-2 text-xs outline-none border border-[#0F172A]/10"
                  >
                    <option value={8}>8 حصص</option>
                    <option value={12}>12 حصة</option>
                    <option value={24}>24 حصة</option>
                  </select>
                  <input
                    type="number"
                    value={newFeeEgp}
                    onChange={(e) => setNewFeeEgp(e.target.value)}
                    placeholder="ج.م"
                    className="rounded-xl bg-white px-2.5 py-2 text-xs outline-none border border-[#0F172A]/10"
                  />
                </div>
                <select
                  value={newFacilityId}
                  onChange={(e) => setNewFacilityId(e.target.value)}
                  className="rounded-xl bg-white px-2.5 py-2 text-xs outline-none border border-[#0F172A]/10"
                >
                  {(isFacility && linkedFacilityId
                    ? facilities.filter((f) => f.id === linkedFacilityId)
                    : facilities
                  ).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nameAr}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold transition-colors"
                >
                  حفظ وتفعيل الدفتر فوراً ✓
                </button>
              </form>
            )}

            {isProvider && (
              <div className="flex flex-col gap-2">
                {canScanAndEnroll && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!manualSubCodeInput.trim()) return;
                      const res = checkInBySubscriptionCode(
                        manualSubCodeInput.trim(),
                        isFacility ? linkedFacilityId : undefined,
                        "خصم حصة بإدخال كود الاشتراك يدوياً",
                        isCoach ? linkedCoachId : undefined
                      );
                      setMsg({ ok: res.ok, text: res.messageAr });
                      if (res.ok && res.ledger) {
                        setSelectedId(res.ledger.id);
                        setManualSubCodeInput("");
                      }
                    }}
                    className="rounded-xl bg-[#EAF4F8]/80 text-[#0F172A] border border-[#1D6E7D]/20 p-3 flex flex-col gap-2"
                  >
                    <div className="text-[11px] font-extrabold text-[#1D6E7D]">
                      إدخال كود الاشتراك يدوياً (بدون كاميرا):
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        value={manualSubCodeInput}
                        onChange={(e) => setManualSubCodeInput(e.target.value)}
                        placeholder="SUB-XXXX-XX"
                        className="flex-1 min-w-0 rounded-xl bg-white text-[#0F172A] px-3 py-2 text-xs font-mono border border-[#0F172A]/12 focus:border-[#1D6E7D] outline-none"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 rounded-xl bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-extrabold shrink-0 transition-colors"
                      >
                        خصم حصة ✓
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex items-center bg-[#F7F9FA] rounded-xl px-3 py-2 border border-[#0F172A]/10">
                  <Icon name="search" className="text-[#64748B] text-[15px] ml-2 shrink-0" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم السباح أو كود الاشتراك..."
                    className="w-full bg-transparent text-xs outline-none text-[#0F172A]"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: "all", label: "الكل" },
                    { id: "active", label: "نشط" },
                    { id: "renewal_due", label: "للتجديد" },
                    { id: "completed", label: "مكتمل" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                      className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                        statusFilter === tab.id
                          ? "bg-[#1D6E7D] text-white"
                          : "bg-[#F7F9FA] text-[#64748B] border border-[#0F172A]/8"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Vertical Cards Grid (No Horizontal Overflow on 390px) */}
            <div className="flex flex-col gap-2">
              {filteredLedgers.map((l) => {
                const isSelected = activeLedger?.id === l.id;
                const pct = Math.min(100, Math.round((l.completedSessions / l.totalSessions) * 100));
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(l.id);
                      setMsg(null);
                    }}
                    className={`w-full text-right rounded-xl p-3 border transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-[#EAF4F8]/70 border-[#1D6E7D] ring-1 ring-[#1D6E7D]/25"
                        : "bg-[#F7F9FA] border-[#0F172A]/8"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-xs text-[#0F172A] truncate">
                          {l.athleteNameAr}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-black border shrink-0 ${
                            l.isCodeExpired || l.status === "completed"
                              ? "bg-red-50 text-red-700 border-red-200 line-through"
                              : "bg-[#EAF4F8] text-[#1D6E7D] border-[#1D6E7D]/25"
                          }`}
                        >
                          {l.subscriptionCode || l.ledgerCode}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold shrink-0 ${
                          l.status === "completed" || l.isCodeExpired
                            ? "text-[#DC2626]"
                            : l.status === "renewal_due"
                            ? "text-amber-700"
                            : "text-[#1D6E7D]"
                        }`}
                      >
                        {l.completedSessions}/{l.totalSessions} حصص
                      </span>
                    </div>
                    <div className="text-[11px] text-[#64748B] truncate">{l.facilityNameAr}</div>
                    <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          l.status === "renewal_due"
                            ? "bg-amber-500"
                            : l.status === "completed"
                            ? "bg-[#334155]"
                            : "bg-[#1D6E7D]"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Active Ledger Detail & QR Card */}
          {activeLedger && (
            <>
              <div className="bg-white rounded-[20px] p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col items-center text-center gap-3">
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-[11px] font-extrabold rounded-full px-2.5 py-0.5 ${
                      activeLedger.status === "renewal_due"
                        ? "bg-amber-50 text-amber-800"
                        : activeLedger.status === "completed"
                        ? "bg-[#F1F5F9] text-[#64748B]"
                        : "bg-[#EAF4F8] text-[#1D6E7D]"
                    }`}
                  >
                    {activeLedger.status === "completed"
                      ? "باقة مكتملة"
                      : activeLedger.status === "renewal_due"
                      ? `متبقي ${activeLedger.totalSessions - activeLedger.completedSessions} حصص`
                      : `باقة نشطة (${activeLedger.completedSessions}/${activeLedger.totalSessions})`}
                  </span>
                  <span className="font-mono text-[11px] text-[#64748B]">{activeLedger.ledgerCode}</span>
                </div>

                <h2 className="font-card-title text-[#0F172A]">{activeLedger.athleteNameAr}</h2>
                <p className="text-xs text-[#64748B]">
                  {activeLedger.packageTitleAr} • {activeLedger.facilityNameAr}
                </p>

                {isProvider ? (
                  <div className="w-full rounded-xl bg-[#F7F9FA] p-3.5 border border-[#0F172A]/8 flex flex-col gap-2 text-right">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-[#64748B] font-bold">كود الاشتراك للسباح</div>
                        <div
                          className={`font-mono text-lg font-black ${
                            activeLedger.isCodeExpired || activeLedger.status === "completed"
                              ? "text-red-700 line-through"
                              : "text-[#1D6E7D]"
                          }`}
                        >
                          {activeLedger.subscriptionCode || activeLedger.ledgerCode}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const res = renewSwimmerSubscription({
                            ledgerId: activeLedger.id,
                            totalSessions: activeLedger.totalSessions,
                            packageTitleAr: activeLedger.packageTitleAr,
                          });
                          setMsg({ ok: res.ok, text: res.messageAr });
                        }}
                        className="px-3 py-1.5 rounded-full bg-[#EAF4F8] hover:bg-[#1D6E7D] text-[#1D6E7D] hover:text-white border border-[#1D6E7D]/25 text-[11px] font-bold transition-colors"
                      >
                        تجديد بكود جديد ↻
                      </button>
                    </div>
                    <p className="text-[11px] text-[#64748B]">
                      {activeLedger.isCodeExpired || activeLedger.status === "completed"
                        ? "انتهت صلاحية كود هذا الاشتراك بعد اكتمال الحصص. اضغط تجديد لتوليد كود جديد."
                        : "امسح باركود السباح بالكاميرا أو أدخل كود الاشتراك يدوياً لخصم الحصة."}
                    </p>
                  </div>
                ) : (
                  <>
                    <QrCodeBox
                      value={`CAP-SUB:${activeLedger.subscriptionCode || activeLedger.ledgerCode}`}
                      size={165}
                      label={`كود الاشتراك: ${activeLedger.subscriptionCode || activeLedger.ledgerCode}`}
                    />
                    <p className="text-[11px] text-[#64748B] max-w-xs">
                      أظهر هذا الباركود أو كود الاشتراك للمسؤول عند النزول للحوض.
                    </p>
                  </>
                )}

                <div className="grid grid-cols-4 gap-2 w-full pt-1">
                  {Array.from({ length: activeLedger.totalSessions }, (_, idx) => {
                    const n = idx + 1;
                    const done = n <= activeLedger.completedSessions;
                    return (
                      <div
                        key={n}
                        className={`py-2 rounded-xl text-[11px] font-bold border ${
                          done
                            ? "bg-[#EAF4F8] border-[#1D6E7D]/50 text-[#1D6E7D]"
                            : "bg-[#F7F9FA] border-[#0F172A]/10 text-[#64748B]"
                        }`}
                      >
                        {done ? `✓ ${n}` : n}
                      </div>
                    );
                  })}
                </div>

                {msg && (
                  <div
                    className={`w-full p-3 rounded-xl text-xs font-bold ${
                      msg.ok ? "bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20" : "bg-red-50 text-red-900 border border-red-200"
                    }`}
                  >
                    {msg.text}
                  </div>
                )}

                {canScanAndEnroll ? (
                  <div className="w-full flex flex-col gap-2 pt-1">
                    <input
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="أدخل كود الاشتراك أو PIN (4 أرقام)"
                      className="w-full rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-xs outline-none border border-[#0F172A]/10 focus:border-[#1D6E7D] text-center"
                    />
                    <button
                      type="button"
                      disabled={activeLedger.completedSessions >= activeLedger.totalSessions}
                      onClick={() => {
                        const cleanEntry = pinInput.trim();
                        if (!cleanEntry) {
                          setMsg({
                            ok: false,
                            text: "يرجى إدخال كود الاشتراك أو الـ PIN أولاً، أو استخدام زر «فتح الكاميرا لمسح QR».",
                          });
                          return;
                        }
                        const res = checkInSession(
                          activeLedger.id,
                          cleanEntry,
                          "pin_4digit",
                          "خصم حضور من لوحة الكابتن/المنشأة"
                        );
                        setMsg({ ok: res.ok, text: res.messageAr });
                        if (res.ok) setPinInput("");
                      }}
                      className="w-full py-3 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold shadow-sm disabled:opacity-40 transition-colors"
                    >
                      خصم حصة للسباح بالـ QR / PIN ✓
                    </button>
                  </div>
                ) : !isProvider ? (
                  <div className="w-full rounded-xl bg-[#EAF4F8]/70 p-3 text-xs font-bold text-[#1D6E7D] text-center border border-[#1D6E7D]/20">
                    اعرض رمز الـ QR أو كود الاشتراك للمسؤول عند المسبح لتسجيل حضورك تلقائياً.
                  </div>
                ) : null}
              </div>

              {/* Checkin Log */}
              <div className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-2">
                <h3 className="font-card-title-sm text-sm text-[#0F172A]">
                  سجل الحصص ({activeLedger.checkins.length})
                </h3>
                {activeLedger.checkins.length === 0 ? (
                  <p className="text-xs text-[#64748B]">لم تُسجّل حصص في هذه الباقة بعد.</p>
                ) : (
                  activeLedger.checkins.map((c) => (
                    <div key={c.sessionNumber} className="rounded-xl bg-[#F7F9FA] border border-[#0F172A]/6 p-3 text-xs flex justify-between gap-2">
                      <span className="font-bold text-[#0F172A]">حصة #{c.sessionNumber}</span>
                      <span className="text-[#1D6E7D] font-bold">{c.dateAr}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Quick InstaPay Archive */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!refNum.trim()) return;
                  uploadInstaPayReceipt(activeLedger.id, {
                    referenceNumber: refNum.trim(),
                    channel: "إنستاباي (InstaPay)",
                    amountEgp: Number(amountEgp) || 0,
                    packageTitleAr: activeLedger.packageTitleAr,
                  });
                  setRefNum("");
                  setMsg({ ok: true, text: "✓ تم حفظ مرجع إيصال إنستاباي في الأرشيف بنجاح." });
                }}
                className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgba(15,23,42,0.03)] border border-[#0F172A]/8 flex flex-col gap-2.5"
              >
                <h3 className="font-card-title-sm text-sm text-[#0F172A]">
                  أرشيف إيصالات الدفع ({activeLedger.receipts.length})
                </h3>
                {activeLedger.receipts.map((r) => {
                  const canConfirmReceipt =
                    isCoach ||
                    currentPersona.role === "facility_manager" ||
                    (Boolean(activeStaffAssignment) &&
                      (activeStaffAssignment?.role === "accounts_manager" ||
                        activeStaffAssignment?.role === "general_staff"));
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl bg-[#F7F9FA] px-3 py-2 flex flex-col gap-1 text-[11px] border border-[#0F172A]/8"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-mono text-[#0F172A]">
                          {r.referenceNumber} • {r.channel}
                        </span>
                        <span className="font-bold text-[#1D6E7D]">{r.amountEgp} ج.م</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-bold ${
                            r.confirmedByProvider ? "text-[#1D6E7D]" : "text-amber-700"
                          }`}
                        >
                          {r.confirmedByProvider
                            ? "✓ مؤكد من الحسابات"
                            : "⏳ بانتظار تأكيد الحسابات"}
                        </span>
                        {!r.confirmedByProvider && canConfirmReceipt && (
                          <button
                            type="button"
                            onClick={() => confirmReceiptByProvider(activeLedger.id, r.id)}
                            className="px-2.5 py-0.5 rounded-full bg-[#1D6E7D] text-white text-[10px] font-bold"
                          >
                            تأكيد ✓
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-2 pt-1">
                  <input
                    required
                    value={refNum}
                    onChange={(e) => setRefNum(e.target.value)}
                    placeholder="رقم مرجع التحويل"
                    className="flex-1 min-w-0 rounded-xl bg-[#F7F9FA] px-3 py-2 text-xs outline-none border border-[#0F172A]/10"
                  />
                  <input
                    type="number"
                    value={amountEgp}
                    onChange={(e) => setAmountEgp(e.target.value)}
                    className="w-20 rounded-xl bg-[#F7F9FA] px-2.5 py-2 text-xs outline-none border border-[#0F172A]/10"
                  />
                </div>
                <button type="submit" className="w-full py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold transition-colors">
                  حفظ في أرشيف الإيصالات
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <QrCameraScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        scopeFacilityId={isFacility ? linkedFacilityId : undefined}
        scopeCoachId={isCoach ? linkedCoachId : undefined}
        onLedgerCheckedIn={(ledgerId, messageAr) => {
          setSelectedId(ledgerId);
          setMsg({ ok: true, text: messageAr });
        }}
        onMemberDetectedForEnroll={({ memberCode: detectedCode, athleteNameAr }) => {
          setShowEnrollForm(true);
          setNewMemberCode(detectedCode);
          if (athleteNameAr) setNewAthleteName(athleteNameAr);
          setMsg({
            ok: true,
            text: `تم التقاط كود العضوية ${detectedCode}${athleteNameAr ? ` (${athleteNameAr})` : ""} — أكمل تفعيل الباقة ليظهر الـ QR على جهاز السباح.`,
          });
        }}
      />
    </div>
  );
}
