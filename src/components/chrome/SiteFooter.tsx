"use client";

// Global desktop footer (Screens/Screan Desktop/_24)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isChromeless } from "./chromeRoutes";

export function SiteFooter() {
  const pathname = usePathname() || "";
  if (isChromeless(pathname)) return null;

  return (
    <footer className="hidden lg:block w-full bg-dark-slate text-surface-container-lowest mt-space-xl">
      <div className="max-w-[1280px] mx-auto px-margin-desktop py-space-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-gutter-desktop mb-space-xl">
          <div className="lg:col-span-2 flex flex-col gap-space-sm">
            <div className="flex items-center gap-space-xs">
              <span className="font-section-title text-section-title text-electric-volt">كابتنلي • CAPTENLY</span>
            </div>
            <p className="font-body-default text-body-default text-surface-container-highest max-w-md">
              المنصة الأولى الموثوقة في مصر لاكتشاف واختيار مدربي الرياضة، أكاديميات السباحة، والمراكز الرياضية المؤهلة بأعلى معايير الأمان والشفافية.
            </p>
            <div className="flex items-center gap-space-xs mt-space-xs">
              <span className="px-2.5 py-1 rounded-full bg-deep-carbon text-electric-volt font-badge-label text-badge-label">✓ هوية موثقة</span>
              <span className="px-2.5 py-1 rounded-full bg-deep-carbon text-electric-volt font-badge-label text-badge-label">✓ شهادات معتمدة</span>
              <span className="px-2.5 py-1 rounded-full bg-deep-carbon text-electric-volt font-badge-label text-badge-label">✓ أسعار بلا رسوم خفية</span>
            </div>
          </div>
          <div>
            <h4 className="font-card-title text-card-title text-surface-card mb-space-sm">الرياضات والأنشطة</h4>
            <ul className="flex flex-col gap-space-xs font-body-compact text-body-compact text-surface-container-high">
              <li><Link className="hover:text-electric-volt transition-colors" href="/pools">أكاديميات ومسابح السباحة</Link></li>
              <li><Link className="hover:text-electric-volt transition-colors" href="/explore">صالات اللياقة وبناء الأجسام</Link></li>
              <li><Link className="hover:text-electric-volt transition-colors" href="/explore">أكاديميات كرة القدم والناشئين</Link></li>
              <li><Link className="hover:text-electric-volt transition-colors" href="/explore">الفنون القتالية والدفاع عن النفس</Link></li>
              <li><Link className="hover:text-electric-volt transition-colors" href="/explore">الجمباز والرياضات الإيقاعية</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-card-title text-card-title text-surface-card mb-space-sm">المنصة والدعم</h4>
            <ul className="flex flex-col gap-space-xs font-body-compact text-body-compact text-surface-container-high">
              <li><Link className="hover:text-electric-volt transition-colors" href="/">عن منصة كابتنلي</Link></li>
              <li><Link className="hover:text-electric-volt transition-colors" href="/badges">معايير توثيق الكباتن</Link></li>
              <li><Link className="hover:text-electric-volt transition-colors" href="/auth">انضم ككابتن أو أكاديمية</Link></li>
              <li><Link className="hover:text-electric-volt transition-colors" href="/magazine">المقالات والتحليلات الرياضية</Link></li>
              <li><Link className="hover:text-electric-volt transition-colors" href="/dashboard/athlete/settings/security">شروط الاستخدام والخصوصية</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-card-title text-card-title text-surface-card mb-space-sm">التواصل الرسمي</h4>
            <p className="font-body-compact text-body-compact text-surface-container-high mb-space-sm">
              فريق الدعم الفني جاهز لمساعدتك وحجز الحصص التجريبية مباشرة.
            </p>
            <a
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-action-whatsapp text-surface-card font-card-title-sm text-card-title-sm hover:opacity-90 transition-opacity"
              rel="noopener noreferrer"
              target="_blank"
              href="https://wa.me/201000000000?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D9%83%D8%A7%D8%A8%D8%AA%D9%86%D9%84%D9%8A"
            >
              <span className="material-symbols-outlined text-[18px]">chat</span>
              تواصل عبر واتساب
            </a>
          </div>
        </div>
        <div className="pt-space-md mt-space-md border-t border-secondary/30 flex flex-col sm:flex-row items-center justify-between gap-space-sm text-surface-container-high font-micro-caption text-micro-caption">
          <p>© 2025 كابتنلي (Captenly.com). جميع الحقوق محفوظة لجمهورية مصر العربية.</p>
          <p className="font-body-compact text-body-compact text-surface-container-high">صُنع بعناية للمجتمع الرياضي المصري 🇪🇬</p>
        </div>
      </div>
    </footer>
  );
}
