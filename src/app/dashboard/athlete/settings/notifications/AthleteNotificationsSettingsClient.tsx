"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCaptenly } from "@/context/CaptenlyContext";
import { Icon } from "@/components/Icon";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";

interface WhatsAppProviderStatus {
  configured: boolean;
  provider: "meta_whatsapp_cloud";
  mode: string;
  templateLang: string;
  webhookConfigured: boolean;
  cronConfigured: boolean;
  freeTierNoteAr: string;
}

interface WhatsAppDispatchItem {
  id?: string;
  dedupeKey: string;
  eventType: string;
  recipientMemberCode: string;
  recipientPhoneMasked?: string | null;
  messagePreviewAr: string;
  deliveryStatus: string;
  attemptCount: number;
  lastErrorCode?: string | null;
  createdAt?: string;
}

const EVENT_LABELS_AR: Record<string, string> = {
  attendance_checkin: "تأكيد حضور",
  absence_alert: "تنبيه غياب",
  session_reminder: "تذكير موعد حصة",
  subscription_expiring: "تنبيه قرب انتهاء الباقة",
  subscription_renewal: "تجديد اشتراك",
  receipt_confirmed: "تأكيد إيصال",
  test_message: "رسالة اختبار",
};

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  delivered: { label: "تم التسليم ✓", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  read: { label: "تمت القراءة ✓", cls: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  sent: { label: "تم الإرسال عبر Meta", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  queued: { label: "قيد الانتظار", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  failed: { label: "تعذر الإرسال (بانتظار إعادة المحاولة)", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  skipped_opt_out: { label: "متوقف حسب تفضيلك", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  skipped_no_phone: { label: "بدون رقم موبايل صالح", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  provider_unconfigured: { label: "مسجل بالنظام — بانتظار مفاتيح Meta", cls: "bg-amber-50 text-amber-900 border-amber-200" },
};

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
  const [providerStatus, setProviderStatus] = useState<WhatsAppProviderStatus | null>(null);
  const [dispatches, setDispatches] = useState<WhatsAppDispatchItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testNotice, setTestNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadWhatsAppStatusAndHistory = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/notifications/whatsapp?limit=20", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.providerStatus) setProviderStatus(data.providerStatus as WhatsAppProviderStatus);
      if (Array.isArray(data?.dispatches)) {
        setDispatches(data.dispatches as WhatsAppDispatchItem[]);
      }
    } catch {
      // ignore network error cleanly
    } finally {
      setLoadingHistory(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadWhatsAppStatusAndHistory();
  }, [loadWhatsAppStatusAndHistory]);

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

  const handleSendTest = async () => {
    setTestBusy(true);
    setTestNotice(null);
    try {
      const res = await fetch("/api/notifications/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_test",
          phone: currentPersona.phone,
          fullNameAr: currentPersona.fullNameAr,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.providerStatus) setProviderStatus(data.providerStatus as WhatsAppProviderStatus);
      setTestNotice({
        ok: Boolean(res.ok && data?.ok),
        text: data?.messageAr || "تعذر إرسال رسالة الاختبار حالياً.",
      });
      await loadWhatsAppStatusAndHistory();
    } catch {
      setTestNotice({ ok: false, text: "تعذر الاتصال بالخادم لتنفيذ الاختبار." });
    } finally {
      setTestBusy(false);
    }
  };

  const isLiveConfigured = Boolean(providerStatus?.configured);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 md:px-6 pt-6 lg:pt-6 pb-12 flex flex-col gap-6" dir="rtl">
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
          تحكم في تنبيهات الحضور والغياب ومواعيد الحصص وتجديد الباقات واستعرض سجل التسليم الفعلي
        </p>
      </div>

      <div
        className={`p-4 rounded-2xl border text-xs font-semibold leading-relaxed flex items-start gap-2.5 ${
          isLiveConfigured
            ? "bg-emerald-50 border-emerald-200 text-emerald-950"
            : "bg-amber-50 border-amber-200 text-amber-950"
        }`}
      >
        <Icon
          name={isLiveConfigured ? "verified" : "info"}
          className={`text-[18px] shrink-0 mt-0.5 ${isLiveConfigured ? "text-emerald-700" : "text-amber-700"}`}
        />
        <span>
          {providerStatus?.freeTierNoteAr ||
            "نظام إشعارات واتساب وحفظ التفضيلات يعمل على الخادم مع تسجيل جميع أحداث الحضور والغياب والتجديد."}
        </span>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-status-success/15 border border-status-success/30 text-deep-olive text-body-compact font-bold flex items-center gap-2 animate-fade-in">
          <Icon name="check_circle" className="text-[18px]" />
          <span>تم حفظ تفضيلات الحساب على الخادم بنجاح ✓</span>
        </div>
      )}

      {testNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            testNotice.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <Icon name={testNotice.ok ? "check_circle" : "info"} className="text-[18px] shrink-0" />
          <span>{testNotice.text}</span>
        </div>
      )}

      {/* WhatsApp Linked Number & Test Action Card */}
      <div className="p-4 rounded-2xl bg-surface-card border border-border-hairline shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-action-whatsapp/15 text-action-whatsapp flex items-center justify-center shrink-0">
              <Icon name="chat" className="text-[24px]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-card-title-sm text-dark-slate">
                  رقم واتساب المحفوظ بالحساب
                </span>
                {currentPersona.phone ? (
                  <span className="text-deep-olive text-[11px] font-extrabold">
                    {isLiveConfigured ? "مربوط مع Meta ✓" : "محفوظ بالحساب ✓"}
                  </span>
                ) : (
                  <span className="text-amber-700 text-[11px] font-extrabold">غير مضاف</span>
                )}
              </div>
              <p className="text-micro-caption text-text-muted mt-0.5 font-mono" dir="ltr">
                {currentPersona.phone || "لم يُضاف رقم موبايل بعد"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={testBusy}
              onClick={handleSendTest}
              className="px-4 py-2 rounded-xl bg-[#1D6E7D] hover:bg-[#155460] disabled:opacity-60 text-white text-micro-caption font-bold transition-colors"
            >
              {testBusy ? "جاري الاختبار..." : "إرسال رسالة تجريبية"}
            </button>
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
        <div className="p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="font-bold text-card-title-sm text-dark-slate block">
              تذكيرات الحصص وإشعارات الحضور والغياب عبر واتساب
            </span>
            <p className="text-micro-caption text-text-muted leading-relaxed">
              تأكيد نزول المسبح فور المسح بـ QR أو PIN وتنبيهات الغياب ومواعيد الحصص القادمة.
            </p>
          </div>
          <button
            type="button"
            aria-label="تفعيل تذكيرات الحصص والحضور عبر واتساب"
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

        <div className="p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="font-bold text-card-title-sm text-dark-slate block">
              تنبيهات قرب انتهاء الباقة وتأكيدات التجديد والإيصالات
            </span>
            <p className="text-micro-caption text-text-muted leading-relaxed">
              إشعار تلقائي عند تبقي حصتين أو أقل في الاشتراك وعند تأكيد إيصال الدفع أو تجديد الدورة.
            </p>
          </div>
          <button
            type="button"
            aria-label="تفعيل تنبيهات تجديد الباقة عبر واتساب"
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

        <div className="p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="font-bold text-card-title-sm text-dark-slate block">
              تحديثات مجلة كابتنلي الرياضية
            </span>
            <p className="text-micro-caption text-text-muted leading-relaxed">
              تفضيل محفوظ بحسابك لاستقبال ملخص مقالات الأمان المائي وتغذية السباحين.
            </p>
          </div>
          <button
            type="button"
            aria-label="تفعيل تحديثات مجلة كابتنلي"
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

      {/* Delivery Log History */}
      <section className="bg-surface-card rounded-2xl border border-border-hairline shadow-card p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-sm text-dark-slate">سجل إشعارات واتساب وحالة التسليم</h2>
          <button
            type="button"
            onClick={() => void loadWhatsAppStatusAndHistory()}
            className="text-xs font-bold text-[#1D6E7D] hover:underline"
          >
            {loadingHistory ? "جاري التحديث..." : "تحديث السجل ↻"}
          </button>
        </div>

        {dispatches.length === 0 ? (
          <div className="rounded-xl bg-surface-snow border border-border-hairline p-4 text-xs text-text-muted text-center">
            لا توجد رسائل مسجلة في سجل واتساب بعد — ستظهر هنا كل تنبيهات الحضور والتجديد ونتائج إرسالها.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {dispatches.map((d) => {
              const badge = STATUS_BADGES[d.deliveryStatus] || STATUS_BADGES.queued;
              return (
                <div
                  key={d.id || d.dedupeKey}
                  className="rounded-xl bg-surface-snow border border-border-hairline p-3.5 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-dark-slate">
                      {EVENT_LABELS_AR[d.eventType] || d.eventType}
                      {d.recipientPhoneMasked ? ` • ${d.recipientPhoneMasked}` : ""}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">{d.messagePreviewAr}</p>
                  {d.createdAt && (
                    <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                      {new Date(d.createdAt).toLocaleString("ar-EG")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
