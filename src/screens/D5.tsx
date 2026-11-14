"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

export default function Desktop5() {
  const { currentPersona } = useCaptenly();
  const isFacility = currentPersona.role === "facility_manager";
  const isCoach = currentPersona.role === "coach";

  const primaryHref = isFacility
    ? "/dashboard/facility"
    : isCoach
    ? "/dashboard/coach"
    : "/dashboard/athlete";
  const primaryLabel = isFacility
    ? "فتح لوحة إدارة المنشأة"
    : isCoach
    ? "فتح لوحة تحكم الكابتن"
    : "حسابي الرياضي";

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-6">
      <div className="max-w-[780px] w-full bg-surface-card rounded-[24px] p-8 md:p-12 shadow-xl flex flex-col gap-6 text-center items-center animate-captenly-enter">
        <div className="w-16 h-16 rounded-full bg-lime-tint text-deep-olive flex items-center justify-center">
          <Icon name="check_circle" className="text-[36px]" />
        </div>

        <h1 className="font-hero-headline text-[30px] text-dark-slate">
          أهلاً بك في كابتنلي يا {currentPersona.fullNameAr.split(" ")[0]}!
        </h1>
        <p className="font-body-default text-text-muted max-w-xl">
          {isFacility ? (
            <>
              حساب إدارة المنشأة جاهز الآن بالكامل في <strong>{currentPersona.city}</strong>. يمكنك الآن إدارة المشتركين والفرق، مسح أكواد الاشتراكات، وإضافة الكباتن والموظفين.
            </>
          ) : (
            <>
              حسابك جاهز الآن بالكامل في <strong>{currentPersona.city}</strong>.{" "}
              {currentPersona.memberCode && (
                <>
                  كود حسابك الفريد هو{" "}
                  <span className="font-mono font-bold text-deep-olive">{currentPersona.memberCode}</span>
                  ،{" "}
                </>
              )}
              ويمكنك الآن استكشاف المنشآت أو فتح لوحة حسابك مباشرة.
            </>
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-2">
          <Link
            href="/explore"
            className="p-4 rounded-2xl bg-surface-snow hover:bg-lime-tint transition-colors flex flex-col items-center gap-2"
          >
            <Icon name="explore" className="text-deep-olive text-[22px]" />
            <span className="font-card-title-sm text-dark-slate">استكشف المنشآت</span>
          </Link>
          <Link
            href={primaryHref}
            className="p-4 rounded-2xl bg-dark-slate text-electric-volt flex flex-col items-center gap-2 shadow"
          >
            <Icon
              name={isFacility ? "stadium" : isCoach ? "sports" : "person"}
              className="text-[22px]"
            />
            <span className="font-card-title-sm">{primaryLabel}</span>
          </Link>
          <Link
            href="/dashboard/ledger"
            className="p-4 rounded-2xl bg-surface-snow hover:bg-lime-tint transition-colors flex flex-col items-center gap-2"
          >
            <Icon name="qr_code_2" className="text-deep-olive text-[22px]" />
            <span className="font-card-title-sm text-dark-slate">
              {isFacility || isCoach ? "ماسح الـ QR وسجل المشتركين" : "دفتر الحصص الـ QR"}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
