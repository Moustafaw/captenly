"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";

function ExploreSsrShell() {
  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-[#0F172A] antialiased min-h-screen pt-4 lg:pt-6 pb-24 lg:pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-4 lg:gap-space-md">
        <section className="bg-white rounded-[24px] p-4 lg:p-6 shadow-[0_8px_28px_rgba(15,23,42,0.04)] border border-[#0F172A]/6 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h1 className="font-section-title-mobile lg:font-section-title lg:text-[24px] text-[#0F172A]">
                استكشف المسابح وأكاديميات السباحة
              </h1>
              <p className="text-[11px] lg:font-body-compact text-[#64748B] mt-0.5">
                ابحث في مسابح وأكاديميات كابتنلي المسجلة ودليل الخرائط العامة
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 lg:flex-none flex items-center bg-[#F7F9FA] rounded-full px-3.5 py-2 border border-[#0F172A]/10">
                <Icon name="search" className="text-[#64748B] ml-2 text-[17px]" />
                <span className="text-xs lg:text-sm text-[#475569] w-44 truncate">
                  ابحث بالاسم أو المنطقة...
                </span>
              </div>
              <span className="px-3.5 py-2 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-xs font-bold inline-flex items-center gap-1.5 border border-[#1D6E7D]/15">
                <Icon name="tune" className="text-[16px]" />
                <span>الفلاتر</span>
              </span>
            </div>
          </div>
        </section>

        <section aria-hidden="true" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[420px]">
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

const DynamicDesktop23 = dynamic(() => import("@/screens/D23"), {
  ssr: false,
  loading: () => <ExploreSsrShell />,
});

const DynamicDesktop3 = dynamic(() => import("@/screens/D3"), {
  ssr: false,
  loading: () => <ExploreSsrShell />,
});

const DynamicPhone6 = dynamic(() => import("@/screens/P6"), {
  ssr: false,
  loading: () => <ExploreSsrShell />,
});

export function ExploreScreenClient({ isFallback }: { isFallback: boolean }) {
  const [viewport, setViewport] = useState<"desktop" | "phone" | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setViewport(mq.matches ? "desktop" : "phone");
    sync();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  if (viewport === "phone") {
    return (
      <div className="w-full">
        <DynamicPhone6 />
      </div>
    );
  }

  if (viewport === "desktop") {
    return (
      <div className="w-full">
        {isFallback ? <DynamicDesktop3 /> : <DynamicDesktop23 />}
      </div>
    );
  }

  return (
    <div className="w-full">
      <ExploreSsrShell />
    </div>
  );
}
