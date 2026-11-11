"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCaptenly } from "@/context/CaptenlyContext";

export default function SecuritySettingsPage() {
  const { currentPersona, userSettings, updateUserSettings } = useCaptenly();
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadData = () => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6" dir="rtl">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col gap-2">
        <nav className="flex items-center gap-1.5 text-micro-caption text-text-muted">
          <Link href="/dashboard/athlete/settings" className="hover:text-dark-slate transition-colors">
            الإعدادات
          </Link>
          <span>/</span>
          <span className="text-deep-olive font-bold">الخصوصية والأمان</span>
        </nav>

        <h1 className="font-cairo font-bold text-section-title text-dark-slate">
          إعدادات الأمان والخصوصية وحماية البيانات
        </h1>
        <p className="text-body-compact text-text-muted">
          إدارة حماية الحساب، التحقق الثنائي عبر OTP، وتنزيل نسخة رسمية من السجلات
        </p>
      </div>

      {downloadSuccess && (
        <div className="p-3 rounded-xl bg-status-success/15 border border-status-success/30 text-deep-olive text-body-compact font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">file_download_done</span>
          <span>تم تجهيز نسخة بياناتك الشخصية الموثقة وتنزيلها بصيغة JSON آمنة!</span>
        </div>
      )}

      {/* Security Cards */}
      <div className="space-y-4">
        {/* Card 1: OTP Authentication */}
        <div className="p-5 rounded-2xl bg-surface-card border border-border-hairline shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lime-tint text-deep-olive flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">phonelink_lock</span>
              </div>
              <div>
                <h3 className="font-bold text-card-title-sm text-dark-slate">
                  التحقق السريع عبر رسائل رمز الهاتف (SMS OTP)
                </h3>
                <p className="text-micro-caption text-text-muted">
                  تسجيل دخول آمن وفوري بدون الحاجة لكلمات مرور معقدة
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-lime-tint text-deep-olive text-micro-caption font-bold">
              مفعّل ✓
            </span>
          </div>
          <p className="text-micro-caption text-text-muted leading-relaxed">
            يتم إرسال رمز تحقق مؤقت مكون من 4 أرقام لهاتفك ({currentPersona.phone}) عند كل تسجيل دخول جديد لمنع أي محاولات وصول غير مصرح بها.
          </p>
        </div>

        {/* Card 2: Privacy by Default (Law 151) */}
        <div className="p-5 rounded-2xl bg-surface-card border border-border-hairline shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-snow text-dark-slate flex items-center justify-center border border-border-hairline">
                <span className="material-symbols-outlined text-[20px]">visibility_off</span>
              </div>
              <div>
                <h3 className="font-bold text-card-title-sm text-dark-slate">
                  حالة إخفاء الملف الشخصي وسجلات الأبناء
                </h3>
                <p className="text-micro-caption text-text-muted">
                  مضبوط افتراضياً على الخصوصية التامة (Private Profile)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateUserSettings({ privacyProfilePublic: !userSettings.privacyProfilePublic })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                userSettings.privacyProfilePublic ? "bg-amber-600" : "bg-deep-olive"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  userSettings.privacyProfilePublic ? "left-0.5" : "right-0.5"
                }`}
              />
            </button>
          </div>
          <p className="text-micro-caption text-text-muted leading-relaxed">
            {userSettings.privacyProfilePublic
              ? "الملف ظاهر جزئياً للأكاديميات المعتمدة للترشيح المباشر."
              : "الملف مخفي بالكامل ومحمي، ولن يظهر إلا للمدربين والمنشآت التي توافق على إعطائها كود الربط الخاص بك."}
          </p>
        </div>

        {/* Card 3: Data Export / Portability */}
        <div className="p-5 rounded-2xl bg-surface-card border border-border-hairline shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-snow text-dark-slate flex items-center justify-center border border-border-hairline">
                <span className="material-symbols-outlined text-[20px]">download</span>
              </div>
              <div>
                <h3 className="font-bold text-card-title-sm text-dark-slate">
                  حق تصدير وتنزيل البيانات (قانون رقم 151)
                </h3>
                <p className="text-micro-caption text-text-muted">
                  تنزيل سجل دفتر الحصص والأزمنة القياسية والإيصالات
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadData}
              className="px-4 py-2 rounded-xl bg-dark-slate text-electric-volt font-bold text-micro-caption hover:bg-deep-carbon transition-colors"
            >
              تنزيل أرشيفي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
