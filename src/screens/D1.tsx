"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { QrCodeBox } from "@/components/editorial/QrCodeBox";
import { GoogleMark } from "@/components/auth/GoogleSignInButton";
import { EGYPT_CITY_PRESETS } from "@/lib/maps";

import type { AccountIntent } from "@/types/captenly";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";

const INTENT_OPTIONS: {
  key: AccountIntent;
  titleAr: string;
  descAr: string;
  icon: string;
}[] = [
  {
    key: "self_athlete",
    titleAr: "سبّاح / متدرب مستقل",
    descAr: "متابعة باقاتك وحصصك بالـ QR وأرقامك القياسية وتقييمات الكباتن.",
    icon: "pool",
  },
  {
    key: "parent_only",
    titleAr: "ولي أمر لمتابعة الأبناء",
    descAr: "إنشاء ملفات الأبناء القُصّر (CAP-JR) ومتابعة حضورهم وتطورهم المائي.",
    icon: "family_restroom",
  },
  {
    key: "both_self_and_parent",
    titleAr: "سبّاح وولي أمر معاً (موصى به)",
    descAr: "إدارة نشاطك الرياضي الشخصي ومتابعة ملفات أبنائك من حساب واحد موحد.",
    icon: "diversity_3",
  },
];

function Desktop1Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isAuthenticated,
    currentPersona,
    userLocation,
    addMinorAthlete,
    completeGoogleOnboarding,
  } = useCaptenly();

  const initialIntent: AccountIntent = currentPersona.accountIntent || "self_athlete";
  const [selectedIntent, setSelectedIntent] = useState<AccountIntent>(initialIntent);
  const [phone, setPhone] = useState(currentPersona.phone || "");
  const [city, setCity] = useState(
    (userLocation.isSpecified && userLocation.city) || currentPersona.city || "كل مصر"
  );
  const [copied, setCopied] = useState(false);
  const [addChildOptional, setAddChildOptional] = useState(initialIntent !== "self_athlete");
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("8");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const isGoogleSource =
    searchParams?.get("source") === "google" || currentPersona.authProvider === "google";

  const displayMemberCode = currentPersona.memberCode || "CAP-M-PENDING";

  const copyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(displayMemberCode).catch(() => undefined);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="استكمال تجهيز الحساب وكود العضوية"
        descriptionAr="سجّل دخولك أو أنشئ حسابك أولاً لإصدار كود العضوية واختيار وضع الاستخدام."
      />
    );
  }

  if (!currentPersona.needsOnboarding && currentPersona.role !== "guest") {
    const dashHref =
      currentPersona.role === "facility_manager"
        ? "/dashboard/facility"
        : currentPersona.role === "coach"
        ? "/dashboard/coach"
        : "/dashboard/athlete";
    return (
      <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-lg w-full bg-surface-card rounded-[24px] p-6 sm:p-8 shadow-xl border border-surface-container flex flex-col gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-lime-tint text-deep-olive flex items-center justify-center mx-auto">
            <Icon name="verified_user" className="text-[28px]" />
          </div>
          <h1 className="font-section-title text-dark-slate">
            تم استكمال تجهيز حسابك مسبقاً ✓
          </h1>
          <p className="text-xs text-text-muted leading-relaxed">
            كود عضويتك النشط:{" "}
            <strong dir="ltr" className="font-mono text-dark-slate">
              {displayMemberCode}
            </strong>
            . يمكنك تعديل بياناتك من الإعدادات أو تقديم طلب توثيق كابتن أو منشأة من صفحة الاعتماد.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Link
              href={dashHref}
              className="flex-1 py-3 rounded-full bg-dark-slate text-electric-volt text-xs font-bold text-center"
            >
              الذهاب إلى لوحتي ←
            </Link>
            <Link
              href="/claim"
              className="flex-1 py-3 rounded-full bg-surface-snow border border-surface-container text-dark-slate text-xs font-bold text-center hover:bg-lime-tint/40"
            >
              توثيق كابتن أو منشأة
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    const trimmedPhone = phone.trim();
    if (trimmedPhone) {
      const digitsOnly = trimmedPhone.replace(/\D/g, "");
      const normalizedPhone =
        digitsOnly.startsWith("20") && digitsOnly.length === 12
          ? `0${digitsOnly.slice(2)}`
          : digitsOnly;
      if (!/^01[0125]\d{8}$/.test(normalizedPhone)) {
        setFeedbackError("يرجى إدخال رقم موبايل مصري صحيح (11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015) أو تركه فارغاً الآن.");
        return;
      }
    }

    const res = completeGoogleOnboarding({
      role: "adult_athlete",
      accountIntent: selectedIntent,
      phone: trimmedPhone,
      city,
      hasParentSupervision: selectedIntent !== "self_athlete",
    });

    if (selectedIntent !== "self_athlete" && addChildOptional && childName.trim()) {
      addMinorAthlete({
        fullNameAr: childName.trim(),
        age: Number(childAge) || 8,
        gender: "male",
        primarySport: "swimming",
      });
    }

    router.push(res.nextPath || "/dashboard/athlete");
  };

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-[860px] w-full bg-surface-card rounded-[24px] p-6 sm:p-8 md:p-10 shadow-xl flex flex-col gap-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-lime-tint text-deep-olive text-xs font-bold">
                تجهيز الحساب الموحد
              </span>
              {isGoogleSource && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-snow border border-surface-container text-xs font-bold text-dark-slate">
                  <GoogleMark className="w-3.5 h-3.5" />
                  <span>تم التوثيق عبر Google</span>
                </span>
              )}
            </div>
            <h1 className="font-hero-headline text-[24px] sm:text-[26px] text-dark-slate mt-2">
              أهلاً {currentPersona.fullNameAr}! تم تجهيز كود عضويتك الرقمي
            </h1>
            {currentPersona.email && (
              <p className="text-xs font-mono text-text-muted mt-1" dir="ltr">
                {currentPersona.email}
              </p>
            )}
          </div>
          <Link href="/dashboard/athlete" className="text-xs font-bold text-text-muted hover:text-dark-slate">
            تخطي لحسابي ←
          </Link>
        </div>

        {/* Pulled Google Profile + Member Identity Banner */}
        <div className="rounded-2xl bg-dark-slate text-surface-card p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-right">
            {currentPersona.avatarUrl ? (
              <img
                src={currentPersona.avatarUrl}
                alt={currentPersona.fullNameAr}
                className="w-16 h-16 rounded-full object-cover border-2 border-electric-volt shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-deep-carbon text-electric-volt flex items-center justify-center font-extrabold text-lg shrink-0">
                {currentPersona.fullNameAr.slice(0, 2)}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-electric-volt font-bold">
                كود العضوية الفريد (سبّاح / ولي أمر)
              </span>
              <div className="text-3xl font-mono font-black tracking-wider text-white">
                {displayMemberCode}
              </div>
              <p className="text-xs text-surface-container-high max-w-md leading-relaxed">
                عند الاشتراك مع أي كابتن أو أكاديمية موثقة على كابتنلي، يصدر لك كود اشتراك خاص بباقتك لتسجيل الحضور بالـ QR أوفلاين.
              </p>
              <button
                type="button"
                onClick={copyCode}
                className="mt-1 px-4 py-2 rounded-full bg-electric-volt text-dark-slate text-xs font-bold w-fit mx-auto sm:mx-0 flex items-center gap-1.5"
              >
                <Icon name={copied ? "check" : "content_copy"} className="text-[15px]" />
                <span>{copied ? "تم النسخ!" : "نسخ الكود"}</span>
              </button>
            </div>
          </div>
          <QrCodeBox value={`CAP-MEMBER:${displayMemberCode}`} size={126} label={displayMemberCode} />
        </div>

        <form onSubmit={handleFinish} className="flex flex-col gap-5">
          {/* Account Intent Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-dark-slate">
              1) كيف ستستخدم حساب كابتنلي الموحد؟
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {INTENT_OPTIONS.map((opt) => {
                const active = selectedIntent === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setSelectedIntent(opt.key);
                      setAddChildOptional(opt.key !== "self_athlete");
                    }}
                    className={`text-right p-4 rounded-2xl border transition-all flex items-start gap-3 ${
                      active
                        ? "bg-lime-tint/70 border-deep-olive shadow-sm"
                        : "bg-surface-snow border-surface-container hover:border-deep-olive/50"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        active ? "bg-dark-slate text-electric-volt" : "bg-white text-deep-olive"
                      }`}
                    >
                      <Icon name={opt.icon} className="text-[20px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-card-title-sm text-dark-slate">{opt.titleAr}</div>
                      <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{opt.descAr}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Phone + City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-dark-slate">
                2) رقم الموبايل / الواتساب{" "}
                <span className="text-deep-olive font-normal">(اختياري — يُنصح به لإشعارات الحصص)</span>
              </label>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010xxxxxxxx"
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm text-left placeholder:text-right outline-none border border-surface-container focus:border-deep-olive"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-dark-slate">المدينة (تتزامن تلقائياً مع الموقع بالبار العلوي)</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container focus:border-deep-olive"
              >
                <option value="كل مصر">كل مصر (تصفّح عام بدون تحديد مدينة الآن)</option>
                {EGYPT_CITY_PRESETS.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city} ({c.governorate})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedIntent !== "self_athlete" && (
            <>
              <label className="flex items-center gap-3 p-4 rounded-2xl bg-surface-snow cursor-pointer border border-surface-container">
                <input
                  type="checkbox"
                  checked={addChildOptional}
                  onChange={(e) => setAddChildOptional(e.target.checked)}
                  className="w-4 h-4 accent-deep-olive"
                />
                <div>
                  <div className="font-card-title-sm text-dark-slate">
                    إضافة ملف الطفل الآن لتوليد كود فرعي (CAP-JR)
                  </div>
                  <div className="text-xs text-text-muted">
                    يمكنك إضافة الأبناء الآن أو لاحقاً من قسم متابعة الأبناء والأسرة.
                  </div>
                </div>
              </label>

              {addChildOptional && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-snow">
                  <input
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="اسم الطفل"
                    className="rounded-xl bg-white px-4 py-2.5 text-sm outline-none border border-surface-container"
                  />
                  <input
                    type="number"
                    min={4}
                    max={17}
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                    placeholder="العمر"
                    className="rounded-xl bg-white px-4 py-2.5 text-sm outline-none border border-surface-container"
                  />
                </div>
              )}
            </>
          )}

          {feedbackError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
              {feedbackError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title shadow-md hover:opacity-95"
          >
            حفظ الإعدادات والدخول للمنصة ←
          </button>

          <div className="text-center text-xs text-text-muted pt-1">
            هل أنت كابتن سباحة أو مدير منشأة وتريد اعتماد حسابك؟{" "}
            <Link href="/claim" className="text-deep-olive font-bold hover:underline">
              تقديم طلب توثيق عبر صفحة الاعتماد (/claim) ←
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Desktop1() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas-alabaster" />}>
      <Desktop1Inner />
    </Suspense>
  );
}
