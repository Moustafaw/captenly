"use client";

import React from "react";
import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="w-full bg-dark-slate text-surface-snow border-t border-white/10 pt-12 pb-24 md:pb-12" dir="rtl">
      <div className="max-w-[1340px] mx-auto px-4 md:px-6 space-y-10">
        {/* Top 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Slogan Column */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-electric-volt text-dark-slate flex items-center justify-center font-bold">
                C
              </div>
              <span className="font-cairo font-bold text-[22px] text-surface-card">
                كابتنلي CAPTENLY
              </span>
            </div>
            <p className="text-body-compact text-surface-variant leading-relaxed max-w-xl">
              المنظومة الرقمية لاكتشاف الأكاديميات والمسابح وصالات الجيم، توثيق الكباتن بـ 6 شارات معتمدة، جواز السفر الرياضي الموثق، ودفتر الحصص الرقمي لحفظ حقوق أولياء الأمور والرياضيين.
            </p>
            <div className="inline-flex items-center gap-2 text-micro-caption bg-white/5 border border-white/10 text-surface-snow px-3.5 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-[16px] text-electric-volt">
                location_on
              </span>
              <span>
                نقطة الانطلاق التشغيلية: المحلة الكبرى — محافظة الغربية والدلتا — مصر
              </span>
            </div>
          </div>

          {/* Quick Links Column */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-surface-card text-card-title-sm border-b border-white/10 pb-2">
              استكشف المنصة
            </h4>
            <ul className="space-y-2 text-micro-caption text-surface-variant">
              <li>
                <Link href="/explore" className="hover:text-electric-volt transition-colors">
                  دليل المنشآت والأكاديميات
                </Link>
              </li>
              <li>
                <Link href="/explore?category=pools" className="hover:text-electric-volt transition-colors">
                  مسابح الغربية والدلتا المعتمدة
                </Link>
              </li>
              <li>
                <Link href="/compare" className="hover:text-electric-volt transition-colors">
                  أداة المقارنة السريعة بين الأكاديميات
                </Link>
              </li>
              <li>
                <Link href="/dashboard/athlete" className="hover:text-electric-volt transition-colors">
                  دفتر الحصص والجواز الرياضي
                </Link>
              </li>
              <li>
                <Link href="/magazine" className="hover:text-electric-volt transition-colors">
                  مجلة ومقالات كابتنلي الرياضية
                </Link>
              </li>
              <li>
                <Link href="/badges" className="hover:text-electric-volt transition-colors">
                  مركز التوثيق والشارات الست
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Compliance Column */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-surface-card text-card-title-sm border-b border-white/10 pb-2">
              الحوكمة والامتثال القانوني
            </h4>
            <ul className="space-y-2 text-micro-caption text-surface-variant">
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-electric-volt shrink-0 mt-0.5">
                  gavel
                </span>
                <span>
                  <strong>القانون رقم 3 لسنة 1985:</strong> حظر الإدعاءات الطبية غير المرخصة وحصر التدريب في النطاق الرياضي البدني.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-electric-volt shrink-0 mt-0.5">
                  lock
                </span>
                <span>
                  <strong>القانون رقم 151 لسنة 2020:</strong> حماية مشددة لبيانات وسجلات الأطفال القُصّر بموافقة ولي الأمر الصريحة.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-electric-volt shrink-0 mt-0.5">
                  price_check
                </span>
                <span>
                  <strong>سياسة الشفافية السعرية:</strong> التزام المنشآت بثبات السعر الشامل وتحديثه دورياً.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Rights Strip */}
        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-micro-caption text-surface-variant">
          <span>
            جميع الحقوق محفوظة © {new Date().getFullYear()} لمنصة كابتنلي (CAPTENLY)
          </span>
          <div className="flex items-center gap-4">
            <Link href="/auth" className="hover:text-electric-volt transition-colors">
              تسجيل الكباتن والمنشآت
            </Link>
            <span>•</span>
            <a
              href="https://wa.me/201019000000"
              target="_blank"
              rel="noopener noreferrer"
              className="text-action-whatsapp hover:underline font-bold flex items-center gap-1"
            >
              <span>دعم واتساب المباشر</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
