"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { RoleAccessDeniedScreen } from "@/components/auth/RoleAccessDeniedScreen";

function GateKioskLoadingShell() {
  return (
    <div className="min-h-screen bg-[#F7F9FA] pb-24" dir="rtl">
      <section className="bg-[#0F4C5C] text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-7 space-y-4">
          <div className="space-y-2">
            <div className="h-10 w-44 rounded-full bg-white/10" />
            <h1 className="text-xl md:text-2xl font-black text-white">
              كشك البوابة الميداني QR
            </h1>
            <p className="text-xs text-[#EAF4F8]/85">جاري تجهيز ماسح البوابة أوفلاين...</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="h-[68px] rounded-2xl bg-white/10 border border-white/10" />
            ))}
          </div>
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-[420px] rounded-3xl bg-white border border-sand-border" />
          <div className="lg:col-span-5 h-[360px] rounded-3xl bg-white border border-sand-border" />
        </div>
      </div>
    </div>
  );
}

const DynamicPoolGateKioskView = dynamic(
  () =>
    import("@/components/facility-desk/PoolGateKioskView").then((m) => m.PoolGateKioskView),
  {
    ssr: false,
    loading: () => <GateKioskLoadingShell />,
  }
);

function GateAuthHydratingSkeleton({
  titleAr,
  descriptionAr,
}: {
  titleAr: string;
  descriptionAr: string;
}) {
  // Reserves the exact card & image-strip dimensions of GuestAccountGateScreen to prevent CLS (0.204 -> 0)
  return (
    <div
      className="screen-root bg-[#F7F9FA] font-body-default min-h-[75vh] flex items-center justify-center px-3 sm:px-margin py-8 sm:py-12 relative overflow-hidden"
      dir="rtl"
    >
      <div className="relative z-10 max-w-[580px] w-full rounded-[24px] sm:rounded-[28px] bg-white border border-[#0F172A]/8 shadow-[0_18px_48px_rgba(15,23,42,0.06)] overflow-hidden flex flex-col items-center text-center">
        <div className="relative w-full h-28 sm:h-32 overflow-hidden bg-gradient-to-b from-[#EAF4F8] to-white" />
        <div className="-mt-8 relative z-10 w-16 h-16 rounded-2xl bg-[#EAF4F8] border-4 border-white text-[#1D6E7D] flex items-center justify-center shadow-md">
          <Icon name="lock_person" className="text-[30px]" />
        </div>
        <div className="w-full px-5 sm:px-9 pt-4 pb-7 sm:pb-8 flex flex-col items-center gap-3.5">
          <h1 className="font-cairo font-extrabold text-xl sm:text-2xl text-[#0F172A] leading-snug">
            {titleAr}
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed max-w-md">
            {descriptionAr}
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full pt-2">
            <div className="flex-1 h-[46px] rounded-full bg-[#1D6E7D]/15 animate-pulse" />
            <div className="flex-1 h-[46px] rounded-full bg-[#EAF4F8] animate-pulse" />
          </div>
          <div className="h-5 w-44 rounded bg-[#F7F9FA] mt-1" />
        </div>
      </div>
    </div>
  );
}

export default function FacilityGateKioskPage() {
  const {
    currentPersona,
    isAuthenticated,
    storageHydrated,
    facilities,
    sessionLedgers,
    facilityLinks,
    offlineQueue,
    activeStaffAssignment,
    checkInBySubscriptionCode,
    syncOfflineQueue,
    updateFacilityPoolDeskConfig,
  } = useCaptenly();

  const verifiedActiveStaffAssignment =
    activeStaffAssignment &&
    (!activeStaffAssignment.invitationStatus ||
      activeStaffAssignment.invitationStatus === "accepted")
      ? activeStaffAssignment
      : null;

  const isStaffMode = Boolean(verifiedActiveStaffAssignment);
  const staffRole = verifiedActiveStaffAssignment?.role || null;

  const canOperateGate =
    isAuthenticated &&
    (currentPersona.role === "facility_manager" ||
      (isStaffMode &&
        (staffRole === "subscriptions_manager" || staffRole === "general_staff")));

  const facility = useMemo(() => {
    const targetId =
      verifiedActiveStaffAssignment?.facilityId || currentPersona.linkedFacilityId || "";
    return facilities.find((f) => f.id === targetId) || null;
  }, [facilities, verifiedActiveStaffAssignment, currentPersona.linkedFacilityId]);

  const facilityLedgers = useMemo(
    () => (facility ? sessionLedgers.filter((l) => l.facilityId === facility.id) : []),
    [sessionLedgers, facility]
  );

  const scopedLinks = useMemo(
    () => (facility ? facilityLinks.filter((l) => l.facilityId === facility.id) : []),
    [facilityLinks, facility]
  );

  const gateTitleAr = "كشك البوابة الميداني يتطلب تسجيل الدخول";
  const gateDescAr =
    "سجّل دخولك بحساب إدارة المنشأة أو بحساب موظف مخوّل (مسؤول اشتراكات / مشرف عام) لتشغيل ماسح البوابة.";

  if (!storageHydrated) {
    return <GateAuthHydratingSkeleton titleAr={gateTitleAr} descriptionAr={gateDescAr} />;
  }

  if (!isAuthenticated) {
    return <GuestAccountGateScreen titleAr={gateTitleAr} descriptionAr={gateDescAr} />;
  }

  if (!canOperateGate || !facility) {
    return (
      <RoleAccessDeniedScreen
        titleAr="كشك البوابة متاح لإدارة المنشأة وموظفي البوابة فقط"
        descriptionAr="لتشغيل كشك مسح QR على بوابة المسبح، يجب تسجيل الدخول بحساب مدير منشأة أو تفعيل وضع الموظف (مسؤول اشتراكات / مشرف عام)."
        fallbackHref={
          currentPersona.role === "coach" ? "/dashboard/coach" : "/dashboard/athlete"
        }
        fallbackLabelAr="الانتقال إلى لوحتي"
      />
    );
  }

  return (
    <DynamicPoolGateKioskView
      facility={facility}
      ledgers={facilityLedgers}
      facilityLinks={scopedLinks}
      offlineQueue={offlineQueue}
      operatorNameAr={currentPersona.fullNameAr || facility.nameAr}
      onCheckInByCode={checkInBySubscriptionCode}
      onSyncOffline={syncOfflineQueue}
      onMarkShiftPrepped={(timestampIso) =>
        updateFacilityPoolDeskConfig(facility.id, { lastShiftPreppedAtIso: timestampIso })
      }
    />
  );
}
