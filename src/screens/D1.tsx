"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCaptenly } from "@/context/CaptenlyContext";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { Icon } from "@/components/Icon";
import { EGYPT_CITY_PRESETS } from "@/lib/maps";
import type { AccountIntent } from "@/types/captenly";

function Desktop1Inner() {
  const router = useRouter();
  const { isAuthenticated, currentPersona, completeGoogleOnboarding } = useCaptenly();

  const [selectedRole, setSelectedRole] = useState<
    "adult_athlete" | "coach" | "facility_manager"
  >("adult_athlete");
  const [accountIntent, setAccountIntent] = useState<AccountIntent>("self_athlete");
  const [phone, setPhone] = useState(currentPersona.phone || "");
  const [city, setCity] = useState("كل مصر");
  const [saving, setSaving] = useState(false);

  const dashHref =
    currentPersona.role === "facility_manager"
      ? "/dashboard/facility"
      : currentPersona.role === "coach"
        ? "/dashboard/coach"
        : "/dashboard/athlete";

  useEffect(() => {
    if (!isAuthenticated || currentPersona.needsOnboarding || saving) return;
    router.replace(dashHref);
  }, [isAuthenticated, currentPersona.needsOnboarding, saving, dashHref, router]);

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="تسجيل الدخول لحسابك"
        descriptionAr="سجّل دخولك أو أنشئ حسابك على كابتنلي للمتابعة."
      />
    );
  }

  if (!currentPersona.needsOnboarding) {
    return (
      <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-6" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-surface-container border-t-deep-olive animate-spin" />
          <p className="text-sm font-bold text-dark-slate">جاري التحويل إلى لوحتك...</p>
        </div>
      </div>
    );
  }

  const handleConfirmOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const hasParent =
        selectedRole === "adult_athlete" &&
        (accountIntent === "parent_only" || accountIntent === "both_self_and_parent");
      const res = await completeGoogleOnboarding({
        role: hasParent ? "parent" : selectedRole,
        accountIntent: selectedRole === "adult_athlete" ? accountIntent : "self_athlete",
        phone: phone.trim(),
        city: city.trim() || "كل مصر",
        hasParentSupervision: hasParent,
      });
      router.replace(res.nextPath || "/dashboard/athlete");
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-4 md:p-8" dir="rtl">
      <div className="max-w-[760px] w-full bg-surface-card rounded-[24px] shadow-xl border border-surface-container p-6 md:p-10 flex flex-col gap-6">
        <div className="flex items-center gap-3.5">
          {currentPersona.avatarUrl ? (
            <img
              src={currentPersona.avatarUrl}
              alt={currentPersona.fullNameAr}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-electric-volt shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-dark-slate text-electric-volt flex items-center justify-center font-black text-xl shrink-0">
              {currentPersona.fullNameAr?.charAt(0) || "ك"}
            </div>
          )}
          <div>
            <span className="inline-block px-3 py-0.5 rounded-full bg-lime-tint text-deep-olive text-[11px] font-extrabold mb-1">
              خطوة لمرة واحدة عند التسجيل
            </span>
            <h1 className="font-hero-headline text-[22px] md:text-[26px] text-dark-slate">
              مرحباً {currentPersona.fullNameAr} — اختر نوع حسابك
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              سيُحفظ هذا الاختيار لحسابك دائماً ولن يظهر عند تسجيل الدخول مرة أخرى.
            </p>
          </div>
        </div>

        <form onSubmit={handleConfirmOnboarding} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: "adult_athlete" as const,
                title: "متدرب / ولي أمر",
                desc: "حجز، مقارنة أكاديميات، ومتابعة حصصك وحصص أبنائك.",
                icon: "person",
              },
              {
                id: "coach" as const,
                title: "كابتن سباحة",
                desc: "يُنشَر ملفك فوراً في البحث والرئيسية، والتوثيق اختياري للأفضلية.",
                icon: "sports",
              },
              {
                id: "facility_manager" as const,
                title: "إدارة منشأة",
                desc: "إدارة الأكاديمية أو المسبح واستلام طلبات الاشتراك.",
                icon: "pool",
              },
            ].map((item) => {
              const active = selectedRole === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedRole(item.id)}
                  className={`text-right rounded-2xl p-4 border-2 transition-all flex flex-col gap-2 ${
                    active
                      ? "border-dark-slate bg-dark-slate text-surface-card shadow-md"
                      : "border-surface-container bg-surface-snow text-dark-slate hover:border-deep-olive/50"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      active ? "bg-electric-volt text-dark-slate" : "bg-surface-card text-deep-olive"
                    }`}
                  >
                    <Icon name={item.icon} className="text-[20px]" />
                  </div>
                  <div className="font-card-title text-sm">{item.title}</div>
                  <p
                    className={`text-[11px] leading-relaxed ${
                      active ? "text-surface-container-high" : "text-text-muted"
                    }`}
                  >
                    {item.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedRole === "adult_athlete" && (
            <div className="rounded-2xl bg-surface-snow p-3.5 border border-surface-container flex flex-col gap-2">
              <span className="text-xs font-bold text-dark-slate">هل تتابع حسابات أبناء؟ (اختياري)</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    { id: "self_athlete", label: "سبّاح مستقل" },
                    { id: "parent_only", label: "ولي أمر لأبنائي" },
                    { id: "both_self_and_parent", label: "كلاهما معاً" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAccountIntent(opt.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                      accountIntent === opt.id
                        ? "bg-dark-slate text-electric-volt border-dark-slate"
                        : "bg-surface-card text-dark-slate border-surface-container"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-dark-slate">المدينة (اختياري)</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
              >
                <option value="كل مصر">كل مصر (بدون تحديد مدينة)</option>
                {EGYPT_CITY_PRESETS.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city} ({c.governorate})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-dark-slate">رقم الموبايل / واتساب (اختياري)</label>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010xxxxxxxx"
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm text-left placeholder:text-right outline-none border border-surface-container"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title shadow-md hover:opacity-95 disabled:opacity-60"
          >
            {saving ? "جاري الحفظ والتوجيه..." : "تأكيد نوع الحساب والمتابعة ←"}
          </button>
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
