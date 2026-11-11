"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCaptenly } from "@/context/CaptenlyContext";

export default function NotificationSettingsPage() {
  const { currentPersona, userSettings, updateUserSettings } = useCaptenly();
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleToggle = (key: keyof typeof userSettings) => {
    updateUserSettings({ [key]: !userSettings[key] });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
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
          <span className="text-deep-olive font-bold">تفضيلات الإشعارات ورسائل واتساب</span>
        </nav>

        <h1 className="font-cairo font-bold text-section-title text-dark-slate">
          تفضيلات التنبيهات المباشرة ورسائل واتساب
        </h1>
        <p className="text-body-compact text-text-muted">
          تحكم في التذكيرات الفورية بمواعيد الحصص وأكواد الحضور وتنبيهات تجديد الباقة
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-status-success/15 border border-status-success/30 text-deep-olive text-body-compact font-bold flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>تم حفظ التفضيلات بنجاح!</span>
        </div>
      )}

      {/* WhatsApp Linked Number Card */}
      <div className="p-4 rounded-2xl bg-surface-card border border-border-hairline shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-action-whatsapp/15 text-action-whatsapp flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">chat</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-card-title-sm text-dark-slate">
                رقم واتساب المرتبط بالتنبيهات
              </span>
              <span className="px-2 py-0.5 rounded bg-lime-tint text-deep-olive text-[10px] font-bold">
                نشط ✓
              </span>
            </div>
            <p className="text-micro-caption text-text-muted mt-0.5 font-mono">
              {currentPersona.phone}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-dark-slate text-micro-caption font-bold transition-colors"
        >
          تغيير الرقم
        </button>
      </div>

      {/* Preferences Toggles List */}
      <div className="bg-surface-card rounded-2xl border border-border-hairline shadow-card overflow-hidden divide-y divide-border-hairline">
        {/* Toggle 1: Session 2-Hour Reminder */}
        <div className="p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="font-bold text-card-title-sm text-dark-slate block">
              تذكير الحصة القادمة قبل موعدها بساعتين
            </span>
            <p className="text-micro-caption text-text-muted leading-relaxed">
              إرسال رسالة تذكير فورية مع كود الـ QR الخاص بالحضور ورقم المسار المخصص للسباح بمسبح النادي.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggle("notifyWhatsappSessions")}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
              userSettings.notifyWhatsappSessions ? "bg-deep-olive" : "bg-surface-container-high"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                userSettings.notifyWhatsappSessions ? "right-0.5 translate-x-0" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {/* Toggle 2: Renewal SLA Alert */}
        <div className="p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="font-bold text-card-title-sm text-dark-slate block">
              تنبيهات تجديد الباقة الشهرية (عند تبقي حصتين)
            </span>
            <p className="text-micro-caption text-text-muted leading-relaxed">
              إشعار مسبق قبل انتهاء رصيد دفتر الحصص لتجنب انقطاع الطفل عن مواعيده التدريبية وتأكيد حجز الشهر الجديد.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggle("notifyWhatsappRenewals")}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
              userSettings.notifyWhatsappRenewals ? "bg-deep-olive" : "bg-surface-container-high"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                userSettings.notifyWhatsappRenewals ? "right-0.5 translate-x-0" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {/* Toggle 3: Editorial & Newsletter */}
        <div className="p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="font-bold text-card-title-sm text-dark-slate block">
              نشرة مجلة كابتنلي الرياضية الأسبوعية
            </span>
            <p className="text-micro-caption text-text-muted leading-relaxed">
              تلقي أحدث مقالات واستشارات الأمان المائي وتغذية السباحين وتكنيك السباقات الصادرة من الأطباء الرياضيين.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggle("notifyEmailMarketing")}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
              userSettings.notifyEmailMarketing ? "bg-deep-olive" : "bg-surface-container-high"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                userSettings.notifyEmailMarketing ? "right-0.5 translate-x-0" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
