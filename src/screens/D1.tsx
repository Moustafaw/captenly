"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCaptenly } from "@/context/CaptenlyContext";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";

function Desktop1Inner() {
  const router = useRouter();
  const { isAuthenticated, currentPersona } = useCaptenly();

  const dashHref =
    currentPersona.role === "facility_manager"
      ? "/dashboard/facility"
      : currentPersona.role === "coach"
        ? "/dashboard/coach"
        : "/dashboard/athlete";

  useEffect(() => {
    if (!isAuthenticated) return;
    router.replace(dashHref);
  }, [isAuthenticated, dashHref, router]);

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="تسجيل الدخول لحسابك"
        descriptionAr="سجّل دخولك أو أنشئ حسابك على كابتنلي للمتابعة."
      />
    );
  }

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-6" dir="rtl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-surface-container border-t-deep-olive animate-spin" />
        <p className="text-sm font-bold text-dark-slate">جاري التحويل إلى لوحتك...</p>
      </div>
    </div>
  );
}

export default function Desktop1() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas-alabaster" />}>
      <Desktop1Inner />
    </Suspense>
  );
}
