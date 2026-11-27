"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import {
  buildAcademySettlementSummary,
  evaluateLedgerGateStatus,
  getFacilityPoolDeskConfig,
  isSameLocalCalendarDay,
} from "@/lib/poolDeskPricing";
import type {
  Facility,
  FacilityStaffRole,
  OfflineCheckinQueueItem,
  SessionLedger,
} from "@/types/captenly";

interface FacilityOpsAuditTabProps {
  facility: Facility;
  ledgers: SessionLedger[];
  offlineQueue: OfflineCheckinQueueItem[];
  staffRole?: FacilityStaffRole | null;
  onSyncOffline: () => number;
  onExceptionalCheckin: (ledgerId: string, noteAr: string) => void;
  onOpenGateKiosk?: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}.${parts[1][0]}`;
  return name.trim().slice(0, 2) || "سب";
}

/**
 * Screen 2: غرفة عمليات اليوم وسجل الرقابة الميداني (Today's Ops & Audit Log).
 */
export function FacilityOpsAuditTab({
  facility,
  ledgers,
  offlineQueue,
  staffRole,
  onSyncOffline,
  onExceptionalCheckin,
}: FacilityOpsAuditTabProps) {
  const { activeStaffAssignment } = useCaptenly();
  const effectiveStaffRole = staffRole ?? activeStaffAssignment?.role ?? null;
  const isGeneralStaff = effectiveStaffRole === "general_staff";
  const poolConfig = getFacilityPoolDeskConfig(facility);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [scannerFilter, setScannerFilter] = useState<"all" | "facility_gate" | "delegated_coach">("all");
  const [searchQ, setSearchQ] = useState("");

  const activeLedgers = useMemo(
    () => ledgers.filter((l) => l.status !== "completed" && !l.isCodeExpired),
    [ledgers]
  );

  // Build real today's check-in events across facility ledgers
  const todayEvents = useMemo(() => {
    const items: Array<{
      ledger: SessionLedger;
      checkin: SessionLedger["checkins"][number];
      tsMs: number;
    }> = [];
    for (const l of ledgers) {
      for (const c of l.checkins) {
        if (isSameLocalCalendarDay(c.scannedAtIso)) {
          items.push({
            ledger: l,
            checkin: c,
            tsMs: c.scannedAtIso ? new Date(c.scannedAtIso).getTime() : 0,
          });
        }
      }
    }
    return items.sort((a, b) => b.tsMs - a.tsMs);
  }, [ledgers]);

  const checkedInTodayLedgerIds = useMemo(
    () => new Set(todayEvents.map((e) => e.ledger.id)),
    [todayEvents]
  );

  const notCheckedInToday = useMemo(
    () => activeLedgers.filter((l) => !checkedInTodayLedgerIds.has(l.id)),
    [activeLedgers, checkedInTodayLedgerIds]
  );

  const todayWaterRevenueEgp = useMemo(() => {
    return todayEvents.reduce((sum, ev) => {
      if (ev.ledger.agreementTypeAtEnroll === "fixed_monthly") return sum;
      const unitRate =
        ev.ledger.pricingSnapshot?.waterFeePerSessionEgp ?? poolConfig.waterFeePerSessionEgp;
      return sum + Math.max(0, Number(unitRate || 0));
    }, 0);
  }, [todayEvents, poolConfig.waterFeePerSessionEgp]);

  const pendingOfflineCount = offlineQueue.filter((q) => !q.synced).length;
  const attendancePct = activeLedgers.length
    ? Math.min(100, Math.round((checkedInTodayLedgerIds.size / activeLedgers.length) * 100))
    : 0;

  const groupChoices = useMemo(() => {
    const set = new Set<string>();
    for (const l of ledgers) {
      if (l.linkedEntityNameAr) set.add(l.linkedEntityNameAr);
    }
    return Array.from(set);
  }, [ledgers]);

  const filteredEvents = useMemo(() => {
    return todayEvents.filter(({ ledger, checkin }) => {
      if (groupFilter === "direct" && ledger.linkedEntityNameAr) return false;
      if (groupFilter !== "all" && groupFilter !== "direct" && ledger.linkedEntityNameAr !== groupFilter) {
        return false;
      }
      if (scannerFilter === "facility_gate" && checkin.scannedByRole === "delegated_coach") {
        return false;
      }
      if (scannerFilter === "delegated_coach" && checkin.scannedByRole !== "delegated_coach") {
        return false;
      }
      if (searchQ.trim()) {
        const q = searchQ.trim().toLowerCase();
        const hay = `${ledger.athleteNameAr} ${ledger.subscriptionCode || ledger.ledgerCode} ${checkin.scannedByNameAr || checkin.verifiedByAr} ${ledger.linkedEntityNameAr || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [todayEvents, groupFilter, scannerFilter, searchQ]);

  const complianceRows = useMemo(
    () => buildAcademySettlementSummary(facility, ledgers),
    [facility, ledgers]
  );

  const sendWhatsappAbsentReminder = (ledger: SessionLedger) => {
    const remaining = Math.max(0, ledger.totalSessions - ledger.completedSessions);
    const msg = `مرحباً ولي أمر السبّاح (${ledger.athleteNameAr}) — تذكير ودي من ${facility.nameAr}: لم يتم تسجيل حضور حصة اليوم حتى الآن. الرصيد المتبقي: ${remaining} من ${ledger.totalSessions} حصص.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col gap-5 animate-captenly-enter">
      {/* 4 Visual KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white p-4 sm:p-5 border border-[#E2E8F0] shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-[#64748B]">حضر ونزل المية اليوم</span>
            <div className="text-2xl sm:text-3xl font-black text-[#0F172A] mt-1">
              {checkedInTodayLedgerIds.size}{" "}
              <span className="text-xs font-bold text-[#64748B]">سبّاح</span>
            </div>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-[#1D6E7D] bg-[#EAF4F8] px-2 py-0.5 rounded-full">
              {attendancePct}% من النشطين
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center shrink-0">
            <Icon name="pool" className="text-[24px]" />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 sm:p-5 border border-[#E2E8F0] shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-[#64748B]">لم يسجلوا حضور اليوم</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">
              {notCheckedInToday.length}{" "}
              <span className="text-xs font-bold text-[#64748B]">سبّاح</span>
            </div>
            <span className="inline-block mt-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              من أصل {activeLedgers.length} اشتراك ساري
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Icon name="schedule" className="text-[24px]" />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 sm:p-5 border border-[#E2E8F0] shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-[#64748B]">حساب المية المحقق اليوم</span>
            <div className="text-2xl sm:text-3xl font-black text-[#1D6E7D] mt-1">
              {todayWaterRevenueEgp.toLocaleString("en-US")}{" "}
              <span className="text-xs font-bold">ج.م</span>
            </div>
            <span className="inline-block mt-1 text-[10px] font-bold text-[#475569] bg-[#F7F9FA] px-2 py-0.5 rounded-full border border-[#E2E8F0]">
              {todayEvents.length > 0 ? (
                (() => {
                  const perSessionCount = todayEvents.filter(
                    (ev) => ev.ledger.agreementTypeAtEnroll !== "fixed_monthly"
                  ).length;
                  const avgPerSession =
                    perSessionCount > 0 ? Math.round(todayWaterRevenueEgp / perSessionCount) : 0;
                  return perSessionCount > 0
                    ? `${todayEvents.length} جلسات — متوسط ${avgPerSession} ج.م`
                    : `${todayEvents.length} جلسات باشتراك شهري ثابت`;
                })()
              ) : poolConfig.waterFeePerSessionEgp > 0 ? (
                `0 جلسات اليوم — السعر الافتراضي ${poolConfig.waterFeePerSessionEgp} ج.م`
              ) : (
                "حدّد سعر المية في الإعدادات"
              )}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center shrink-0">
            <Icon name="payments" className="text-[24px]" />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 sm:p-5 border border-[#E2E8F0] shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-[#64748B]">عمليات أوفلاين للمزامنة</span>
            <div className="text-2xl sm:text-3xl font-black text-[#0F172A] mt-1">
              {pendingOfflineCount}
            </div>
            {pendingOfflineCount > 0 ? (
              <button
                type="button"
                onClick={onSyncOffline}
                className="mt-1 px-2.5 py-0.5 rounded-full bg-[#1D6E7D] text-white text-[10px] font-bold hover:bg-[#155460]"
              >
                مزامنة الآن ↻
              </button>
            ) : (
              <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                كل الحركات متزامنة ✓
              </span>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#F7F9FA] text-[#1D6E7D] flex items-center justify-center shrink-0 border border-[#E2E8F0]">
            <Icon name="cloud_done" className="text-[24px]" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar (Clean 2-row flex preventing any overlap) */}
      <div className="rounded-2xl bg-white p-4 border border-[#E2E8F0] shadow-xs flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center bg-[#F7F9FA] rounded-full px-3.5 py-2 border border-[#E2E8F0] flex-1 max-w-md">
            <Icon name="search" className="text-[#64748B] text-[17px] ml-2 shrink-0" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="ابحث باسم السباح، كود SUB-XXXX، أو القائم بالمسح..."
              className="w-full bg-transparent text-xs outline-none text-[#0F172A]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={scannerFilter}
              onChange={(e) => setScannerFilter(e.target.value as typeof scannerFilter)}
              className="rounded-full bg-[#F7F9FA] border border-[#E2E8F0] px-3.5 py-2 text-xs font-bold text-[#0F172A] outline-none"
            >
              <option value="all">كل جهات المسح</option>
              <option value="facility_gate">مسح بوابة المنشأة فقط</option>
              <option value="delegated_coach">مسح كابتن مفوّض فقط</option>
            </select>
            <Link
              href="/dashboard/facility/gate"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Icon name="qr_code_scanner" className="text-[16px]" />
              <span>فتح كشك البوابة المباشر</span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          <button
            type="button"
            onClick={() => setGroupFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              groupFilter === "all"
                ? "bg-[#1D6E7D] text-white"
                : "bg-[#F7F9FA] text-[#475569] border border-[#E2E8F0] hover:bg-[#EAF4F8]"
            }`}
          >
            الكل ({todayEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setGroupFilter("direct")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              groupFilter === "direct"
                ? "bg-[#1D6E7D] text-white"
                : "bg-[#F7F9FA] text-[#475569] border border-[#E2E8F0] hover:bg-[#EAF4F8]"
            }`}
          >
            مدارس النادي المباشرة
          </button>
          {groupChoices.map((gName) => (
            <button
              key={gName}
              type="button"
              onClick={() => setGroupFilter(gName)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                groupFilter === gName
                  ? "bg-[#1D6E7D] text-white"
                  : "bg-[#F7F9FA] text-[#475569] border border-[#E2E8F0] hover:bg-[#EAF4F8]"
              }`}
            >
              {gName}
            </button>
          ))}
        </div>
      </div>

      {/* Main 12-Col Split: Audit Log Table + Absent & Compliance Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Right 8 Cols: Live Attendance & Audit Log */}
        <section className="lg:col-span-8 bg-white rounded-3xl p-5 sm:p-6 border border-[#E2E8F0] shadow-[0_4px_24px_rgba(15,23,42,0.03)] flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>سجل الحضور والرقابة اللحظي ({filteredEvents.length})</span>
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                يوثّق كل نزول للمسبح بالوقت الفعلي واسم المسؤول الذي نفّذ المسح (بوابة المنشأة أو كابتن مفوّض).
              </p>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl bg-[#F7F9FA] border border-[#E2E8F0] p-8 text-center flex flex-col items-center gap-2">
              <Icon name="qr_code_2" className="text-[36px] text-[#1D6E7D]/50" />
              <div className="text-sm font-bold text-[#0F172A]">
                لم تُسجّل عمليات مسح حضور لليوم بعد
              </div>
              <p className="text-xs text-[#64748B] max-w-md">
                بمجرد مسح باركود أي سبّاح من كشك البوابة أو لوحة المشتركين، يظهر اسمه ووقت المسح ومن نفّذه هنا فوراً.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] font-extrabold text-[#64748B]">
                    <th className="pb-3 pr-2">السبّاح والكود</th>
                    <th className="pb-3">الجهة / المسار</th>
                    <th className="pb-3">وقت النزول</th>
                    <th className="pb-3">القائم بالمسح (الرقابة)</th>
                    <th className="pb-3">الرصيد</th>
                    <th className="pb-3 pl-2">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-xs">
                  {filteredEvents.map(({ ledger, checkin }) => {
                    const pct = Math.min(
                      100,
                      Math.round((ledger.completedSessions / ledger.totalSessions) * 100)
                    );
                    const isCoachScan = checkin.scannedByRole === "delegated_coach";
                    return (
                      <tr key={`${ledger.id}-${checkin.sessionNumber}`} className="hover:bg-[#F7F9FA]">
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-[#EAF4F8] border border-[#1D6E7D]/20 text-[#1D6E7D] font-bold text-xs flex items-center justify-center shrink-0">
                              {getInitials(ledger.athleteNameAr)}
                            </div>
                            <div>
                              <Link
                                href={`/dashboard/ledger?id=${ledger.id}`}
                                className="font-bold text-[#0F172A] hover:text-[#1D6E7D]"
                              >
                                {ledger.athleteNameAr}
                              </Link>
                              <div className="font-mono text-[10px] text-[#64748B]">
                                {ledger.subscriptionCode || ledger.ledgerCode}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-[#0F172A]">
                            {ledger.linkedEntityNameAr || ledger.trackLabelAr || "مدارس النادي"}
                          </div>
                          <div className="text-[10px] text-[#64748B]">{ledger.coachNameAr}</div>
                        </td>
                        <td className="py-3 font-bold text-[#0F172A]">
                          {checkin.scannedAtIso
                            ? new Date(checkin.scannedAtIso).toLocaleTimeString("ar-EG", {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : checkin.dateAr}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isCoachScan
                                ? "bg-sky-50 text-sky-800 border border-sky-200"
                                : "bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/20"
                            }`}
                          >
                            <Icon
                              name={isCoachScan ? "sports" : "qr_code_scanner"}
                              className="text-[13px]"
                            />
                            <span>
                              {checkin.scannedByNameAr || checkin.verifiedByAr}
                              {isCoachScan ? " (كابتن مفوّض)" : " (بوابة المنشأة)"}
                            </span>
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col gap-1 min-w-[78px]">
                            <span className="text-[11px] font-extrabold text-[#0F172A]">
                              حصة {checkin.sessionNumber}/{ledger.totalSessions}
                            </span>
                            <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#1D6E7D]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pl-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              checkin.wasOffline
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {checkin.wasOffline ? "أوفلاين" : "أونلاين ✓"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Left 4 Cols: Not Checked In Yet + Academy Commitment Radar */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Absent / Not Checked In Today */}
          <section className="bg-white rounded-3xl p-5 border border-[#E2E8F0] shadow-[0_4px_24px_rgba(15,23,42,0.03)] flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>لم يسجلوا بعد اليوم ({notCheckedInToday.length})</span>
              </h3>
            </div>

            {notCheckedInToday.length === 0 ? (
              <div className="rounded-xl bg-[#F7F9FA] p-4 text-center text-xs text-[#64748B]">
                كل المشتركين النشطين مسجل حضورهم أو لا توجد اشتراكات نشطة حالياً.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {notCheckedInToday.slice(0, 6).map((l) => {
                  const gateStat = evaluateLedgerGateStatus(l);
                  return (
                    <div
                      key={l.id}
                      className="rounded-2xl bg-[#F7F9FA] border border-[#E2E8F0] p-3 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-white border border-[#E2E8F0] text-[#0F172A] font-bold text-[11px] flex items-center justify-center shrink-0">
                          {getInitials(l.athleteNameAr)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-[#0F172A] truncate">
                            {l.athleteNameAr}
                          </div>
                          <div className="text-[10px] text-[#64748B] truncate">
                            {l.linkedEntityNameAr || l.trackLabelAr || "النادي"} • متبقي{" "}
                            {gateStat.remainingSessions}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => sendWhatsappAbsentReminder(l)}
                          title="تنبيه ولي الأمر عبر واتساب"
                          className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center hover:bg-emerald-100"
                        >
                          <Icon name="chat" className="text-[15px]" />
                        </button>
                        {!isGeneralStaff ? (
                          <button
                            type="button"
                            onClick={() =>
                              onExceptionalCheckin(l.id, "تسجيل حضور استثنائي من غرفة العمليات")
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/25 text-[10px] font-bold"
                          >
                            تحضير
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            title="التحضير الاستثنائي (تجاوز حد الـ 3 ساعات) متاح للمالك أو مسؤول الاشتراكات فقط"
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 text-[10px] font-bold cursor-not-allowed"
                          >
                            تحضير مقيّد
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Academy & Coach Commitment Radar */}
          <section className="bg-white rounded-3xl p-5 border border-[#E2E8F0] shadow-[0_4px_24px_rgba(15,23,42,0.03)] flex flex-col gap-3.5">
            <div>
              <h3 className="font-bold text-sm text-[#0F172A]">رادار التزام الأكاديميات والمدارس</h3>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                نسبة تسجيل حضور المشتركين بالـ QR لكل جهة اليوم
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {complianceRows.map((row) => (
                <div key={row.entityId} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0F172A] truncate">{row.displayNameAr}</span>
                    <span
                      className={`font-extrabold text-[11px] ${
                        row.compliancePct >= 80
                          ? "text-[#1D6E7D]"
                          : row.compliancePct > 0
                          ? "text-amber-700"
                          : "text-[#64748B]"
                      }`}
                    >
                      {row.compliancePct}% ({row.swimmersCount})
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        row.compliancePct >= 80
                          ? "bg-[#1D6E7D]"
                          : row.compliancePct > 0
                          ? "bg-amber-500"
                          : "bg-[#CBD5E1]"
                      }`}
                      style={{ width: `${Math.max(4, row.compliancePct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
