"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function Desktop14() {
  const router = useRouter();
  const { allPersonas, currentPersona, switchPersona } = useCaptenly();

  const roles = [
    {
      key: "adult_athlete",
      title: "سبّاح أو رياضي مستقل",
      desc: "احصل على كود عضوية فريد، قارن الباقات، وفعل دفتر الحصص الـ QR أوفلاين دون الحاجة لولي أمر.",
      href: "/auth/register?role=adult_athlete",
      icon: "person",
    },
    {
      key: "parent",
      title: "ولي أمر (إشراف عائلي اختياري)",
      desc: "خيار متاح للأهالي لمتابعة حضور وتقييمات الأبناء تحت 14 سنة من موبايلهم.",
      href: "/auth/register?role=parent",
      icon: "groups",
    },
    {
      key: "coach",
      title: "كابتن معتمد / متقدم للتوثيق",
      desc: "وثّق شهاداتك برقم الهاتف لإصدار الشارات الخضراء وربط المتدربين بكود العضوية.",
      href: "/claim?mode=coach",
      icon: "workspace_premium",
    },
    {
      key: "facility_manager",
      title: "إدارة نادي أو أكاديمية رياضية",
      desc: "طالب بصفحة منشأتك مجاناً، حدّث الباقات، وفعّل دفاتر الحصص للمشتركين بـ 0% عمولة.",
      href: "/claim",
      icon: "stadium",
    },
  ];

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex flex-col justify-center py-12 px-6">
      <div className="max-w-[1040px] w-full mx-auto flex flex-col gap-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link href="/" className="flex items-center gap-3">
            <img
              alt="كابتنلي"
              className="h-11 w-auto object-contain"
              src="/images/logo/captenly-logo-horizontal-dark.png"
            />
            <span className="font-card-title text-xl text-dark-slate">بوابة الحسابات</span>
          </Link>
          <Link
            href="/explore"
            className="px-4 py-2 rounded-full bg-surface-card text-text-muted hover:text-dark-slate text-xs font-bold shadow-sm"
          >
            تصفح مجاني بدون حساب ←
          </Link>
        </div>

        <div className="rounded-[20px] bg-dark-slate text-surface-card p-6 md:p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h1 className="font-hero-headline text-[24px] md:text-[30px]">
              اختر نوع حسابك للبدء أو توليد كود عضويتك
            </h1>
            <p className="font-body-compact text-surface-container-high mt-1">
              سجّل بضغطة واحدة عبر Google أو اختر نوع الحساب المناسب لك؛ يحصل كل متدرب على كود عضوية فريد (CAP-M-XXXX) لتفعيل الـ QR مع أي كابتن أو أكاديمية.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            <GoogleSignInButton
              labelAr="المتابعة عبر حساب Google"
              variant="dark"
              className="sm:min-w-[235px]"
            />
            <Link
              href="/auth/login"
              className="px-6 py-3 rounded-full bg-electric-volt text-dark-slate font-card-title-sm text-center hover:brightness-95 transition-all"
            >
              لدي حساب بالفعل — دخول
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((r) => (
            <Link
              key={r.key}
              href={r.href}
              className="bg-surface-card rounded-2xl p-6 shadow-sm border border-surface-container hover:border-deep-olive hover:shadow-md transition-all flex items-start gap-4 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-lime-tint text-deep-olive flex items-center justify-center shrink-0">
                <Icon name={r.icon} className="text-[22px]" />
              </div>
              <div className="flex-1">
                <h2 className="font-card-title text-dark-slate group-hover:text-deep-olive transition-colors">
                  {r.title}
                </h2>
                <p className="font-body-compact text-text-muted mt-1">{r.desc}</p>
              </div>
              <Icon name="arrow_back" className="text-text-muted group-hover:text-deep-olive mt-1" />
            </Link>
          ))}
        </div>

        {/* Quick Persona Switcher for Testing */}
        <section className="bg-surface-card rounded-2xl p-6 shadow-sm border border-surface-container flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-card-title-sm text-dark-slate">
              التبديل السريع بين الحسابات الجاهزة (للتجربة الفورية)
            </h3>
            <span className="text-xs font-mono text-deep-olive">
              الحالي: {currentPersona.shortLabelAr}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allPersonas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  switchPersona(p.id);
                  router.push(
                    p.role === "coach"
                      ? "/dashboard/coach"
                      : p.role === "facility_manager"
                      ? "/dashboard/facility"
                      : "/dashboard/ledger"
                  );
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                  p.id === currentPersona.id
                    ? "bg-dark-slate text-electric-volt"
                    : "bg-surface-snow text-dark-slate hover:bg-lime-tint"
                }`}
              >
                {p.shortLabelAr}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
