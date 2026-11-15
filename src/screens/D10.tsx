"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import type { AccountIntent } from "@/types/captenly";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { EGYPT_CITY_PRESETS } from "@/lib/maps";
import { resolveGovernorateFromCity } from "@/lib/facilityPricing";

function Desktop10Inner() {
  const pathname = usePathname() || "/auth/login";
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    registerMemberWithCredentials,
    restoreProfileByLogin,
    addMinorAthlete,
    userLocation,
  } = useCaptenly();

  const initialTab =
    pathname.includes("/register") || searchParams?.get("mode") === "register"
      ? "register"
      : "login";

  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const rawRoleParam = searchParams?.get("role");
  const normalizedInitialRole: "adult_athlete" | "coach" | "facility_manager" =
    rawRoleParam === "coach" || rawRoleParam === "facility_manager"
      ? rawRoleParam
      : "adult_athlete";
  const [role, setRole] = useState<"adult_athlete" | "coach" | "facility_manager">(
    normalizedInitialRole
  );
  const [accountIntent, setAccountIntent] = useState<AccountIntent>("self_athlete");
  const [addFirstChild, setAddFirstChild] = useState(false);
  const [firstChildName, setFirstChildName] = useState("");
  const [firstChildAge, setFirstChildAge] = useState("8");
  const [firstChildGender, setFirstChildGender] = useState<"male" | "female">("male");

  // Register fields
  const [fullNameAr, setFullNameAr] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState(
    userLocation.isSpecified && userLocation.city ? userLocation.city : "كل مصر"
  );
  const [registerFeedback, setRegisterFeedback] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  // Login fields
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginFeedback, setLoginFeedback] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    setTab(pathname.includes("/register") ? "register" : "login");
  }, [pathname]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterFeedback(null);
    const digitsOnly = phone.replace(/\D/g, "");
    const normalizedPhone =
      digitsOnly.startsWith("20") && digitsOnly.length === 12
        ? `0${digitsOnly.slice(2)}`
        : digitsOnly;
    if (!/^01[0125]\d{8}$/.test(normalizedPhone)) {
      setRegisterFeedback(
        "يرجى إدخال رقم موبايل مصري صحيح (11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015)."
      );
      return;
    }
    setRegistering(true);
    try {
      const governorate =
        city === "كل مصر" ? "مصر" : resolveGovernorateFromCity(city, "مصر");
      const effectiveParent =
        role === "adult_athlete" &&
        (accountIntent === "parent_only" || accountIntent === "both_self_and_parent");
      const res = await registerMemberWithCredentials({
        fullNameAr: fullNameAr.trim(),
        phone: normalizedPhone,
        email: email.trim() || undefined,
        password,
        city,
        governorate,
        sportPreference: "swimming",
        hasParentSupervision: effectiveParent,
        role,
        accountIntent: role === "adult_athlete" ? accountIntent : "self_athlete",
      });
      if (!res.ok) {
        setRegisterFeedback(res.messageAr || "تعذّر إنشاء الحساب. تأكد من البيانات.");
        return;
      }
      if (effectiveParent && addFirstChild && firstChildName.trim()) {
        addMinorAthlete({
          fullNameAr: firstChildName.trim(),
          age: Number(firstChildAge) || 8,
          gender: firstChildGender,
          primarySport: "swimming",
        });
      }
      if (res.nextPath) {
        router.push(res.nextPath);
      } else if (role === "coach") {
        router.push("/claim?mode=coach");
      } else if (role === "facility_manager") {
        router.push("/claim");
      } else {
        router.push("/dashboard/athlete");
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = loginPhone.trim();
    if (!clean) return;
    setLoggingIn(true);
    setLoginFeedback(null);
    try {
      const res = await restoreProfileByLogin(clean, loginPassword);
      if (res.ok && res.persona) {
        const targetRole = res.persona.role;
        if (targetRole === "facility_manager") {
          router.push("/dashboard/facility");
        } else if (targetRole === "coach") {
          router.push("/dashboard/coach");
        } else {
          router.push("/dashboard/athlete");
        }
        return;
      }
      setLoginFeedback(
        res.messageAr ||
          "بيانات الدخول غير صحيحة أو الحساب غير مسجّل. يمكنك إنشاء حساب جديد أو استخدام Google."
      );
    } finally {
      setLoggingIn(false);
    }
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
              onClick={() => {
                setTab("register");
                router.replace("/auth/register");
              }}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-colors ${
                tab === "register" ? "bg-dark-slate text-electric-volt" : "text-text-muted"
              }`}
            >
              إنشاء حساب جديد
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("login");
                router.replace("/auth/login");
              }}
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
                    className="rounded-xl bg-surface-snow px-4 py-3 text-sm text-left placeholder:text-right outline-none border border-surface-container"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">المدينة (تتزامن مع موقعك الجغرافي)</label>
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">البريد الإلكتروني (اختياري للاستعادة)</label>
                  <input
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-sm text-left placeholder:text-right outline-none border border-surface-container"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">كلمة المرور * (6 أحرف فأكثر)</label>
                  <input
                    required
                    minLength={6}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">نوع الحساب</label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(
                      e.target.value as "adult_athlete" | "coach" | "facility_manager"
                    )
                  }
                  className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
                >
                  <option value="adult_athlete">سبّاح / متدرب وولي أمر (حساب موحد)</option>
                  <option value="coach">كابتن سباحة (يتطلب توثيق ومراجعة لاحقة)</option>
                  <option value="facility_manager">إدارة أكاديمية أو مسبح (يتطلب توثيق ومراجعة)</option>
                </select>
              </div>

              {role === "adult_athlete" ? (
                <div className="rounded-2xl bg-surface-snow p-3.5 border border-surface-container flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-dark-slate">
                      كيف تخطط لاستخدام الحساب الموحد؟
                    </span>
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
                          onClick={() => {
                            setAccountIntent(opt.id);
                            if (opt.id === "self_athlete") setAddFirstChild(false);
                          }}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                            accountIntent === opt.id
                              ? "bg-dark-slate text-electric-volt border-dark-slate"
                              : "bg-surface-card text-dark-slate border-surface-container hover:border-deep-olive"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(accountIntent === "parent_only" || accountIntent === "both_self_and_parent") && (
                    <div className="pt-2 border-t border-surface-container flex flex-col gap-2.5">
                      <label className="flex items-center gap-2 text-xs font-bold text-deep-olive cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addFirstChild}
                          onChange={(e) => setAddFirstChild(e.target.checked)}
                          className="w-4 h-4 accent-deep-olive rounded"
                        />
                        <span>إضافة ملف ابني الأول الآن لتوليد كود CAP-JR خاص به</span>
                      </label>

                      {addFirstChild && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            value={firstChildName}
                            onChange={(e) => setFirstChildName(e.target.value)}
                            placeholder="اسم الابن"
                            className="sm:col-span-1 rounded-xl bg-surface-card px-3 py-2 text-xs outline-none border border-surface-container"
                          />
                          <input
                            type="number"
                            min={3}
                            max={17}
                            value={firstChildAge}
                            onChange={(e) => setFirstChildAge(e.target.value)}
                            placeholder="العمر"
                            className="rounded-xl bg-surface-card px-3 py-2 text-xs outline-none border border-surface-container"
                          />
                          <select
                            value={firstChildGender}
                            onChange={(e) =>
                              setFirstChildGender(e.target.value as "male" | "female")
                            }
                            className="rounded-xl bg-surface-card px-3 py-2 text-xs outline-none border border-surface-container"
                          >
                            <option value="male">ذكر (سباح)</option>
                            <option value="female">أنثى (سباحة)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-lime-tint/60 border border-deep-olive/30 p-3 text-[11px] font-bold text-deep-olive leading-relaxed">
                  سيتم إنشاء حسابك المبدئي أولاً ثم نقلك مباشرة لاستكمال رفع مستندات التوثيق في صفحة الاعتماد (/claim) لمراجعة الإدارة قبل تفعيل الصلاحية المهنية.
                </div>
              )}

              {registerFeedback && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                  {registerFeedback}
                </div>
              )}

              <button
                type="submit"
                disabled={registering}
                className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title hover:opacity-95 shadow-md disabled:opacity-60"
              >
                {registering ? "جاري تأمين الحساب..." : "إنشاء الحساب وتوليد كود العضوية الآن ←"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">
                  رقم الموبايل أو البريد الإلكتروني أو كود العضوية (CAP-M-XXXX)
                </label>
                <input
                  required
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="010xxxxxxxx أو البريد أو CAP-M-XXXX"
                  className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-dark-slate">كلمة المرور *</label>
                <input
                  required
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
                />
              </div>

              {loginFeedback && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                  {loginFeedback}
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <Link href="/auth/forgot" className="text-deep-olive font-bold hover:underline">
                  نسيت كلمة المرور؟
                </Link>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title hover:opacity-95 disabled:opacity-60"
              >
                {loggingIn ? "جاري التحقق والدخول..." : "تسجيل الدخول ←"}
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
