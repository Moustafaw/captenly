"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { QrCodeBox } from "@/components/editorial/QrCodeBox";
import { AvatarUploader } from "@/components/editorial/AvatarUploader";
import { GoogleMark } from "@/components/auth/GoogleSignInButton";

type OnboardRole = "adult_athlete" | "parent" | "coach" | "facility_manager";

const ROLE_OPTIONS: {
  key: OnboardRole;
  titleAr: string;
  descAr: string;
  icon: string;
  prefix: "CAP-M" | "CAP-C" | "CAP-F";
}[] = [
  {
    key: "adult_athlete",
    titleAr: "سبّاح / رياضي مستقل",
    descAr: "متابعة باقاتي وحصصي الـ QR وأرقامي القياسية الشخصية.",
    icon: "person",
    prefix: "CAP-M",
  },
  {
    key: "parent",
    titleAr: "ولي أمر (إشراف عائلي)",
    descAr: "متابعة دفاتر وحضور الأبناء تحت 14 سنة من موبايلك.",
    icon: "groups",
    prefix: "CAP-M",
  },
  {
    key: "coach",
    titleAr: "كابتن للتوثيق والاعتماد",
    descAr: "إدارة حصص المتدربين والتقديم على الشارات الخضراء الـ 6.",
    icon: "workspace_premium",
    prefix: "CAP-C",
  },
  {
    key: "facility_manager",
    titleAr: "إدارة نادي أو أكاديمية",
    descAr: "توثيق صفحة المنشأة، تحديث الباقات، وإدارة المشتركين بـ 0% عمولة.",
    icon: "stadium",
    prefix: "CAP-F",
  },
];

function Desktop1Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentPersona, addMinorAthlete, completeGoogleOnboarding } = useCaptenly();

  const initialRole: OnboardRole =
    currentPersona.role === "parent" ||
    currentPersona.role === "coach" ||
    currentPersona.role === "facility_manager"
      ? currentPersona.role
      : "adult_athlete";

  const [selectedRole, setSelectedRole] = useState<OnboardRole>(initialRole);
  const [phone, setPhone] = useState(currentPersona.phone || "");
  const [city, setCity] = useState(currentPersona.city || "المحلة الكبرى");
  const [copied, setCopied] = useState(false);
  const [addChildOptional, setAddChildOptional] = useState(false);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("8");

  const isGoogleSource =
    searchParams?.get("source") === "google" || currentPersona.authProvider === "google";
  const isPreview = searchParams?.get("preview") === "1";

  const rawCode = currentPersona.memberCode || "";
  const codeSuffix = rawCode ? rawCode.split("-").pop() || "" : "";
  const selectedRoleMeta =
    ROLE_OPTIONS.find((r) => r.key === selectedRole) || ROLE_OPTIONS[0];
  const displayMemberCode = `${selectedRoleMeta.prefix}-${codeSuffix}`;

  const copyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(displayMemberCode).catch(() => undefined);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    completeGoogleOnboarding({
      role: selectedRole,
      phone: phone.trim(),
      city,
      hasParentSupervision: selectedRole === "parent",
    });

    if (
      (selectedRole === "adult_athlete" || selectedRole === "parent") &&
      addChildOptional &&
      childName.trim()
    ) {
      addMinorAthlete({
        fullNameAr: childName.trim(),
        age: Number(childAge) || 8,
        gender: "male",
        primarySport: "swimming",
      });
    }

    if (selectedRole === "coach") {
      router.push("/claim?mode=coach");
    } else if (selectedRole === "facility_manager") {
      router.push("/claim");
    } else {
      router.push("/welcome");
    }
  };

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-[860px] w-full bg-surface-card rounded-[24px] p-6 sm:p-8 md:p-10 shadow-xl flex flex-col gap-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-lime-tint text-deep-olive text-xs font-bold">
                تجهيز الحساب واختيار الدور
              </span>
              {isGoogleSource && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-snow border border-surface-container text-xs font-bold text-dark-slate">
                  <GoogleMark className="w-3.5 h-3.5" />
                  <span>
                    {isPreview ? "تم السحب في وضع معاينة Google" : "تم التوثيق عبر Google"}
                  </span>
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
          <Link href="/welcome" className="text-xs font-bold text-text-muted hover:text-dark-slate">
            تخطي للرئيسية ←
          </Link>
        </div>

        {/* Pulled Google Profile + Member Code & QR Banner */}
        <div className="rounded-2xl bg-dark-slate text-surface-card p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-right">
            <AvatarUploader size="lg" labelAr="تعديل الصورة" darkSurface />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-electric-volt font-bold">كود العضوية الفريد</span>
              <div className="text-3xl font-mono font-black tracking-wider text-white">
                {displayMemberCode}
              </div>
              <p className="text-xs text-surface-container-high max-w-md leading-relaxed">
                عند الاشتراك مع أي كابتن أو أكاديمية موثقة على كابتنلي، سلّمهم هذا الكود لتفعيل باقتك وعمل دفتر الحصص الـ QR أوفلاين فوراً.
              </p>
              <button
                type="button"
                onClick={copyCode}
                className="mt-1 px-4 py-2 rounded-full bg-electric-volt text-dark-slate text-xs font-bold w-fit mx-auto sm:mx-0 flex items-center gap-1.5"
              >
                <Icon name={copied ? "check" : "content_copy"} className="text-[15px]" />
                <span>{copied ? "تم نسخ كود العضوية!" : "نسخ كود العضوية"}</span>
              </button>
            </div>
          </div>
          <QrCodeBox value={`CAP-MEMBER:${displayMemberCode}`} size={126} label={displayMemberCode} />
        </div>

        <form onSubmit={handleFinish} className="flex flex-col gap-5">
          {/* Role Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-dark-slate">
              1) اختر نوع حسابك الأساسي داخل كابتنلي:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ROLE_OPTIONS.map((r) => {
                const active = selectedRole === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSelectedRole(r.key)}
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
                      <Icon name={r.icon} className="text-[20px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-card-title-sm text-dark-slate">{r.titleAr}</div>
                      <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{r.descAr}</p>
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
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm text-right outline-none border border-surface-container focus:border-deep-olive"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-dark-slate">المدينة</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container focus:border-deep-olive"
              >
                <option value="المحلة الكبرى">المحلة الكبرى</option>
                <option value="طنطا">طنطا</option>
                <option value="زفتى">زفتى</option>
                <option value="سمنود">سمنود</option>
                <option value="القاهرة">القاهرة</option>
                <option value="الإسكندرية">الإسكندرية</option>
              </select>
            </div>
          </div>

          {(selectedRole === "adult_athlete" || selectedRole === "parent") && (
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
                    (اختياري) إضافة طفل تحت 14 سنة لمتابعته من حسابي
                  </div>
                  <div className="text-xs text-text-muted">
                    إن كنت تسجل لنفسك كسباح أو متدرب جيم مستقل، اتركه غير محدد واضغط حفظ ومتابعة.
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
                    max={14}
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                    placeholder="العمر"
                    className="rounded-xl bg-white px-4 py-2.5 text-sm outline-none border border-surface-container"
                  />
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title shadow-md hover:opacity-95"
          >
            {selectedRole === "coach"
              ? "حفظ الدور والانتقال لتوثيق شارات الكابتن ←"
              : selectedRole === "facility_manager"
              ? "حفظ الدور والانتقال لصفحة توثيق المنشأة ←"
              : "حفظ الإعدادات والدخول للمنصة ←"}
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
