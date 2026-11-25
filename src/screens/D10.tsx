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
import { CaptenlyImage } from "@/components/CaptenlyImage";

function Desktop10Inner() {
  const pathname = usePathname() || "/auth/login";
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    registerMemberWithCredentials,
    restoreProfileByLogin,
    addMinorAthlete,
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
  const [city, setCity] = useState("كل مصر");
  const [registerFeedback, setRegisterFeedback] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  // Login fields
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginFeedback, setLoginFeedback] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

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
        router.push("/dashboard/coach");
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
    <div
      className="screen-root min-h-screen bg-[#0F172A] lg:bg-[#F7F9FA] relative overflow-x-hidden flex flex-col justify-between lg:justify-center pt-4 pb-8 px-3 sm:p-6 lg:p-8"
      dir="rtl"
    >
      {/* Mobile Full-Bleed Sunlit Olympic Pool Backdrop + Ocean Teal Gradient Scrim */}
      <div className="lg:hidden fixed inset-0 z-0 pointer-events-none">
        <CaptenlyImage
          src="/images/auth/olympic-pool-hero.jpg"
          alt="حوض سباحة أولمبي"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.22) 0%, rgba(29,110,125,0.68) 40%, rgba(15,23,42,0.94) 88%)",
          }}
        />
      </div>

      {/* Desktop Light Luxury Aquatic Architectural Backdrop (NOT full-screen image) */}
      <div
        aria-hidden="true"
        className="hidden lg:block pointer-events-none fixed inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 18%, rgba(234,244,248,0.95), transparent 45%), radial-gradient(circle at 88% 82%, rgba(29,110,125,0.08), transparent 45%), linear-gradient(to left, rgba(29,110,125,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(29,110,125,0.03) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 100% 100%, 72px 72px, 72px 72px",
        }}
      />

      <div className="relative z-10 max-w-[1060px] w-full mx-auto flex flex-col justify-between lg:justify-center min-h-[calc(100vh-2rem)] lg:min-h-0 gap-5">
        {/* Top Brand + Back to Home Bar */}
        <div className="flex items-center justify-between gap-3 px-1">
          <Link href="/" className="flex items-center gap-2.5">
            <CaptenlyImage
              src="/images/logo/captenly-logo-horizontal-light.png"
              alt="كابتنلي | Captenly"
              width={160}
              height={40}
              priority
              className="lg:hidden h-10 w-auto object-contain drop-shadow-sm"
            />
            <CaptenlyImage
              src="/images/logo/captenly-logo-horizontal-dark.png"
              alt="كابتنلي | Captenly"
              width={176}
              height={44}
              priority
              className="hidden lg:block h-11 w-auto object-contain"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/15 lg:bg-white backdrop-blur-md border border-white/25 lg:border-[#0F172A]/10 text-xs font-bold text-white lg:text-[#0F172A] hover:border-[#1D6E7D] hover:text-[#1D6E7D] transition-colors shadow-xs"
          >
            <span>العودة للرئيسية</span>
            <Icon name="arrow_back" className="text-[15px]" />
          </Link>
        </div>

        {/* Mobile breathing window showing sunlit Olympic pool above frosted Auth overlay */}
        <div className="h-14 sm:h-20 lg:hidden" aria-hidden="true" />

        {/* Main Card: Frosted Dark-Aqua Overlay on Mobile / Framed White Split Luxury on Desktop */}
        <div className="w-full rounded-[28px] border border-white/15 lg:border-[#0F172A]/8 bg-[#0F172A]/75 backdrop-blur-xl lg:bg-white lg:backdrop-blur-none shadow-[0_24px_64px_rgba(15,23,42,0.45)] lg:shadow-[0_20px_60px_rgba(15,23,42,0.06)] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Desktop Side Framed Visual Panel (NOT full screen; hidden on mobile since mobile uses full-bleed backdrop) */}
          <div className="hidden lg:flex lg:col-span-5 lg:order-2 relative overflow-hidden min-h-full flex-col justify-between p-7">
            <CaptenlyImage
              src="/images/auth/olympic-pool-hero.jpg"
              alt="حوض سباحة أولمبي"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 440px"
              className="object-cover object-center"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(15,23,42,0.28) 0%, rgba(29,110,125,0.62) 52%, rgba(15,23,42,0.9) 100%)",
              }}
            />

            <div className="relative z-10 flex flex-col gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md text-[#1D6E7D] text-[11px] font-bold w-fit shadow-sm">
                <Icon name="pool" className="text-[14px]" />
                <span>منصة السباحة والمنشآت المائية الأولى في مصر</span>
              </span>
              <h2 className="font-hero-headline text-[28px] leading-snug text-white drop-shadow-sm">
                {tab === "register"
                  ? "أنشئ حسابك على منصة كابتنلي"
                  : "مرحباً بعودتك إلى كابتنلي"}
              </h2>
              <p className="font-body-compact text-white/90 leading-relaxed drop-shadow-xs max-w-sm">
                إدارة اشتراكاتك، حصصك التدريبية، ومتابعة نشاطك الرياضي في مكان واحد.
              </p>
            </div>

            <div className="relative z-10 mt-auto rounded-2xl bg-white/15 backdrop-blur-md p-4 shadow-lg border border-white/25 flex items-start gap-2.5 text-white">
              <div className="w-7 h-7 rounded-full bg-[#1D6E7D] text-white flex items-center justify-center shrink-0 mt-0.5 border border-white/25">
                <Icon name="check" className="text-[16px]" />
              </div>
              <div className="text-right">
                <div className="text-xs font-extrabold text-white">
                  حساب رياضي مستقل متاح للجميع
                </div>
                <div className="text-[11px] text-white/85 mt-0.5 leading-relaxed">
                  ربط حساب ولي الأمر اختياري تماماً للأهالي الراغبين بمتابعة حصص أطفالهم.
                </div>
              </div>
            </div>
          </div>

          {/* Form Panel */}
          <div className="lg:col-span-7 lg:order-1 p-5 sm:p-8 lg:p-9 flex flex-col gap-5 text-white lg:text-[#0F172A] lg:bg-white">
            <div className="flex flex-col gap-1">
              <h1 className="font-hero-headline text-2xl sm:text-[26px] text-white lg:text-[#0F172A]">
                {tab === "register" ? "إنشاء حساب جديد" : "أهلاً بك مجدداً"}
              </h1>
              <p className="text-xs sm:text-sm text-white/80 lg:text-[#64748B]">
                {tab === "register"
                  ? "أدخل بياناتك للانضمام لأكبر مجتمع سباحة ومنشآت مائية وأكاديميات رياضية في مصر."
                  : "أدخل بياناتك للمتابعة إلى ملف السبّاح، الجداول التدريبية، أو لوحة المنشأة."}
              </p>
            </div>

            {/* Segmented Tab Switcher (Deep Ocean Teal #1D6E7D Active + White Text) */}
            <div className="grid grid-cols-2 bg-white/10 lg:bg-[#F7F9FA] p-1 rounded-full border border-white/15 lg:border-[#0F172A]/8 w-full sm:max-w-sm">
              <button
                type="button"
                onClick={() => {
                  setTab("register");
                  router.replace("/auth/register");
                }}
                className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 ${
                  tab === "register"
                    ? "bg-[#1D6E7D] text-white shadow-sm"
                    : "text-white/75 hover:text-white lg:text-[#64748B] lg:hover:text-[#0F172A]"
                }`}
              >
                <Icon name="person_add" className="text-[15px]" />
                <span>إنشاء حساب جديد</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("login");
                  router.replace("/auth/login");
                }}
                className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 ${
                  tab === "login"
                    ? "bg-[#1D6E7D] text-white shadow-sm"
                    : "text-white/75 hover:text-white lg:text-[#64748B] lg:hover:text-[#0F172A]"
                }`}
              >
                <Icon name="login" className="text-[15px]" />
                <span>تسجيل الدخول</span>
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
              <div className="flex items-center gap-3 text-[11px] font-bold text-white/70 lg:text-[#64748B]">
                <span className="h-px flex-1 bg-white/15 lg:bg-[#E2E8F0]" />
                <span className="whitespace-nowrap">أو عبر رقم الموبايل / كود العضوية</span>
                <span className="h-px flex-1 bg-white/15 lg:bg-[#E2E8F0]" />
              </div>
            </div>

            {tab === "register" ? (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-white/95 lg:text-[#0F172A]">الاسم بالكامل *</label>
                  <input
                    required
                    value={fullNameAr}
                    onChange={(e) => setFullNameAr(e.target.value)}
                    placeholder="مثال: أحمد طارق المنشاوي"
                    className="rounded-xl bg-white/12 lg:bg-[#F7F9FA] text-white lg:text-[#0F172A] placeholder:text-white/55 lg:placeholder:text-[#94A3B8] px-4 py-3 text-sm outline-none border border-white/20 lg:border-[#E2E8F0] focus:border-[#EAF4F8] lg:focus:border-[#1D6E7D] lg:focus:bg-white transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-white/95 lg:text-[#0F172A]">رقم الموبايل *</label>
                    <div
                      className="flex items-center rounded-xl bg-white/12 lg:bg-[#F7F9FA] border border-white/20 lg:border-[#E2E8F0] focus-within:border-[#EAF4F8] lg:focus-within:border-[#1D6E7D] lg:focus-within:bg-white transition-colors overflow-hidden"
                      dir="ltr"
                    >
                      <span className="px-3 py-3 text-xs font-mono font-bold text-[#EAF4F8] lg:text-[#1D6E7D] bg-white/10 lg:bg-[#EAF4F8]/60 border-r border-white/15 lg:border-[#E2E8F0] shrink-0">
                        🇪🇬 +20
                      </span>
                      <input
                        required
                        type="tel"
                        dir="ltr"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="010xxxxxxxx"
                        className="w-full bg-transparent text-white lg:text-[#0F172A] placeholder:text-white/55 lg:placeholder:text-[#94A3B8] px-3 py-3 text-sm text-left outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-white/95 lg:text-[#0F172A]">
                      المدينة (تتزامن مع موقعك الجغرافي)
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="rounded-xl bg-[#0F172A]/85 lg:bg-[#F7F9FA] text-white lg:text-[#0F172A] px-4 py-3 text-sm outline-none border border-white/20 lg:border-[#E2E8F0] focus:border-[#EAF4F8] lg:focus:border-[#1D6E7D] lg:focus:bg-white transition-colors"
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
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-white/95 lg:text-[#0F172A]">
                      البريد الإلكتروني (اختياري للاستعادة)
                    </label>
                    <input
                      type="email"
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="rounded-xl bg-white/12 lg:bg-[#F7F9FA] text-white lg:text-[#0F172A] placeholder:text-white/55 lg:placeholder:text-[#94A3B8] px-4 py-3 text-sm text-left placeholder:text-right outline-none border border-white/20 lg:border-[#E2E8F0] focus:border-[#EAF4F8] lg:focus:border-[#1D6E7D] lg:focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-white/95 lg:text-[#0F172A]">
                      كلمة المرور * (6 أحرف فأكثر)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        required
                        minLength={6}
                        type={showRegisterPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl bg-white/12 lg:bg-[#F7F9FA] text-white lg:text-[#0F172A] placeholder:text-white/55 lg:placeholder:text-[#94A3B8] px-4 pl-10 py-3 text-sm outline-none border border-white/20 lg:border-[#E2E8F0] focus:border-[#EAF4F8] lg:focus:border-[#1D6E7D] lg:focus:bg-white transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword((v) => !v)}
                        aria-label={showRegisterPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                        className="absolute left-3 text-white/70 hover:text-white lg:text-[#64748B] lg:hover:text-[#1D6E7D] flex items-center justify-center"
                      >
                        <Icon name={showRegisterPassword ? "visibility_off" : "visibility"} className="text-[18px]" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-white/95 lg:text-[#0F172A]">نوع الحساب</label>
                  <select
                    value={role}
                    onChange={(e) =>
                      setRole(
                        e.target.value as "adult_athlete" | "coach" | "facility_manager"
                      )
                    }
                    className="rounded-xl bg-[#0F172A]/85 lg:bg-[#F7F9FA] text-white lg:text-[#0F172A] px-4 py-3 text-sm outline-none border border-white/20 lg:border-[#E2E8F0] focus:border-[#EAF4F8] lg:focus:border-[#1D6E7D] lg:focus:bg-white transition-colors"
                  >
                    <option value="adult_athlete">سبّاح / متدرب وولي أمر (حساب موحد)</option>
                    <option value="coach">كابتن سباحة (يتفعّل ملفك مباشرة — التوثيق اختياري)</option>
                    <option value="facility_manager">إدارة أكاديمية أو مسبح (نشر فوري + توثيق اختياري)</option>
                  </select>
                </div>

                {role === "adult_athlete" ? (
                  <div className="rounded-2xl bg-white/10 lg:bg-[#F7F9FA] p-3.5 sm:p-4 border border-white/15 lg:border-[#E2E8F0] flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-white lg:text-[#0F172A]">
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
                            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all inline-flex items-center justify-center gap-1.5 ${
                              accountIntent === opt.id
                                ? "bg-[#1D6E7D] text-white border-[#1D6E7D] shadow-xs"
                                : "bg-white/10 text-white/90 border-white/15 hover:border-white/40 lg:bg-white lg:text-[#0F172A] lg:border-[#E2E8F0] lg:hover:border-[#1D6E7D]"
                            }`}
                          >
                            {accountIntent === opt.id && (
                              <Icon name="check_circle" className="text-[14px]" />
                            )}
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {(accountIntent === "parent_only" || accountIntent === "both_self_and_parent") && (
                      <div className="pt-2.5 border-t border-white/15 lg:border-[#E2E8F0] flex flex-col gap-2.5">
                        <label className="flex items-center gap-2 text-xs font-bold text-[#EAF4F8] lg:text-[#1D6E7D] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addFirstChild}
                            onChange={(e) => setAddFirstChild(e.target.checked)}
                            className="w-4 h-4 accent-[#1D6E7D] rounded"
                          />
                          <span>إضافة ملف ابني الأول الآن لتوليد كود CAP-JR خاص به</span>
                        </label>

                        {addFirstChild && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              value={firstChildName}
                              onChange={(e) => setFirstChildName(e.target.value)}
                              placeholder="اسم الابن"
                              className="sm:col-span-1 rounded-xl bg-white/15 lg:bg-white text-white lg:text-[#0F172A] placeholder:text-white/60 lg:placeholder:text-[#94A3B8] px-3 py-2.5 text-xs outline-none border border-white/20 lg:border-[#E2E8F0] focus:border-[#1D6E7D]"
                            />
                            <input
                              type="number"
                              min={3}
                              max={17}
                              value={firstChildAge}
                              onChange={(e) => setFirstChildAge(e.target.value)}
                              placeholder="العمر"
                              className="rounded-xl bg-white/15 lg:bg-white text-white lg:text-[#0F172A] placeholder:text-white/60 lg:placeholder:text-[#94A3B8] px-3 py-2.5 text-xs outline-none border border-white/20 lg:border-[#E2E8F0] focus:border-[#1D6E7D]"
                            />
                            <select
                              value={firstChildGender}
                              onChange={(e) =>
                                setFirstChildGender(e.target.value as "male" | "female")
                              }
                              className="rounded-xl bg-[#0F172A]/85 lg:bg-white text-white lg:text-[#0F172A] px-3 py-2.5 text-xs outline-none border border-white/20 lg:border-[#E2E8F0] focus:border-[#1D6E7D]"
                            >
                              <option value="male">ذكر (سباح)</option>
                              <option value="female">أنثى (سباحة)</option>
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : role === "coach" ? (
                  <div className="rounded-2xl bg-[#1D6E7D]/30 lg:bg-[#EAF4F8] border border-white/20 lg:border-[#1D6E7D]/20 p-3.5 text-[11px] font-bold text-[#EAF4F8] lg:text-[#1D6E7D] leading-relaxed">
                    يُفعَّل حساب الكابتن وينشر ملفك تلقائياً في البحث والرئيسية فور التسجيل. التوثيق بالشارات الرسمية عبر صفحة الاعتماد (/claim) اختياري تماماً ويمنحك أفضلية وترتيباً أعلى أمام المستخدمين.
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[#1D6E7D]/30 lg:bg-[#EAF4F8] border border-white/20 lg:border-[#1D6E7D]/20 p-3.5 text-[11px] font-bold text-[#EAF4F8] lg:text-[#1D6E7D] leading-relaxed">
                    سيتم إنشاء حساب الإدارة أولاً ثم نقلك مباشرة لإضافة منشأتك أو أكاديميتك وتحديد موقعها على الخريطة التفاعلية، مع إمكانية طلب شارة التوثيق اختيارياً.
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
                  className="w-full py-3.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-card-title shadow-[0_10px_28px_rgba(29,110,125,0.35)] lg:shadow-md transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {registering ? "جاري تأمين الحساب..." : "إنشاء الحساب وتوليد كود العضوية الآن ←"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-white/95 lg:text-[#0F172A]">
                    رقم الموبايل أو البريد الإلكتروني أو كود العضوية (CAP-M-XXXX)
                  </label>
                  <input
                    required
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="010xxxxxxxx أو البريد أو CAP-M-XXXX"
                    className="rounded-xl bg-white/12 lg:bg-[#F7F9FA] text-white lg:text-[#0F172A] placeholder:text-white/55 lg:placeholder:text-[#94A3B8] px-4 py-3 text-sm outline-none border border-white/20 lg:border-[#E2E8F0] focus:border-[#EAF4F8] lg:focus:border-[#1D6E7D] lg:focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-white/95 lg:text-[#0F172A]">كلمة المرور *</label>
                    <Link href="/auth/forgot" className="text-xs text-[#EAF4F8] lg:text-[#1D6E7D] font-bold hover:underline">
                      نسيت كلمة المرور؟
                    </Link>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      required
                      type={showLoginPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl bg-white/12 lg:bg-[#F7F9FA] text-white lg:text-[#0F172A] placeholder:text-white/55 lg:placeholder:text-[#94A3B8] px-4 pl-10 py-3 text-sm outline-none border border-white/20 lg:border-[#E2E8F0] focus:border-[#EAF4F8] lg:focus:border-[#1D6E7D] lg:focus:bg-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      aria-label={showLoginPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      className="absolute left-3 text-white/70 hover:text-white lg:text-[#64748B] lg:hover:text-[#1D6E7D] flex items-center justify-center"
                    >
                      <Icon name={showLoginPassword ? "visibility_off" : "visibility"} className="text-[18px]" />
                    </button>
                  </div>
                </div>

                {loginFeedback && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                    {loginFeedback}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full py-3.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-card-title shadow-[0_10px_28px_rgba(29,110,125,0.35)] lg:shadow-md transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {loggingIn ? "جاري التحقق والدخول..." : "تسجيل الدخول ←"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Desktop10() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F172A] lg:bg-[#F7F9FA]" />}>
      <Desktop10Inner />
    </Suspense>
  );
}
