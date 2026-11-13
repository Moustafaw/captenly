"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { QrCodeBox } from "@/components/editorial/QrCodeBox";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { QrCameraScannerModal } from "@/components/qr/QrCameraScannerModal";

export default function Desktop8() {
  const {
    currentPersona,
    isAuthenticated,
    facilities,
    memberRegistry,
    sessionLedgers,
    enrollSwimmerByMemberCode,
    checkInSession,
    uploadInstaPayReceipt,
    effectiveOffline,
    isOfflineSimulated,
    toggleOfflineSimulation,
    offlineQueue,
    syncOfflineQueue,
    syncLedgersFromServer,
  } = useCaptenly();

  const isCoach = currentPersona.role === "coach";
  const isFacility = currentPersona.role === "facility_manager";
  const isProvider = isCoach || isFacility;
  const linkedFacilityId = currentPersona.linkedFacilityId || facilities[0]?.id || "";

  const [facilityScope, setFacilityScope] = useState<"mine" | "all">("mine");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "renewal_due" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);

  // Quick enroll form inside ledger for coaches / facilities
  const [newMemberCode, setNewMemberCode] = useState("");
  const [newAthleteName, setNewAthleteName] = useState("");
  const [newFacilityId, setNewFacilityId] = useState(linkedFacilityId);
  const [newPkgTitle, setNewPkgTitle] = useState("مدرسة السباحة — 8 حصص");
  const [newSessionsCount, setNewSessionsCount] = useState<8 | 12 | 24>(8);
  const [newFeeEgp, setNewFeeEgp] = useState("");
  const [enrollMsg, setEnrollMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  const facilityOwnCount = useMemo(
    () => sessionLedgers.filter((l) => l.facilityId === linkedFacilityId).length,
    [sessionLedgers, linkedFacilityId]
  );

  const roleLedgers = useMemo(() => {
    if (isFacility) {
      if (facilityScope === "mine" && facilityOwnCount > 0) {
        return sessionLedgers.filter((l) => l.facilityId === linkedFacilityId);
      }
      return sessionLedgers;
    }
    if (isCoach) {
      return sessionLedgers;
    }
    return sessionLedgers.filter((l) => l.athleteId === currentPersona.id);
  }, [sessionLedgers, currentPersona, isFacility, isCoach, facilityScope, facilityOwnCount, linkedFacilityId]);

  const filteredLedgers = useMemo(() => {
    return roleLedgers.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${l.athleteNameAr} ${l.facilityNameAr} ${l.packageTitleAr} ${l.ledgerCode} ${l.coachNameAr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [roleLedgers, statusFilter, searchQuery]);

  const [selectedLedgerId, setSelectedLedgerId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const id = new URLSearchParams(window.location.search).get("id");
      if (id) setSelectedLedgerId(id);
    }
  }, []);

  const activeLedger =
    filteredLedgers.find((l) => l.id === selectedLedgerId) ||
    filteredLedgers[0] ||
    roleLedgers[0] ||
    null;

  const [pinInput, setPinInput] = useState("");
  const [coachNote, setCoachNote] = useState("");
  const [checkinMsg, setCheckinMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // InstaPay form
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptChannel, setReceiptChannel] = useState<
    "إنستاباي (InstaPay)" | "فودافون كاش (Vodafone Cash)"
  >("إنستاباي (InstaPay)");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptSaved, setReceiptSaved] = useState(false);

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
        descriptionAr="سجّل دخولك أو أنشئ حسابك على Captenly للحصول على كود عضويتك الفريد وإدارة دفاتر الحصص."
      />
    );
  }

  const copyMemberCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(memberCode).catch(() => undefined);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleQuickEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    const res = enrollSwimmerByMemberCode({
      memberCode: newMemberCode,
      athleteNameAr: newAthleteName.trim() || matchedEnrollMember?.fullNameAr,
      facilityId: newFacilityId || linkedFacilityId,
      coachId: isCoach ? currentPersona.id : undefined,
      packageTitleAr: newPkgTitle,
      totalSessions: newSessionsCount,
      amountEgp: Number(newFeeEgp) || 0,
    });
    setEnrollMsg({ ok: res.ok, msg: res.messageAr });
    if (res.ok && res.ledger) {
      setSelectedLedgerId(res.ledger.id);
      setNewAthleteName("");
      setShowEnrollForm(false);
    }
  };

  const activeCount = roleLedgers.filter((l) => l.status === "active").length;
  const renewalCount = roleLedgers.filter((l) => l.status === "renewal_due").length;
  const totalCheckinsDone = roleLedgers.reduce((sum, l) => sum + l.completedSessions, 0);

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[1220px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        {/* Top Offline PWA Status Strip */}
        <section className="rounded-2xl bg-dark-slate text-surface-card p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                effectiveOffline ? "bg-amber-400 text-dark-slate" : "bg-deep-carbon text-electric-volt"
              }`}
            >
              <Icon name={effectiveOffline ? "wifi_off" : "qr_code_2"} className="text-[20px]" />
            </div>
            <div>
              <h1 className="font-card-title text-surface-card">
                {isCoach
                  ? "دفاتر حصص المتدربين والسباحين (QR Ledger)"
                  : isFacility
                  ? "دفاتر حصص المشتركين في المنشأة (QR Ledger)"
                  : "دفتر الحصص الرقمي والأوفلاين PWA (QR Ledger)"}
              </h1>
              <p className="text-xs text-surface-container-high mt-0.5">
                {effectiveOffline
                  ? "أنت الآن في وضع الأوفلاين — أي حصة تُسجّل الآن تُحفظ محلياً وتُزامَن تلقائياً عند عودة الشبكة."
                  : isProvider
                  ? "لكل سباح أو عميل دفتر حصص مستقل برقم تعريفي وباركود خاص؛ يمكنك إضافة أي مشترك بكود العضوية أو خصم الحصة بالـ QR / PIN."
                  : "كل اشتراك مع كابتن أو أكاديمية — أو لكل ابن — له دفتر حصص مستقل وكود QR يعمل حتى داخل المسابح المغطاة بدون إنترنت."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {pendingOfflineCount > 0 && (
              <button
                type="button"
                onClick={() => syncOfflineQueue()}
                className="px-4 py-2 rounded-full bg-electric-volt text-dark-slate text-xs font-bold"
              >
                مزامنة {pendingOfflineCount} حصة محفوظة أوفلاين ↻
              </button>
            )}
            <button
              type="button"
              onClick={toggleOfflineSimulation}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                isOfflineSimulated
                  ? "bg-amber-400 text-dark-slate"
                  : "bg-white/10 text-surface-card hover:bg-white/20"
              }`}
            >
              {isOfflineSimulated ? "إيقاف محاكاة انقطاع النت" : "تجربة وضع بدون نت بالمسبح (Offline)"}
            </button>
          </div>
        </section>

        {/* Unlinked Member State vs Multi-Ledger Directory */}
        {roleLedgers.length === 0 && !isProvider ? (
          <section className="bg-surface-card rounded-[24px] p-8 md:p-12 shadow-sm border border-surface-container grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="inline-flex items-center gap-2 text-deep-olive font-extrabold text-xs w-fit">
                <Icon name="qr_code_2" className="text-[16px]" />
                <span>جاهز للتفعيل مع كابتنك أو أكاديميتك</span>
              </div>

              <h2 className="font-hero-headline text-[26px] md:text-[32px] text-dark-slate leading-[1.38]">
                دفتر الحصص الرقمي يُفعّل لكل اشتراك مع كابتن أو أكاديمية موثقة
              </h2>
              <p className="font-body-default text-text-muted leading-relaxed">
                أنت الآن مسجل بحساب <strong className="text-dark-slate">{currentPersona.fullNameAr}</strong> ولا توجد باقات نشطة مرتبطة بكودك بعد. بمجرد اشتراكك وإعطاء كود عضويتك للكابتن أو إدارة المنشأة، سيظهر لك هنا دفتر حصص منفصل لكل باقة أو لكل فرد في الأسرة.
              </p>

              <div className="rounded-2xl bg-surface-snow p-5 border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-text-muted">كود عضويتك الفريد ({currentPersona.fullNameAr})</span>
                  <div className="text-2xl md:text-3xl font-mono font-black text-deep-olive tracking-wider mt-1">
                    {memberCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyMemberCode}
                  className="px-5 py-2.5 rounded-full bg-dark-slate text-electric-volt font-badge-label text-xs flex items-center gap-2 shrink-0 w-fit"
                >
                  <Icon name={copiedCode ? "check" : "content_copy"} className="text-[16px]" />
                  <span>{copiedCode ? "تم النسخ ✓" : "نسخ كود العضوية"}</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                <Link
                  href="/explore"
                  className="px-5 py-2.5 rounded-full bg-dark-slate text-electric-volt font-badge-label text-xs hover:opacity-95"
                >
                  استكشف المسابح والأكاديميات ←
                </Link>
                <Link
                  href="/dashboard/athlete"
                  className="px-5 py-2.5 rounded-full bg-surface-snow text-dark-slate border border-surface-container font-badge-label text-xs hover:bg-lime-tint/40"
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
                  className="px-5 py-2.5 rounded-full bg-lime-tint text-deep-olive border border-deep-olive/25 font-badge-label text-xs hover:brightness-95 inline-flex items-center gap-1.5"
                >
                  <Icon name="sync" className={`text-[15px] ${syncingCloud ? "animate-spin" : ""}`} />
                  <span>{syncingCloud ? "جاري فحص التفعيل..." : "تحديث الدفاتر من السحابة"}</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col items-center justify-center gap-3 bg-surface-snow rounded-2xl p-6">
              <QrCodeBox value={`CAP-MEMBER:${memberCode}`} size={180} label={memberCode} />
              <span className="text-xs text-text-muted text-center max-w-xs">
                امسح أو شارك كود عضويتك مع الكابتن أو إدارة المدرسة لتفعيل الباقة (8 أو 12 أو 24 حصة)
              </span>
            </div>
          </section>
        ) : (
          <div className="flex flex-col gap-space-lg">
            {/* Multi-Swimmer / Multi-Client Directory Section */}
            <section className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-surface-container flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-section-title text-dark-slate">
                      {isProvider
                        ? `سجل دفاتر السباحين والعملاء (${roleLedgers.length})`
                        : `دفاتر الحصص المرتبطة بحسابك (${roleLedgers.length})`}
                    </h2>
                    {isProvider && (
                      <span className="text-xs font-extrabold text-deep-olive">
                        • {activeCount} باقات نشطة {renewalCount > 0 ? `• ${renewalCount} قريبة من التجديد` : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {isProvider
                      ? "اختر أي متدرب أو عميل من القائمة لعرض باركود الحضور أو تسجيل حصة جديدة له، أو أضف متدرباً جديداً بكود العضوية."
                      : "كل باقة أو فرد لديه دفتر حصص مستقل برصيده وسجل حضوره وباركوده الخاص."}
                  </p>
                </div>

                {isProvider && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isFacility && (
                      <div className="inline-flex rounded-full bg-surface-snow p-1 border border-surface-container">
                        <button
                          type="button"
                          onClick={() => setFacilityScope("mine")}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                            facilityScope === "mine"
                              ? "bg-dark-slate text-electric-volt"
                              : "text-text-muted hover:text-dark-slate"
                          }`}
                        >
                          منشأتي ({facilityOwnCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFacilityScope("all")}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                            facilityScope === "all"
                              ? "bg-dark-slate text-electric-volt"
                              : "text-text-muted hover:text-dark-slate"
                          }`}
                        >
                          كل المنشآت ({sessionLedgers.length})
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-deep-olive text-white text-xs font-bold hover:brightness-105 shadow-sm"
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
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface-snow text-dark-slate border border-surface-container text-xs font-bold hover:bg-lime-tint/50 disabled:opacity-60"
                    >
                      <Icon name="sync" className={`text-[15px] ${syncingCloud ? "animate-spin" : ""}`} />
                      <span>{syncingCloud ? "جاري المزامنة..." : "مزامنة السحابة"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowEnrollForm((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold hover:opacity-95 shadow-sm"
                    >
                      <Icon name={showEnrollForm ? "close" : "add"} className="text-[16px]" />
                      <span>{showEnrollForm ? "إغلاق النموذج" : "إضافة دفتر / مشترك جديد"}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Provider Stats Row */}
              {isProvider && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-surface-snow px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-text-muted font-bold">إجمالي الدفاتر</span>
                    <span className="text-xl font-black text-dark-slate">{roleLedgers.length}</span>
                  </div>
                  <div className="rounded-xl bg-surface-snow px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-text-muted font-bold">باقات نشطة</span>
                    <span className="text-xl font-black text-deep-olive">{activeCount}</span>
                  </div>
                  <div className="rounded-xl bg-surface-snow px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-text-muted font-bold">قريبة من التجديد</span>
                    <span className="text-xl font-black text-amber-700">{renewalCount}</span>
                  </div>
                  <div className="rounded-xl bg-surface-snow px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-text-muted font-bold">حصص تم توثيقها</span>
                    <span className="text-xl font-black text-dark-slate">{totalCheckinsDone}</span>
                  </div>
                </div>
              )}

              {/* Enroll Feedback */}
              {enrollMsg && (
                <div
                  className={`rounded-xl px-4 py-3 text-xs font-bold flex items-center justify-between ${
                    enrollMsg.ok ? "bg-lime-tint text-deep-olive" : "bg-red-50 text-red-900"
                  }`}
                >
                  <span>{enrollMsg.msg}</span>
                  <button type="button" onClick={() => setEnrollMsg(null)} className="underline">
                    إخفاء
                  </button>
                </div>
              )}

              {/* Inline Add Swimmer / Client Form for Provider */}
              {isProvider && showEnrollForm && (
                <form
                  onSubmit={handleQuickEnroll}
                  className="rounded-2xl bg-surface-snow p-5 border border-deep-olive/25 flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-card-title-sm text-dark-slate">
                      تفعيل دفتر حصص لسباح أو عميل جديد بكود العضوية
                    </h3>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="text-text-muted">أكواد سريعة:</span>
                      {memberRegistry.slice(0, 4).map((m) => (
                        <button
                          key={m.memberCode}
                          type="button"
                          onClick={() => {
                            setNewMemberCode(m.memberCode);
                            setNewAthleteName(m.fullNameAr);
                          }}
                          className="px-2 py-0.5 rounded-full bg-surface-card border border-surface-container font-mono font-bold text-deep-olive hover:bg-lime-tint"
                        >
                          {m.memberCode} ({m.fullNameAr.split(" ")[0]})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-dark-slate">كود العضوية *</label>
                      <input
                        required
                        value={newMemberCode}
                        onChange={(e) => setNewMemberCode(e.target.value)}
                        placeholder="CAP-M-XXXX"
                        className="rounded-xl bg-white px-3 py-2 font-mono text-xs outline-none border border-surface-container"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-dark-slate">اسم السباح / العميل</label>
                      <input
                        value={newAthleteName}
                        onChange={(e) => setNewAthleteName(e.target.value)}
                        placeholder={matchedEnrollMember?.fullNameAr || "تلقائي من الكود أو اكتب الاسم"}
                        className="rounded-xl bg-white px-3 py-2 text-xs outline-none border border-surface-container"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-dark-slate">المنشأة</label>
                      <select
                        value={newFacilityId}
                        onChange={(e) => setNewFacilityId(e.target.value)}
                        className="rounded-xl bg-white px-3 py-2 text-xs outline-none border border-surface-container"
                      >
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nameAr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-dark-slate">اسم الباقة والحصص</label>
                      <div className="flex gap-1.5">
                        <input
                          value={newPkgTitle}
                          onChange={(e) => setNewPkgTitle(e.target.value)}
                          className="flex-1 min-w-0 rounded-xl bg-white px-2.5 py-2 text-xs outline-none border border-surface-container"
                        />
                        <select
                          value={newSessionsCount}
                          onChange={(e) => setNewSessionsCount(Number(e.target.value) as 8 | 12 | 24)}
                          className="w-20 rounded-xl bg-white px-2 py-2 text-xs outline-none border border-surface-container"
                        >
                          <option value={8}>8</option>
                          <option value={12}>12</option>
                          <option value={24}>24</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-dark-slate">الرسوم ج.م وتفعيل</label>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          value={newFeeEgp}
                          onChange={(e) => setNewFeeEgp(e.target.value)}
                          className="w-20 rounded-xl bg-white px-2.5 py-2 text-xs outline-none border border-surface-container"
                        />
                        <button
                          type="submit"
                          className="flex-1 rounded-xl bg-deep-olive text-white font-bold text-xs px-3 py-2 hover:brightness-110"
                        >
                          إضافة ✓
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* Search & Status Filters for Providers */}
              {isProvider && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center bg-surface-snow rounded-full px-3.5 py-2 border border-surface-container flex-1 max-w-md">
                    <Icon name="search" className="text-text-muted text-[16px] ml-2 shrink-0" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث باسم السباح، المنشأة، أو رقم الدفتر..."
                      className="w-full bg-transparent text-xs outline-none text-dark-slate"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "all", label: `الكل (${roleLedgers.length})` },
                      { id: "active", label: "نشط" },
                      { id: "renewal_due", label: "تحتاج تجديد" },
                      { id: "completed", label: "مكتملة" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                          statusFilter === tab.id
                            ? "bg-deep-olive text-white"
                            : "bg-surface-snow text-text-muted hover:text-dark-slate"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Swimmers / Clients Cards Directory */}
              {filteredLedgers.length === 0 ? (
                <div className="rounded-xl bg-surface-snow p-6 text-center text-xs text-text-muted">
                  لا توجد دفاتر مطابقة لفلتر البحث الحالي.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredLedgers.map((l) => {
                    const isSelected = activeLedger?.id === l.id;
                    const pct = Math.min(100, Math.round((l.completedSessions / l.totalSessions) * 100));
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          setSelectedLedgerId(l.id);
                          setCheckinMsg(null);
                        }}
                        className={`text-right rounded-2xl p-4 transition-all border flex flex-col gap-2.5 ${
                          isSelected
                            ? "bg-lime-tint/35 border-deep-olive shadow-sm ring-1 ring-deep-olive/30"
                            : "bg-surface-snow border-surface-container hover:border-deep-olive/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-card-title-sm text-dark-slate truncate">
                              {l.athleteNameAr}
                            </div>
                            <div className="text-[11px] text-text-muted truncate mt-0.5">
                              {l.facilityNameAr}
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-extrabold shrink-0 ${
                              l.status === "completed"
                                ? "text-text-muted"
                                : l.status === "renewal_due"
                                ? "text-amber-700"
                                : "text-deep-olive"
                            }`}
                          >
                            {l.status === "completed"
                              ? "مكتملة"
                              : l.status === "renewal_due"
                              ? "قارب الانتهاء"
                              : "نشط ✓"}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-dark-slate/85 truncate">
                          {l.packageTitleAr}
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="h-1.5 w-full rounded-full bg-surface-container overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                l.status === "renewal_due"
                                  ? "bg-amber-600"
                                  : l.status === "completed"
                                  ? "bg-dark-slate"
                                  : "bg-deep-olive"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-text-muted">{l.ledgerCode} • PIN {l.pinCode}</span>
                            <span className="font-extrabold text-deep-olive">
                              {l.completedSessions} / {l.totalSessions} حصص
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Active Selected Ledger Detail View */}
            {activeLedger && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
                {/* Left Main Ledger & Attendance Control */}
                <div className="lg:col-span-7 flex flex-col gap-5">
                  <section className="bg-surface-card rounded-[20px] p-6 md:p-8 shadow-sm border border-surface-container flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-extrabold ${
                              activeLedger.status === "completed"
                                ? "text-text-muted"
                                : activeLedger.status === "renewal_due"
                                ? "text-amber-700"
                                : "text-deep-olive"
                            }`}
                          >
                            {activeLedger.status === "completed"
                              ? "الباقة مكتملة"
                              : activeLedger.status === "renewal_due"
                              ? "تنبيه: متبقي حصتان أو أقل"
                              : "باقة نشطة ✓"}
                          </span>
                          <span className="font-mono text-xs text-text-muted">• {activeLedger.ledgerCode}</span>
                        </div>
                        <h2 className="font-section-title text-dark-slate mt-1.5">
                          {activeLedger.athleteNameAr}
                        </h2>
                        <p className="text-xs text-text-muted mt-0.5">
                          {activeLedger.packageTitleAr} — {activeLedger.facilityNameAr} • {activeLedger.coachNameAr}
                        </p>
                      </div>

                      <div className="text-right sm:text-left shrink-0">
                        <div className="text-3xl font-black text-deep-olive">
                          {activeLedger.completedSessions} / {activeLedger.totalSessions}
                        </div>
                        <div className="text-xs text-text-muted">حصة مكتملة</div>
                      </div>
                    </div>

                    {/* Progress Circles */}
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {Array.from({ length: activeLedger.totalSessions }, (_, idx) => {
                        const num = idx + 1;
                        const done = num <= activeLedger.completedSessions;
                        return (
                          <div
                            key={num}
                            className={`h-12 rounded-xl flex flex-col items-center justify-center font-bold text-xs border ${
                              done
                                ? "bg-lime-tint border-deep-olive text-deep-olive"
                                : "bg-surface-snow border-surface-container text-text-muted"
                            }`}
                          >
                            <span>{done ? "✓" : num}</span>
                            <span className="text-[10px]">حصة {num}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Check-in Interactive Box */}
                    <div className="rounded-2xl bg-surface-snow p-5 flex flex-col gap-3">
                      <div className="font-card-title-sm text-dark-slate">
                        {isProvider
                          ? `تسجيل حضور ${activeLedger.athleteNameAr} وخصم الحصة (${effectiveOffline ? "أوفلاين" : "متصل"})`
                          : `تسجيل وخصم الحصة الحالية (${effectiveOffline ? "وضع أوفلاين" : "متصل"})`}
                      </div>

                      {checkinMsg && (
                        <div
                          className={`p-3 rounded-xl text-xs font-bold ${
                            checkinMsg.ok ? "bg-lime-tint text-deep-olive" : "bg-red-50 text-red-800"
                          }`}
                        >
                          {checkinMsg.msg}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value)}
                          placeholder={`كود الـ PIN (${activeLedger.pinCode})`}
                          className="rounded-xl bg-white px-3.5 py-2.5 text-sm outline-none border border-surface-container"
                        />
                        <input
                          value={coachNote}
                          onChange={(e) => setCoachNote(e.target.value)}
                          placeholder="ملاحظة الحصة (اختياري)"
                          className="rounded-xl bg-white px-3.5 py-2.5 text-sm outline-none border border-surface-container"
                        />
                        <button
                          type="button"
                          disabled={activeLedger.completedSessions >= activeLedger.totalSessions}
                          onClick={() => {
                            const res = checkInSession(
                              activeLedger.id,
                              pinInput || activeLedger.pinCode,
                              pinInput ? "pin_4digit" : "qr_scan",
                              coachNote
                            );
                            setCheckinMsg({ ok: res.ok, msg: res.messageAr });
                            if (res.ok) {
                              setPinInput("");
                              setCoachNote("");
                            }
                          }}
                          className="py-2.5 px-4 rounded-xl bg-dark-slate text-electric-volt font-bold text-xs hover:opacity-95 disabled:opacity-40"
                        >
                          {isProvider ? "خصم حصة بالـ QR / PIN ✓" : "تأكيد الحضور بمسح QR / PIN ✓"}
                        </button>
                      </div>
                    </div>

                    {/* History */}
                    <div className="flex flex-col gap-2">
                      <h3 className="font-card-title-sm text-dark-slate">سجل الحصص الموثق</h3>
                      {activeLedger.checkins.length === 0 ? (
                        <p className="text-xs text-text-muted">لم تُسجّل أي حصة بعد في هذه الباقة.</p>
                      ) : (
                        activeLedger.checkins.map((c) => (
                          <div
                            key={c.sessionNumber}
                            className="rounded-xl bg-surface-snow px-4 py-3 flex items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-bold text-dark-slate">حصة #{c.sessionNumber}</span>
                              <span className="text-text-muted mx-2">•</span>
                              <span className="text-text-muted">{c.coachNoteAr}</span>
                            </div>
                            <span
                              className={`text-xs font-bold ${
                                c.wasOffline ? "text-amber-700" : "text-deep-olive"
                              }`}
                            >
                              {c.dateAr}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>

                {/* Right Sidebar: Live Scannable QR & InstaPay Archive */}
                <aside className="lg:col-span-5 flex flex-col gap-5">
                  <div className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-surface-container flex flex-col items-center text-center gap-3">
                    <h3 className="font-card-title text-dark-slate">
                      {isProvider
                        ? `باركود المتدرب: ${activeLedger.athleteNameAr}`
                        : "كارت الـ QR السريع داخل صالة المسبح"}
                    </h3>
                    <QrCodeBox
                      value={`CAP-QR:${activeLedger.ledgerCode}:${activeLedger.pinCode}`}
                      size={180}
                      label={`PIN: ${activeLedger.pinCode}`}
                    />
                    <p className="text-xs text-text-muted max-w-xs">
                      {isProvider
                        ? `امسح هذا الباركود من هاتف «${activeLedger.athleteNameAr}» أو استخدم كود الـ PIN (${activeLedger.pinCode}) لتأكيد الحضور أوفلاين.`
                        : "أظهر هذا الباركود للكابتن أو إدارة المدرسة عند النزول للحوض لخصم الحصة فورياً (يعمل بدون إنترنت)."}
                    </p>
                  </div>

                  <div className="bg-surface-card rounded-[20px] p-6 shadow-sm border border-surface-container flex flex-col gap-4">
                    <h3 className="font-card-title text-dark-slate">
                      أرشيف إيصالات الدفع المباشر (InstaPay / كاش)
                    </h3>
                    <div className="flex flex-col gap-2">
                      {activeLedger.receipts.map((r) => (
                        <div key={r.id} className="rounded-xl bg-surface-snow p-3 flex justify-between text-xs">
                          <div>
                            <div className="font-bold text-dark-slate">{r.channel}</div>
                            <div className="text-text-muted font-mono">مرجع: {r.referenceNumber}</div>
                          </div>
                          <div className="font-bold text-deep-olive">{r.amountEgp} ج.م</div>
                        </div>
                      ))}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!receiptRef.trim()) return;
                        uploadInstaPayReceipt(activeLedger.id, {
                          referenceNumber: receiptRef.trim(),
                          channel: receiptChannel,
                          amountEgp: Number(receiptAmount) || 0,
                          packageTitleAr: activeLedger.packageTitleAr,
                        });
                        setReceiptRef("");
                        setReceiptSaved(true);
                        setTimeout(() => setReceiptSaved(false), 2500);
                      }}
                      className="flex flex-col gap-2.5 pt-2 border-t border-surface-container"
                    >
                      <div className="text-xs font-bold text-dark-slate">إرفاق مرجع تحويل جديد</div>
                      <input
                        required
                        value={receiptRef}
                        onChange={(e) => setReceiptRef(e.target.value)}
                        placeholder="رقم مرجع إنستاباي أو فودافون كاش"
                        className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={receiptChannel}
                          onChange={(e) =>
                            setReceiptChannel(
                              e.target.value as "إنستاباي (InstaPay)" | "فودافون كاش (Vodafone Cash)"
                            )
                          }
                          className="rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
                        >
                          <option value="إنستاباي (InstaPay)">InstaPay</option>
                          <option value="فودافون كاش (Vodafone Cash)">Vodafone Cash</option>
                        </select>
                        <input
                          type="number"
                          value={receiptAmount}
                          onChange={(e) => setReceiptAmount(e.target.value)}
                          className="rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-full bg-deep-olive text-white font-bold text-xs"
                      >
                        حفظ الإيصال في السجل الدائم
                      </button>
                      {receiptSaved && (
                        <span className="text-xs font-bold text-deep-olive text-center">
                          ✓ تم توثيق الإيصال في أرشيفك بنجاح
                        </span>
                      )}
                    </form>
                  </div>
                </aside>
              </div>
            )}
          </div>
        )}
      </div>

      <QrCameraScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onLedgerCheckedIn={(ledgerId, messageAr) => {
          setSelectedLedgerId(ledgerId);
          setCheckinMsg({ ok: true, msg: messageAr });
        }}
        onMemberDetectedForEnroll={({ memberCode: detectedCode, athleteNameAr }) => {
          setShowEnrollForm(true);
          setNewMemberCode(detectedCode);
          if (athleteNameAr) setNewAthleteName(athleteNameAr);
          setEnrollMsg({
            ok: true,
            msg: `تم التقاط كود العضوية ${detectedCode}${athleteNameAr ? ` (${athleteNameAr})` : ""} — اختر الباقة واضغط تفعيل لتشغيل الـ QR على جهاز السباح مباشرة.`,
          });
        }}
      />
    </div>
  );
}
