"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

export function AuthGateModal() {
  const { authGateModalOpen, authGateFeatureNameAr, closeAuthGateModal } = useCaptenly();

  if (!authGateModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-dark-slate/70 backdrop-blur-sm flex items-center justify-center p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
      onClick={closeAuthGateModal}
    >
      <div
        className="w-full max-w-md rounded-[24px] bg-surface-card border border-surface-container shadow-2xl p-6 sm:p-7 flex flex-col gap-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeAuthGateModal}
          aria-label="إغلاق"
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-surface-snow hover:bg-surface-container text-dark-slate flex items-center justify-center transition-colors"
        >
          <Icon name="close" className="text-[18px]" />
        </button>

        <div className="flex flex-col items-center text-center gap-3 pt-1">
          <div className="w-14 h-14 rounded-2xl bg-dark-slate text-electric-volt flex items-center justify-center shadow-md">
            <Icon name="lock_person" className="text-[28px]" />
          </div>

          <h2 id="auth-gate-title" className="font-cairo font-extrabold text-xl text-dark-slate leading-snug">
            يرجى إنشاء حساب أو تسجيل الدخول في Captenly
          </h2>

          <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
            {authGateFeatureNameAr
              ? `لتتمكن من ${authGateFeatureNameAr}، يرجى تسجيل الدخول أو إنشاء حساب مجاني خلال ثوانٍ.`
              : "التصفح والبحث وعرض الصفحات متاح مجاناً للزوار، أما المفضلة والمقارنة والتواصل والمتابعة فتتطلب حساباً مسجلاً."}
          </p>
        </div>

        <div className="rounded-2xl bg-surface-snow p-3.5 text-[11px] text-dark-slate flex flex-col gap-1.5 border border-surface-container/80">
          <div className="font-bold text-deep-olive flex items-center gap-1.5">
            <Icon name="verified" className="text-[15px]" />
            <span>ماذا يفتح لك الحساب المجاني؟</span>
          </div>
          <ul className="text-text-muted space-y-1 pr-5 list-disc">
            <li>مقارنة المنشآت والأسعار جنباً إلى جنب (حتى 4 أماكن)</li>
            <li>حفظ المفضلة وتلقي التنبيهات المخصصة</li>
            <li>الحصول على كود عضوية ودفتر حصص QR أوفلاين</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <Link
            href="/auth/register"
            onClick={closeAuthGateModal}
            className="flex-1 py-3 rounded-full bg-dark-slate text-electric-volt font-bold text-xs sm:text-sm text-center shadow-sm hover:bg-deep-carbon transition-colors"
          >
            إنشاء حساب جديد
          </Link>
          <Link
            href="/auth/login"
            onClick={closeAuthGateModal}
            className="flex-1 py-3 rounded-full bg-lime-tint text-deep-olive font-bold text-xs sm:text-sm text-center hover:bg-electric-volt hover:text-dark-slate transition-colors"
          >
            تسجيل الدخول
          </Link>
        </div>

        <button
          type="button"
          onClick={closeAuthGateModal}
          className="text-xs font-bold text-text-muted hover:text-dark-slate text-center py-1"
        >
          متابعة التصفح والبحث كزائر ←
        </button>
      </div>
    </div>
  );
}
