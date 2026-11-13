"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

function Desktop10Inner() {
  const pathname = usePathname() || "/auth/login";
  const searchParams = useSearchParams();
  const router = useRouter();
  const { registerMemberUser, allPersonas, switchPersona } = useCaptenly();

  const initialTab =
    pathname.includes("/register") || searchParams?.get("mode") === "register"
      ? "register"
      : "login";

  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [role, setRole] = useState<"adult_athlete" | "parent" | "coach" | "facility_manager">(
    (searchParams?.get("role") as "adult_athlete" | "parent" | "coach" | "facility_manager") ||
      "adult_athlete"
  );

  // Register fields
  const [fullNameAr, setFullNameAr] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("المحلة الكبرى");
  const [hasParentSup, setHasParentSup] = useState(false);

  // Login fields
  const [loginPhone, setLoginPhone] = useState("");
  const [loginFeedback, setLoginFeedback] = useState<string | null>(null);

  useEffect(() => {
    setTab(pathname.includes("/register") ? "register" : "login");
  }, [pathname]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const res = registerMemberUser({
      fullNameAr: fullNameAr.trim(),
      phone: phone.trim(),
      city,
      governorate: "الغربية",
      sportPreference: "swimming",
      hasParentSupervision: role === "parent" ? true : hasParentSup,
      role,
    });
    if (res.ok) {
      router.push(`/auth/otp?code=${encodeURIComponent(res.memberCode)}&role=${role}`);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = loginPhone.trim();
    const match = allPersonas.find((p) => p.phone === clean || p.memberCode === clean.toUpperCase());
    if (match) {
      switchPersona(match.id);
      router.push(`/auth/otp?code=${encodeURIComponent(match.memberCode || "")}&role=${match.role}`);
      return;
    }
    setLoginFeedback(
      "تم إرسال رمز تحقق تجريبي — استخدم أي حساب جاهز بالأسفل أو سجّل حساباً جديداً خلال 30 ثانية."
    );
  };

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-6">
      <div className="max-w-[960px] w-full bg-surface-card rounded-[24px] shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Side Brand Panel */}
        <div className="lg:col-span-5 bg-dark-slate text-surface-card p-8 flex flex-col justify-between gap-6">
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-8">
              <img
                src="/images/logo/captenly-logo-horizontal-light.png"
                alt="كابتنلي"
                className="h-11 w-auto object-contain"
              />
            </Link>
            <h1 className="font-hero-headline text-[26px] leading-tight">
              {tab === "register"
                ? "أنشئ حسابك واحصل على كود عضويتك الفريد"
                : "مرحباً بعودتك إلى كابتنلي"}
            </h1>
            <p className="font-body-compact text-surface-container-high mt-3">
              بمجرد تسجيلك يتولد لك كود عضوية فوري لتسليمه للكابتن أو إدارة الأكاديمية وتفعيل دفتر الحصص الـ QR أوفلاين.
            </p>
          </div>

          <div className="rounded-2xl bg-deep-carbon p-4 text-xs flex flex-col gap-2">
            <div className="text-electric-volt font-bold">✓ حساب رياضي مستقل متاح للجميع</div>
            <div className="text-surface-variant">
              ربط حساب ولي الأمر اختياري تماماً للأهالي الراغبين بمتابعة حصص أطفالهم.
            </div>
          </div>
        </div>

        {/* Form Panel */}
        <div className="lg:col-span-7 p-8 flex flex-col gap-6">
          <div className="flex items-center gap-2 bg-surface-snow p-1 rounded-full w-fit">
            <button
              type="button"
              onClick={() => setTab("register")}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-colors ${
                tab === "register" ? "bg-dark-slate text-electric-volt" : "text-text-muted"
              }`}
            >
              إنشاء حساب جديد
            </button>
            <button
              type="button"
              onClick={() => setTab("login")}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-colors ${
                tab === "login" ? "bg-dark-slate text-electric-volt" : "text-text-muted"
              }`}
            >
              تسجيل الدخول
            </button>
          </div>

          {searchParams?.get("google") === "setup_required" && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 font-bold">
              مفاتيح Google OAuth غير مضافة بعد في البيئة المحلية — اضغط على زر Google بالأسفل لتجربة وضع المعاينة الذكي أو رؤية خطوات الإعداد.
            </div>
          )}

          <div className="flex flex-col gap-3">
            <GoogleSignInButton
              labelAr={
                tab === "register"
                  ? "إنشاء حساب سريع عبر Google"
                  : "تسجيل الدخول عبر حساب Google"
              }
            />
            <div className="flex items-center gap-3 text-[11px] font-bold text-text-muted">
              <span className="h-px flex-1 bg-surface-container" />
              <span>أو عبر رقم الموبايل / كود العضوية</span>
              <span className="h-px flex-1 bg-surface-container" />
            </div>
          </div>

          {tab === "register" ? (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">الاسم بالكامل *</label>
                <input
                  required
                  value={fullNameAr}
                  onChange={(e) => setFullNameAr(e.target.value)}
                  placeholder="مثال: أحمد طارق المنشاوي"
                  className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container focus:border-deep-olive"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">رقم الموبايل *</label>
                  <input
                    required
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-sm text-right outline-none border border-surface-container"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">المدينة</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
                  >
                    <option value="المحلة الكبرى">المحلة الكبرى</option>
                    <option value="طنطا">طنطا</option>
                    <option value="زفتى">زفتى</option>
                    <option value="سمنود">سمنود</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">نوع الحساب</label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(
                      e.target.value as "adult_athlete" | "parent" | "coach" | "facility_manager"
                    )
                  }
                  className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
                >
                  <option value="adult_athlete">عضو / سبّاح (مع خيار متابعة الأبناء)</option>
                  <option value="coach">كابتن سباحة (للتوثيق والاعتماد)</option>
                  <option value="facility_manager">إدارة أكاديمية أو مسبح</option>
                </select>
              </div>

              {role === "adult_athlete" && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-snow cursor-pointer text-xs text-dark-slate">
                  <input
                    type="checkbox"
                    checked={hasParentSup}
                    onChange={(e) => setHasParentSup(e.target.checked)}
                    className="accent-deep-olive w-4 h-4"
                  />
                  <span>(اختياري) تفعيل قسم إشراف ولي الأمر لمتابعة أطفال تحت 14 سنة لاحقاً</span>
                </label>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title hover:opacity-95 shadow-md"
              >
                تسجيل وتوليد كود العضوية الفريد الآن ←
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">
                  رقم الموبايل أو كود العضوية (CAP-M-XXXX)
                </label>
                <input
                  required
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="010xxxxxxxx أو CAP-M-XXXX"
                  className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
                />
              </div>

              {loginFeedback && (
                <div className="p-3 rounded-xl bg-lime-tint/70 text-deep-olive text-xs font-bold">
                  {loginFeedback}
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <Link href="/auth/forgot" className="text-deep-olive font-bold hover:underline">
                  نسيت رمز الدخول؟
                </Link>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title hover:opacity-95"
              >
                دخول بالرمز المؤكد ←
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Desktop10() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas-alabaster" />}>
      <Desktop10Inner />
    </Suspense>
  );
}
