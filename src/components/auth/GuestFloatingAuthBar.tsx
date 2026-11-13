"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

interface GuestFloatingAuthBarProps {
  contextLabelAr?: string;
}

export function GuestFloatingAuthBar({
  contextLabelAr = "أنشئ حسابك المجاني لحفظ المفضلة، المقارنة، والتواصل مع المنشآت والكباتن",
}: GuestFloatingAuthBarProps) {
  const { isAuthenticated } = useCaptenly();
  const [dismissed, setDismissed] = useState(false);

  if (isAuthenticated || dismissed) return null;

  return (
    <div
      className="fixed bottom-[76px] lg:bottom-6 inset-x-3 lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-[760px] z-40 rounded-2xl bg-dark-slate/95 backdrop-blur-md text-surface-card border border-electric-volt/35 shadow-2xl px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
      dir="rtl"
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0 pr-1">
        <div className="w-9 h-9 rounded-xl bg-electric-volt text-dark-slate flex items-center justify-center shrink-0">
          <Icon name="person_add" className="text-[18px]" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-xs sm:text-sm text-electric-volt truncate">
            سجّل في Captenly لتفعيل كل المزايا
          </div>
          <p className="text-[11px] text-surface-container-high leading-snug line-clamp-2">
            {contextLabelAr}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 justify-end">
        <Link
          href="/auth/login"
          className="px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-surface-card text-[11px] font-bold transition-colors whitespace-nowrap"
        >
          تسجيل الدخول
        </Link>
        <Link
          href="/auth/register"
          className="px-4 py-2 rounded-full bg-electric-volt text-dark-slate text-[11px] font-extrabold hover:opacity-95 transition-opacity whitespace-nowrap shadow-sm"
        >
          إنشاء حساب الآن ←
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="إخفاء الشريط"
          className="w-7 h-7 rounded-full hover:bg-white/10 text-surface-variant flex items-center justify-center shrink-0"
        >
          <Icon name="close" className="text-[15px]" />
        </button>
      </div>
    </div>
  );
}
