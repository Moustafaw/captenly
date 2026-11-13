"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { QrCodeBox } from "@/components/editorial/QrCodeBox";

export default function Phone5() {
  const {
    currentPersona,
    switchPersona,
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
  } = useCaptenly();

  const isCoach = currentPersona.role === "coach";
  const isFacility = currentPersona.role === "facility_manager";
  const isProvider = isCoach || isFacility;
  const linkedFacilityId = currentPersona.linkedFacilityId || facilities[0]?.id || "";

  const [facilityScope, setFacilityScope] = useState<"mine" | "all">("mine");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "renewal_due" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEnrollForm, setShowEnrollForm] = useState(false);

  const [newMemberCode, setNewMemberCode] = useState("CAP-M-5190");
  const [newAthleteName, setNewAthleteName] = useState("");
  const [newFacilityId, setNewFacilityId] = useState(linkedFacilityId);
  const [newSessionsCount, setNewSessionsCount] = useState<8 | 12 | 24>(8);
  const [newFeeEgp, setNewFeeEgp] = useState("750");

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
        const hay = `${l.athleteNameAr} ${l.facilityNameAr} ${l.packageTitleAr} ${l.ledgerCode}`.toLowerCase();
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
  const [amountEgp, setAmountEgp] = useState("750");

  const memberCode = currentPersona.memberCode || "CAP-M-5190";
  const pendingOfflineCount = offlineQueue.filter((q) => !q.synced).length;

  const matchedEnrollMember = useMemo(
    () =>
      memberRegistry.find(
        (m) => m.memberCode.toUpperCase() === newMemberCode.trim().toUpperCase()
      ),
    [memberRegistry, newMemberCode]
  );

  const copyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(memberCode).catch(() => undefined);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-on-surface min-h-screen px-margin pt-4 pb-24 flex flex-col gap-4">
      {/* Offline Mode Mobile Bar */}
      <div className="rounded-2xl bg-dark-slate text-surface-card p-4 shadow-md flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon
              name={effectiveOffline ? "wifi_off" : "qr_code_2"}
              className={`shrink-0 ${effectiveOffline ? "text-amber-300" : "text-electric-volt"}`}
            />
            <span className="font-card-title-sm text-sm truncate">
              {isCoach
                ? "دفاتر المتدربين (QR)"
                : isFacility
                ? "دفاتر مشتركين المنشأة"
                : "دفتر الحصص الـ QR أوفلاين"}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleOfflineSimulation}
            className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 ${
              isOfflineSimulated ? "bg-amber-400 text-dark-slate" : "bg-white/15 text-white"
            }`}
          >
            {isOfflineSimulated ? "أوفلاين ✓" : "محاكاة بدون نت"}
          </button>
        </div>
        <p className="text-[11px] text-surface-container-high leading-relaxed">
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
            className="w-full py-2 rounded-full bg-electric-volt text-dark-slate text-xs font-bold"
          >
            مزامنة {pendingOfflineCount} حصة محفوظة أوفلاين ↻
          </button>
        )}
      </div>

      {roleLedgers.length === 0 && !isProvider ? (
        <section className="bg-surface-card rounded-2xl p-5 shadow-sm border border-surface-container flex flex-col items-center text-center gap-4">
          <span className="text-deep-olive text-[11px] font-extrabold">
            جاهز للتفعيل مع كابتنك أو أكاديميتك
          </span>
          <h1 className="font-section-title-mobile text-dark-slate leading-snug">
            دفتر الحصص الرقمي يُفعّل تلقائياً لكل اشتراك مع كابتن أو أكاديمية موثقة
          </h1>
          <p className="text-xs text-text-muted leading-relaxed">
            أنت الآن بحساب <strong className="text-dark-slate">{currentPersona.fullNameAr}</strong> ولا توجد باقات نشطة بعد. شارك كود عضويتك مع الكابتن لتفعيل الـ QR أو استعرض حسابات متعددة الدفاتر أدناه:
          </p>

          <QrCodeBox value={`CAP-MEMBER:${memberCode}`} size={160} label={memberCode} />

          <div className="w-full rounded-xl bg-surface-snow p-3.5 flex items-center justify-between gap-2">
            <div className="text-right">
              <div className="text-[10px] text-text-muted">كود عضويتك</div>
              <div className="font-mono font-black text-lg text-deep-olive">{memberCode}</div>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="px-4 py-2 rounded-full bg-dark-slate text-electric-volt text-xs font-bold shrink-0"
            >
              {copied ? "تم النسخ ✓" : "نسخ الكود"}
            </button>
          </div>

          <div className="w-full flex flex-col gap-2">
            <button
              type="button"
              onClick={() => switchPersona("persona-coach")}
              className="w-full py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
            >
              تجربة حساب الكابتن ({sessionLedgers.length} متدربين)
            </button>
            <button
              type="button"
              onClick={() => switchPersona("persona-facility")}
              className="w-full py-2.5 rounded-full bg-lime-tint text-deep-olive text-xs font-bold"
            >
              تجربة إدارة المنشأة ({facilityOwnCount} دفاتر)
            </button>
            <button
              type="button"
              onClick={() => switchPersona("persona-parent")}
              className="w-full py-2.5 rounded-full bg-surface-snow text-dark-slate text-xs font-bold border border-surface-container"
            >
              تجربة حساب الأسرة (طفلان — دفتران)
            </button>
            <Link
              href="/dashboard/coach"
              className="w-full py-2.5 rounded-full bg-surface-card border border-deep-olive/30 text-deep-olive text-xs font-bold text-center"
            >
              تفعيل كودك من لوحة الكابتن ←
            </Link>
          </div>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Multi-Ledger Swimmers Directory */}
          <section className="bg-surface-card rounded-2xl p-4 shadow-sm border border-surface-container flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-card-title-sm text-sm text-dark-slate">
                  {isProvider
                    ? `سجل السباحين والعملاء (${roleLedgers.length})`
                    : `دفاتري النشطة (${roleLedgers.length})`}
                </h2>
                <p className="text-[11px] text-text-muted">
                  اختر متدرباً لعرض باركوده أو تسجيل حضوره
                </p>
              </div>
              {isProvider && (
                <button
                  type="button"
                  onClick={() => setShowEnrollForm((v) => !v)}
                  className="px-3 py-1.5 rounded-full bg-dark-slate text-electric-volt text-[11px] font-bold shrink-0"
                >
                  {showEnrollForm ? "إغلاق" : "+ مشترك جديد"}
                </button>
              )}
            </div>

            {isFacility && (
              <div className="grid grid-cols-2 gap-1.5 bg-surface-snow p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFacilityScope("mine")}
                  className={`py-1.5 rounded-lg text-[11px] font-bold ${
                    facilityScope === "mine" ? "bg-dark-slate text-electric-volt" : "text-text-muted"
                  }`}
                >
                  منشأتي ({facilityOwnCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFacilityScope("all")}
                  className={`py-1.5 rounded-lg text-[11px] font-bold ${
                    facilityScope === "all" ? "bg-dark-slate text-electric-volt" : "text-text-muted"
                  }`}
                >
                  كل المنشآت ({sessionLedgers.length})
                </button>
              </div>
            )}

            {/* Inline Quick Enroll on Mobile */}
            {isProvider && showEnrollForm && (
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
                    amountEgp: Number(newFeeEgp) || 750,
                  });
                  setMsg({ ok: res.ok, text: res.messageAr });
                  if (res.ok && res.ledger) {
                    setSelectedId(res.ledger.id);
                    setNewAthleteName("");
                    setShowEnrollForm(false);
                  }
                }}
                className="rounded-xl bg-surface-snow p-3 border border-deep-olive/25 flex flex-col gap-2"
              >
                <div className="text-xs font-bold text-dark-slate">إضافة سباح بكود العضوية</div>
                <input
                  required
                  value={newMemberCode}
                  onChange={(e) => setNewMemberCode(e.target.value)}
                  placeholder="كود العضوية (مثال: CAP-M-5190)"
                  className="rounded-xl bg-white px-3 py-2 font-mono text-xs outline-none border border-surface-container"
                />
                <input
                  value={newAthleteName}
                  onChange={(e) => setNewAthleteName(e.target.value)}
                  placeholder={matchedEnrollMember?.fullNameAr || "اسم السباح (تلقائي أو اكتب الاسم)"}
                  className="rounded-xl bg-white px-3 py-2 text-xs outline-none border border-surface-container"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newSessionsCount}
                    onChange={(e) => setNewSessionsCount(Number(e.target.value) as 8 | 12 | 24)}
                    className="rounded-xl bg-white px-2.5 py-2 text-xs outline-none border border-surface-container"
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
                    className="rounded-xl bg-white px-2.5 py-2 text-xs outline-none border border-surface-container"
                  />
                </div>
                <select
                  value={newFacilityId}
                  onChange={(e) => setNewFacilityId(e.target.value)}
                  className="rounded-xl bg-white px-2.5 py-2 text-xs outline-none border border-surface-container"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nameAr}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-full bg-deep-olive text-white text-xs font-bold"
                >
                  حفظ وتفعيل الدفتر فوراً ✓
                </button>
              </form>
            )}

            {isProvider && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center bg-surface-snow rounded-xl px-3 py-2 border border-surface-container">
                  <Icon name="search" className="text-text-muted text-[15px] ml-2 shrink-0" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم السباح أو المنشأة..."
                    className="w-full bg-transparent text-xs outline-none"
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
                      className={`py-1.5 rounded-lg text-[11px] font-bold ${
                        statusFilter === tab.id
                          ? "bg-deep-olive text-white"
                          : "bg-surface-snow text-text-muted"
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
                        ? "bg-lime-tint/35 border-deep-olive ring-1 ring-deep-olive/30"
                        : "bg-surface-snow border-surface-container"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-dark-slate truncate">
                        {l.athleteNameAr}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold shrink-0 ${
                          l.status === "completed"
                            ? "text-text-muted"
                            : l.status === "renewal_due"
                            ? "text-amber-700"
                            : "text-deep-olive"
                        }`}
                      >
                        {l.completedSessions}/{l.totalSessions} حصص
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted truncate">{l.facilityNameAr}</div>
                    <div className="h-1.5 w-full rounded-full bg-surface-container overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          l.status === "renewal_due"
                            ? "bg-amber-600"
                            : l.status === "completed"
                            ? "bg-dark-slate"
                            : "bg-deep-olive"
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
              <div className="bg-surface-card rounded-2xl p-5 shadow-sm border border-surface-container flex flex-col items-center text-center gap-3">
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-[11px] font-extrabold ${
                      activeLedger.status === "renewal_due"
                        ? "text-amber-700"
                        : activeLedger.status === "completed"
                        ? "text-text-muted"
                        : "text-deep-olive"
                    }`}
                  >
                    {activeLedger.status === "completed"
                      ? "باقة مكتملة"
                      : activeLedger.status === "renewal_due"
                      ? `متبقي ${activeLedger.totalSessions - activeLedger.completedSessions} حصص`
                      : `باقة نشطة (${activeLedger.completedSessions}/${activeLedger.totalSessions})`}
                  </span>
                  <span className="font-mono text-[11px] text-text-muted">{activeLedger.ledgerCode}</span>
                </div>

                <h2 className="font-card-title text-dark-slate">{activeLedger.athleteNameAr}</h2>
                <p className="text-xs text-text-muted">
                  {activeLedger.packageTitleAr} • {activeLedger.facilityNameAr}
                </p>

                <QrCodeBox
                  value={`CAP-QR:${activeLedger.ledgerCode}:${activeLedger.pinCode}`}
                  size={165}
                  label={`PIN: ${activeLedger.pinCode}`}
                />

                <p className="text-[11px] text-text-muted max-w-xs">
                  {isProvider
                    ? `امسح هذا الباركود عند حضور «${activeLedger.athleteNameAr}» أو أدخل الـ PIN (${activeLedger.pinCode}).`
                    : "أظهر هذا الباركود للكابتن أو إدارة المدرسة عند النزول للحوض."}
                </p>

                <div className="grid grid-cols-4 gap-2 w-full pt-1">
                  {Array.from({ length: activeLedger.totalSessions }, (_, idx) => {
                    const n = idx + 1;
                    const done = n <= activeLedger.completedSessions;
                    return (
                      <div
                        key={n}
                        className={`py-2 rounded-xl text-[11px] font-bold border ${
                          done
                            ? "bg-lime-tint border-deep-olive text-deep-olive"
                            : "bg-surface-snow border-surface-container text-text-muted"
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
                      msg.ok ? "bg-lime-tint text-deep-olive" : "bg-red-50 text-red-900"
                    }`}
                  >
                    {msg.text}
                  </div>
                )}

                <div className="w-full flex flex-col gap-2 pt-1">
                  <input
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder={`كود الـ PIN (${activeLedger.pinCode}) أو اضغط مباشرة لمسح QR`}
                    className="w-full rounded-xl bg-surface-snow px-3.5 py-2.5 text-xs outline-none border border-surface-container text-center"
                  />
                  <button
                    type="button"
                    disabled={activeLedger.completedSessions >= activeLedger.totalSessions}
                    onClick={() => {
                      const res = checkInSession(
                        activeLedger.id,
                        pinInput || activeLedger.pinCode,
                        pinInput ? "pin_4digit" : "qr_scan",
                        isProvider ? "خصم حضور من لوحة الكابتن/المنشأة" : "حضور من الموبايل بالمسبح"
                      );
                      setMsg({ ok: res.ok, text: res.messageAr });
                      if (res.ok) setPinInput("");
                    }}
                    className="w-full py-3 rounded-full bg-dark-slate text-electric-volt text-xs font-bold shadow disabled:opacity-40"
                  >
                    {isProvider ? "خصم حصة للسباح بالـ QR / PIN ✓" : "تأكيد الحضور بمسح QR / PIN الآن ✓"}
                  </button>
                </div>
              </div>

              {/* Checkin Log */}
              <div className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                <h3 className="font-card-title-sm text-sm text-dark-slate">
                  سجل الحصص ({activeLedger.checkins.length})
                </h3>
                {activeLedger.checkins.length === 0 ? (
                  <p className="text-xs text-text-muted">لم تُسجّل حصص في هذه الباقة بعد.</p>
                ) : (
                  activeLedger.checkins.map((c) => (
                    <div key={c.sessionNumber} className="rounded-xl bg-surface-snow p-3 text-xs flex justify-between gap-2">
                      <span className="font-bold text-dark-slate">حصة #{c.sessionNumber}</span>
                      <span className="text-text-muted">{c.dateAr}</span>
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
                    amountEgp: Number(amountEgp) || 750,
                    packageTitleAr: activeLedger.packageTitleAr,
                  });
                  setRefNum("");
                  setMsg({ ok: true, text: "✓ تم حفظ مرجع إيصال إنستاباي في الأرشيف بنجاح." });
                }}
                className="bg-surface-card rounded-2xl p-4 shadow-sm flex flex-col gap-2.5"
              >
                <h3 className="font-card-title-sm text-sm text-dark-slate">
                  أرشيف إيصالات الدفع ({activeLedger.receipts.length})
                </h3>
                {activeLedger.receipts.map((r) => (
                  <div key={r.id} className="rounded-xl bg-surface-snow px-3 py-2 flex justify-between text-[11px]">
                    <span className="font-mono text-dark-slate">{r.referenceNumber} • {r.channel}</span>
                    <span className="font-bold text-deep-olive">{r.amountEgp} ج.م</span>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <input
                    required
                    value={refNum}
                    onChange={(e) => setRefNum(e.target.value)}
                    placeholder="رقم مرجع التحويل"
                    className="flex-1 min-w-0 rounded-xl bg-surface-snow px-3 py-2 text-xs outline-none border border-surface-container"
                  />
                  <input
                    type="number"
                    value={amountEgp}
                    onChange={(e) => setAmountEgp(e.target.value)}
                    className="w-20 rounded-xl bg-surface-snow px-2.5 py-2 text-xs outline-none border border-surface-container"
                  />
                </div>
                <button type="submit" className="w-full py-2.5 rounded-full bg-deep-olive text-white text-xs font-bold">
                  حفظ في أرشيف الإيصالات
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
