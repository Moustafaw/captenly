"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";

interface GuestAccountGateScreenProps {
  titleAr?: string;
  descriptionAr?: string;
}

export function GuestAccountGateScreen({
  titleAr = "يرجى إنشاء حساب أو تسجيل الدخول في Captenly",
  descriptionAr = "هذه الميزة مخصصة للأعضاء المسجلين فقط. يمكنك البحث وتصفح صفحات المسابح والكباتن بحرية تامة كزائر، أو إنشاء حساب مجاني خلال 30 ثانية للاستفادة من المفضلة والمقارنة ودفتر الحصص.",
}: GuestAccountGateScreenProps) {
  return (
    <div className="screen-root bg-canvas-alabaster font-body-default min-h-[75vh] flex items-center justify-center px-margin py-12" dir="rtl">
      <div className="max-w-lg w-full rounded-[24px] bg-surface-card border border-surface-container p-7 sm:p-9 shadow-sm flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-dark-slate text-electric-volt flex items-center justify-center shadow-md">
          <Icon name="lock_person" className="text-[32px]" />
        </div>

        <h1 className="font-cairo font-extrabold text-xl sm:text-2xl text-dark-slate leading-snug">
          {titleAr}
        </h1>

        <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
          {descriptionAr}
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
          <Link
            href="/auth/register"
            className="flex-1 py-3 rounded-full bg-dark-slate text-electric-volt font-bold text-xs sm:text-sm text-center hover:bg-deep-carbon transition-colors shadow-sm"
          >
            إنشاء حساب جديد مجاناً
          </Link>
          <Link
            href="/auth/login"
            className="flex-1 py-3 rounded-full bg-lime-tint text-deep-olive font-bold text-xs sm:text-sm text-center hover:bg-electric-volt hover:text-dark-slate transition-colors"
          >
            تسجيل الدخول
          </Link>
        </div>

        <Link
          href="/explore"
          className="text-xs font-bold text-text-muted hover:text-dark-slate pt-1"
        >
          العودة لاستكشاف المسابح والكباتن ←
        </Link>
      </div>
    </div>
  );
}
