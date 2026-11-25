import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "الصفحة غير موجودة (404)",
  description: "الصفحة المطلوبة غير متوفرة في منصة كابتنلي. تصفح المسابح والأكاديميات الموثقة في مصر.",
  robots: { index: false, follow: true },
};

export default function CaptenlyNotFoundPage() {
  return (
    <div
      className="min-h-[75vh] bg-[#F7F9FA] flex items-center justify-center px-4 py-12"
      dir="rtl"
    >
      <div className="max-w-lg w-full bg-white rounded-[28px] border border-[#0F172A]/8 shadow-[0_18px_48px_rgba(15,23,42,0.06)] p-7 sm:p-10 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center border border-[#1D6E7D]/15">
          <Icon name="pool" className="text-[32px]" />
        </div>

        <span className="px-3 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-xs font-extrabold tracking-wide">
          خطأ 404 — الصفحة غير موجودة
        </span>

        <h1 className="font-cairo font-black text-2xl sm:text-3xl text-[#0F172A] leading-snug">
          عذراً، المسار المطلوب غير متوفر على كابتنلي
        </h1>

        <p className="text-xs sm:text-sm text-[#475569] leading-relaxed max-w-md">
          قد يكون الرابط قديماً أو تغيّر موقعه. يمكنك العودة للرئيسية أو استكشاف أقرب المسابح وأكاديميات السباحة والكباتن الموثقين الآن.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
          <Link
            href="/"
            className="flex-1 py-3 px-5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs sm:text-sm font-bold text-center inline-flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Icon name="home" className="text-[17px]" />
            <span>العودة إلى الرئيسية</span>
          </Link>
          <Link
            href="/explore"
            className="flex-1 py-3 px-5 rounded-full bg-[#EAF4F8] hover:bg-[#DCEEF5] text-[#1D6E7D] border border-[#1D6E7D]/20 text-xs sm:text-sm font-bold text-center inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <Icon name="explore" className="text-[17px]" />
            <span>استكشف المسابح</span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs font-bold text-[#475569]">
          <Link href="/pools" className="hover:text-[#1D6E7D] underline">
            المسابح المدفأة
          </Link>
          <Link href="/coaches" className="hover:text-[#1D6E7D] underline">
            دليل الكباتن الموثقين
          </Link>
          <Link href="/magazine" className="hover:text-[#1D6E7D] underline">
            مجلة كابتنلي
          </Link>
        </div>
      </div>
    </div>
  );
}
