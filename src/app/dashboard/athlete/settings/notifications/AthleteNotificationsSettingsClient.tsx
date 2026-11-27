"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCaptenly } from "@/context/CaptenlyContext";
import { Icon } from "@/components/Icon";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";

export default function NotificationSettingsPage() {
  const {
    isAuthenticated,
    currentPersona,
    userSettings,
    updateUserSettings,
    updateCurrentPersonaProfile,
  } = useCaptenly();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(currentPersona.phone || "");

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="إعدادات الإشعارات وواتساب"
        descriptionAr="سجّل دخولك أولاً لتحديث رقم التنبيهات والتحكم في تفضيلات الإشعارات."
      />
    );
  }

  const handleToggle = (key: keyof typeof userSettings) => {
    updateUserSettings({ [key]: !userSettings[key] });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleSavePhone = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phoneInput.trim();
    if (!cleaned) return;
    updateCurrentPersonaProfile({ phone: cleaned });
    setEditingPhone(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 md:px-6 pt-6 lg:pt-6 pb-12 flex flex-col gap-6" dir="rtl">
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
          تفضيلات التنبيهات ورسائل واتساب
        </h1>
        <p className="text-body-compact text-text-muted">
          تحكم في تفضيلات الحساب للتذكيرات بمواعيد الحصص وتنبيهات تجديد الباقة والنشرة الرياضية
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-semibold leading-relaxed flex items-start gap-2.5">
        <Icon name="info" className="text-[18px] text-amber-700 shrink-0 mt-0.5" />
        <span>
          تُحفظ هذه الخيارات كتفضيلات لحسابك فقط؛ الإرسال التلقائي للتنبيهات عبر واتساب والبريد الإلكتروني غير مفعّل بعد على الخادم، بينما تظهر التنبيهات داخل المنصة عند الاستخدام.
        </span>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-status-success/15 border border-status-success/30 text-deep-olive text-body-compact font-bold flex items-center gap-2 animate-fade-in">
          <Icon name="check_circle" className="text-[18px]" />
          <span>تم حفظ تفضيلات الحساب بنجاح!</span>
        </div>
      )}

      {/* WhatsApp Linked Number Card */}
      <div className="p-4 rounded-2xl bg-surface-card border border-border-hairline shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-action-whatsapp/15 text-action-whatsapp flex items-center justify-center shrink-0">
              <Icon name="chat" className="text-[24px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-card-title-sm text-dark-slate">
                  رقم واتساب المحفوظ بالحساب
                </span>
                {currentPersona.phone ? (
                  <span className="text-deep-olive text-[11px] font-extrabold">محفوظ ✓ (الإرسال التلقائي غير مفعّل بعد)</span>
                ) : (
                  <span className="text-amber-700 text-[11px] font-extrabold">غير مضاف</span>
                )}
              </div>
              <p className="text-micro-caption text-text-muted mt-0.5 font-mono" dir="ltr">
                {currentPersona.phone || "لم يُضاف رقم موبايل بعد"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPhoneInput(currentPersona.phone || "");
              setEditingPhone((v) => !v);
            }}
            className="px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-dark-slate text-micro-caption font-bold transition-colors"
          >
            {editingPhone ? "إلغاء" : "تغيير الرقم"}
          </button>
        </div>

        {editingPhone && (
          <form onSubmit={handleSavePhone} className="flex flex-wrap gap-2 pt-2 border-t border-border-hairline">
            <input
              required
              type="tel"
              dir="ltr"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="010xxxxxxxx"
              className="flex-1 min-w-[180px] rounded-xl bg-surface-snow px-3.5 py-2 text-xs text-right border border-border-hairline outline-none"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-dark-slate text-electric-volt text-xs font-bold"
            >
              حفظ الرقم
            </button>
          </form>
        )}
      </div>

      {/* Preferences Toggles List */}
      <div className="bg-surface-card rounded-2xl border border-border-hairline shadow-card overflow-hidden divide-y divide-border-hairline">
        {/* Toggle 1: Session 2-Hour Reminder */}
        <div className="p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="font-bold text-card-title-sm text-dark-slate block">
              تفضيل تذكير الحصة القادمة (عند تفعيل التنبيهات الآلية)
            </span>
            <p className="text-micro-caption text-text-muted leading-relaxed">
              تفضيل محفوظ بحسابك لاستلام تذكير بموعد الحصة وكود الحضور فور تفعيل خدمة التنبيهات الآلية عبر واتساب.
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
              تفضيل تنبيهات تجديد الباقة الشهرية (عند تبقي حصتين)
            </span>
            <p className="text-micro-caption text-text-muted leading-relaxed">
              تفضيل محفوظ بحسابك لتلقي تنبيهات التجديد داخل الحساب ومستقبلاً عبر واتساب عند انخفاض رصيد الحصص.
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
              تفضيل نشرة مجلة كابتنلي الرياضية (قريباً)
            </span>
            <p className="text-micro-caption text-text-muted leading-relaxed">
              تفضيل محفوظ بحسابك لتلقي ملخص مقالات الأمان المائي وتغذية السباحين عند تفعيل خدمة النشرة البريدية.
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
