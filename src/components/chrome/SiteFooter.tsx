"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isChromeless } from "./chromeRoutes";
import { useCaptenly } from "@/context/CaptenlyContext";

export function SiteFooter() {
  const pathname = usePathname() || "/";
  const { isAuthenticated, currentPersona } = useCaptenly();
  if (isChromeless(pathname)) return null;

  const isFacilityManager = isAuthenticated && currentPersona.role === "facility_manager";
  const isCoachRole = isAuthenticated && currentPersona.role === "coach";

  return (
    <footer className="hidden lg:block w-full bg-deep-carbon text-surface-card mt-space-2xl">
      <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop py-space-xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-lg">
          <div className="md:col-span-4 flex flex-col gap-space-sm">
            <div className="flex items-center gap-space-sm">
              <img
                alt="شعار كابتنلي"
                className="h-11 w-auto object-contain"
                src="/images/logo/captenly-logo-horizontal-light.png"
              />
              <div className="flex flex-col">
                <span className="font-micro-caption text-micro-caption text-electric-volt">
                  موثوق • واضح الأسعار • معك في كل خطوة
                </span>
              </div>
            </div>
            <p className="font-body-compact text-body-compact text-surface-variant leading-relaxed">
              منصة رياضية مصرية متخصصة في السباحة والمسابح المعتمدة، توفر شفافية كاملة في الأسعار والتحقق من الشهادات ودفتر الحصص الـ QR أوفلاين دون عمولة وساطة.
            </p>
            <div className="flex items-center gap-space-xs pt-2">
              <span className="px-2.5 py-1 rounded bg-dark-slate text-electric-volt font-micro-caption text-micro-caption">
                معايير التدريب والإنقاذ المائي ✓
              </span>
              <span className="px-2.5 py-1 rounded bg-dark-slate text-electric-volt font-micro-caption text-micro-caption">
                القانون 151 لسنة 2020 ✓
              </span>
            </div>
          </div>

          <div className="md:col-span-3">
            <h4 className="font-card-title text-card-title text-surface-card mb-space-sm">السباحة والمجالات</h4>
            <ul className="flex flex-col gap-space-xs font-body-compact text-body-compact text-surface-container-high">
              <li>
                <Link className="hover:text-electric-volt transition-colors" href="/pools">
                  مسابح مدفأة وتأسيس الأطفال
                </Link>
              </li>
              <li>
                <Link className="hover:text-electric-volt transition-colors" href="/explore?sport=swimming">
                  أكاديميات ومدارس السباحة التنافسية
                </Link>
              </li>
              <li>
                <Link className="hover:text-electric-volt transition-colors" href="/explore?ladies=1">
                  حصص ومواعيد السيدات المستقلة
                </Link>
              </li>
              <li>
                <Link className="hover:text-electric-volt transition-colors" href="/coaches">
                  الكباتن الموثقون والأندية
                </Link>
              </li>
              <li>
                <Link className="hover:text-electric-volt transition-colors" href="/compare">
                  مقارنة المنشآت والباقات
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <h4 className="font-card-title text-card-title text-surface-card mb-space-sm">المنصة والتوثيق</h4>
            <ul className="flex flex-col gap-space-xs font-body-compact text-body-compact text-surface-container-high">
              <li>
                <Link className="hover:text-electric-volt transition-colors" href="/about">
                  عن منصة كابتنلي
                </Link>
              </li>
              <li>
                <Link className="hover:text-electric-volt transition-colors" href="/badges">
                  معايير توثيق الكباتن (6 شارات)
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-electric-volt transition-colors"
                  href={isFacilityManager ? "/dashboard/facility" : isCoachRole ? "/dashboard/coach" : "/claim"}
                >
                  {isFacilityManager ? "لوحة إدارة منشأتك" : isCoachRole ? "لوحة الكابتن الخاصة بك" : "طالب بصفحتك ووثقها مجاناً"}
                </Link>
              </li>
              <li>
                <Link className="hover:text-electric-volt transition-colors" href="/magazine">
                  المجلة والتحليلات الرياضية
                </Link>
              </li>
              <li>
                <Link className="hover:text-electric-volt transition-colors" href="/privacy">
                  الخصوصية
                </Link>{" "}
                •{" "}
                <Link className="hover:text-electric-volt transition-colors" href="/terms">
                  شروط الاستخدام
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="font-card-title text-card-title text-surface-card mb-space-sm">نطاق التغطية</h4>
            <p className="font-body-compact text-body-compact text-surface-variant mb-space-sm">
              المحلة الكبرى • طنطا • زفتى • سمنود • محافظة الغربية والدلتا
            </p>
            <div className="p-3 rounded-xl bg-dark-slate flex flex-col gap-1">
              <span className="font-micro-caption text-micro-caption text-text-muted">مركز الدعم والوثائق</span>
              <span className="font-card-title-sm text-card-title-sm text-electric-volt">0% عمولة على الاشتراكات</span>
              <span className="font-micro-caption text-micro-caption text-surface-container-high">
                دفتر حصص QR أوفلاين مدمج
              </span>
            </div>
          </div>
        </div>

        <div className="mt-space-xl pt-space-md bg-dark-slate/40 -mx-margin-desktop px-margin lg:px-margin-desktop py-4 flex flex-col md:flex-row items-center justify-between gap-space-sm text-surface-variant font-micro-caption text-micro-caption">
          <span>© 2026 منصة كابتنلي (Captenly) — جميع الحقوق محفوظة لخدمة الرياضة والسباحة في مصر.</span>
          <span className="text-electric-volt">تصفح واستعلم مجاناً دون تسجيل مسبق — ادفع للمكان مباشرة.</span>
        </div>
      </div>
    </footer>
  );
}
