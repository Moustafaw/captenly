"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CaptenlyImage } from "@/components/CaptenlyImage";
import type { Coach, Facility } from "@/types/captenly";

function HomeSsrShell() {
  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-[#0F172A] antialiased min-h-screen">
      <div className="max-w-[1280px] w-full mx-auto px-margin lg:px-margin-desktop pt-4 lg:pt-12 pb-24 lg:pb-12 flex flex-col gap-5 lg:gap-space-xl">
        {/* Mobile search & category chips strip (matches Phone21 layout to prevent CLS) */}
        <div className="lg:hidden flex flex-col gap-5">
          <div className="flex items-center gap-2 bg-white rounded-full px-3.5 py-2 shadow-[0_2px_10px_rgba(15,23,42,0.04)] border border-[#0F172A]/8">
            <Icon name="search" className="text-[#64748B] text-[18px] shrink-0" />
            <span className="flex-1 text-xs text-[#64748B] truncate">
              ابحث عن كابتن سباحة، نادي، أو مسبح...
            </span>
            <span className="w-8 h-8 rounded-full bg-[#EAF4F8] text-[#1D6E7D] flex items-center justify-center shrink-0">
              <Icon name="tune" className="text-[16px]" />
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-hidden">
            {["الكل", "سباحة", "تأسيس أطفال", "مدفأ شتاءً"].map((label, idx) => (
              <span
                key={label}
                className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border ${
                  idx === 0
                    ? "bg-[#1D6E7D] border-[#1D6E7D] text-white"
                    : "bg-white border-[#0F172A]/8 text-[#475569]"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Responsive SSR Hero Card — single <h1> + priority LCP image */}
        <section className="relative w-full rounded-[24px] bg-white border border-[#0F172A]/6 overflow-hidden shadow-[0_8px_28px_rgba(15,23,42,0.05)] lg:shadow-[0_12px_40px_rgba(15,23,42,0.05)] lg:p-7">
          <div className="relative z-10 flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 lg:min-h-[340px] items-stretch lg:items-center">
            <div className="order-1 lg:order-2 lg:col-span-5 relative h-44 lg:h-[340px] w-full lg:rounded-[20px] overflow-hidden bg-[#EAF4F8] lg:border lg:border-[#0F172A]/6">
              <CaptenlyImage
                src="/screens/2c0d763d9374.jpg"
                alt="حوض سباحة أولمبي معتمد"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 520px"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/30 via-transparent to-transparent pointer-events-none" />
              <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/95 text-[#1D6E7D] text-[11px] font-bold shadow-sm inline-flex items-center gap-1">
                <Icon name="thermostat" className="text-[13px]" />
                <span>فحص 28.5°C شتاءً</span>
              </span>
            </div>

            <div className="order-2 lg:order-1 lg:col-span-7 p-4 lg:p-4 flex flex-col justify-center gap-3 lg:gap-5">
              <h1 className="font-hero-headline-mobile text-hero-headline-mobile lg:font-hero-headline lg:text-hero-headline text-[#0F172A] leading-snug lg:leading-tight max-w-xl">
                اكتشف أفضل الأندية والمدارس الرياضية الموثقة حولك في مصر
              </h1>
              <p className="lg:hidden text-xs text-[#475569] leading-relaxed">
                أسعار واضحة، كباتن مسجلون ومعتمدون، ودفتر حصص QR يعمل أوفلاين عند المسبح.
              </p>
              <div className="hidden lg:flex flex-wrap items-center gap-2.5 text-[#0F172A] font-body-compact text-[12.5px]">
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7F9FA] border border-[#0F172A]/6 font-bold">
                  <Icon name="check_circle" className="text-[16px] text-[#1D6E7D]" />
                  <span>أسعار واضحة دون عمولات وساطة</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7F9FA] border border-[#0F172A]/6 font-bold">
                  <Icon name="workspace_premium" className="text-[16px] text-[#1D6E7D]" />
                  <span>كباتن مسجلون وموثقون بالشارات</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7F9FA] border border-[#0F172A]/6 font-bold">
                  <Icon name="qr_code_2" className="text-[16px] text-[#1D6E7D]" />
                  <span>دفتر حصص QR أوفلاين</span>
                </span>
              </div>
              <div className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2 lg:gap-3 pt-1">
                <Link
                  href="/explore"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3 lg:py-0 lg:h-12 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs lg:text-card-title font-extrabold lg:font-card-title shadow-sm"
                >
                  <span>استكشف المنشآت القريبة منك</span>
                  <Icon name="arrow_back" className="text-[15px] lg:text-[20px]" />
                </Link>
                <Link
                  href="/claim"
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 lg:py-0 lg:h-12 rounded-full bg-white border border-[#0F172A]/12 text-[#0F172A] text-xs lg:text-card-title-sm font-bold lg:font-card-title-sm"
                >
                  <span>وثّق ناديك أو سجّل ككابتن</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Reserved below-hero skeleton strip to minimize CLS on hydration */}
        <section aria-hidden="true" className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[320px]">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-72 rounded-[20px] bg-white border border-[#0F172A]/6 p-5 flex flex-col justify-between"
            >
              <div className="h-36 rounded-xl bg-[#F7F9FA]" />
              <div className="space-y-2">
                <div className="h-4 w-3/4 rounded bg-[#F7F9FA]" />
                <div className="h-3 w-1/2 rounded bg-[#F7F9FA]" />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

const DynamicDesktop24 = dynamic(() => import("@/screens/D24"), {
  ssr: false,
  loading: () => <HomeSsrShell />,
});

const DynamicPhone21 = dynamic(() => import("@/screens/P21"), {
  ssr: false,
  loading: () => <HomeSsrShell />,
});

export function HomeScreenClient({
  initialFacilities,
  initialCoaches,
}: {
  initialFacilities: Facility[];
  initialCoaches: Coach[];
}) {
  const [viewport, setViewport] = useState<"desktop" | "phone" | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setViewport(mq.matches ? "desktop" : "phone");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (viewport === "phone") {
    return (
      <div className="w-full">
        <DynamicPhone21 initialFacilities={initialFacilities} initialCoaches={initialCoaches} />
      </div>
    );
  }

  if (viewport === "desktop") {
    return (
      <div className="w-full">
        <DynamicDesktop24 initialFacilities={initialFacilities} initialCoaches={initialCoaches} />
      </div>
    );
  }

  return <HomeSsrShell />;
}
