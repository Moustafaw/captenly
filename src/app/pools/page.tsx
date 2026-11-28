import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop4 from "@/screens/D4";
import Phone6 from "@/screens/P6";
import { buildPageMetadata } from "@/lib/seo";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = buildPageMetadata({
  title: "دليل المسابح المدفأة ومدارس السباحة",
  description:
    "تصفح المسابح المدفأة شتاءً ومدارس تعليم السباحة للأطفال والكبار ومواعيد السيدات المستقلة عبر محافظات مصر.",
  path: "/pools",
});

function PoolsSsrShell() {
  return (
    <div className="screen-root bg-[#F7F9FA] font-body-default text-[#0F172A] antialiased min-h-screen pt-4 lg:pt-6 pb-24 lg:pb-16">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-4 lg:gap-space-md">
        <section className="bg-white rounded-[24px] p-4 lg:p-6 shadow-[0_8px_28px_rgba(15,23,42,0.04)] border border-[#0F172A]/6 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h1 className="font-section-title-mobile lg:font-section-title lg:text-[24px] text-[#0F172A]">
                دليل المسابح المدفأة ومدارس السباحة
              </h1>
              <p className="text-[11px] lg:font-body-compact text-[#64748B] mt-0.5">
                قارن نوع المسبح والتدفئة الشتوية ومواعيد السيدات والباقات الشهرية في محافظات مصر
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-2 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-xs font-bold inline-flex items-center gap-1.5 border border-[#1D6E7D]/15">
                <Icon name="pool" className="text-[16px]" />
                <span>المسابح</span>
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

export default function PoolsDirectoryPage() {
  return <ResponsiveScreen desktop={<Desktop4 />} phone={<Phone6 />} ssrFallback={<PoolsSsrShell />} />;
}
