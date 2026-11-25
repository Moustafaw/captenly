"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { CaptenlyImage } from "@/components/CaptenlyImage";

interface GuestAccountGateScreenProps {
  titleAr?: string;
  descriptionAr?: string;
}

export function GuestAccountGateScreen({
  titleAr = "يرجى إنشاء حساب أو تسجيل الدخول في Captenly",
  descriptionAr = "هذه الميزة مخصصة للأعضاء المسجلين فقط. يمكنك البحث وتصفح صفحات المسابح والكباتن بحرية تامة كزائر، أو إنشاء حساب مجاني خلال 30 ثانية للاستفادة من المفضلة والمقارنة ودفتر الحصص.",
}: GuestAccountGateScreenProps) {
  const { storageHydrated } = useCaptenly();

  // Prevent flashing guest sign-in gate before localStorage session state hydrates (F-024)
  if (!storageHydrated) {
    return (
      <div
        className="screen-root bg-[#F7F9FA] font-body-default min-h-[75vh] flex items-center justify-center px-3 sm:px-margin py-8 sm:py-12"
        dir="rtl"
      >
        <div className="max-w-[520px] w-full rounded-[24px] bg-white border border-[#0F172A]/8 shadow-sm p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center animate-pulse">
            <Icon name="lock_person" className="text-[24px]" />
          </div>
          <h1 className="font-cairo font-bold text-base text-[#0F172A]">
            جاري التحقق من حالة الجلسة...
          </h1>
          <p className="text-xs text-[#475569]">يتم استعادة بيانات الحساب المسجل الآن.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="screen-root bg-[#F7F9FA] font-body-default min-h-[75vh] flex items-center justify-center px-3 sm:px-margin py-8 sm:py-12 relative overflow-hidden"
      dir="rtl"
    >
      {/* Subtle sunlit Olympic pool lane architectural backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 15%, rgba(234,244,248,0.95), transparent 45%), radial-gradient(circle at 85% 85%, rgba(29,110,125,0.08), transparent 45%), linear-gradient(to left, rgba(29,110,125,0.04) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 100% 100%, 72px 72px",
        }}
      />

      <div className="relative z-10 max-w-[580px] w-full rounded-[24px] sm:rounded-[28px] bg-white border border-[#0F172A]/8 shadow-[0_18px_48px_rgba(15,23,42,0.06)] overflow-hidden flex flex-col items-center text-center">
        {/* Sunlit Olympic pool top header strip */}
        <div className="relative w-full h-28 sm:h-32 overflow-hidden">
          <CaptenlyImage
            src="/images/auth/olympic-pool-hero.jpg"
            alt="مسبح أولمبي"
            fill
            sizes="(max-width: 640px) 100vw, 580px"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A]/25 via-transparent to-white" />
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-white/80 shadow-sm flex items-center">
            <CaptenlyImage
              src="/images/logo/captenly-logo-horizontal-dark.png"
              alt="كابتنلي | Captenly"
              width={120}
              height={24}
              className="h-5 sm:h-6 w-auto object-contain"
            />
          </div>
        </div>

        {/* Overlapping aquatic emblem (Option B Ice Aqua + Deep Ocean Teal) */}
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
            <Link
              href="/auth/register"
              className="flex-1 py-3.5 px-5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-bold text-xs sm:text-sm text-center whitespace-nowrap inline-flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Icon name="person_add" className="text-[17px]" />
              <span>إنشاء حساب جديد مجاناً</span>
            </Link>
            <Link
              href="/auth/login"
              className="flex-1 py-3.5 px-5 rounded-full bg-[#EAF4F8] hover:bg-[#1D6E7D]/15 border border-[#1D6E7D]/20 text-[#1D6E7D] font-bold text-xs sm:text-sm text-center whitespace-nowrap inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Icon name="login" className="text-[17px]" />
              <span>تسجيل الدخول</span>
            </Link>
          </div>

          <Link
            href="/explore"
            className="text-xs sm:text-sm font-bold text-[#64748B] hover:text-[#1D6E7D] pt-1 transition-colors"
          >
            العودة لاستكشاف المسابح والكباتن ←
          </Link>
        </div>
      </div>
    </div>
  );
}
