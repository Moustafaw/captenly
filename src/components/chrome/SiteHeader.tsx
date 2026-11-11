"use client";

// Global desktop header — 1:1 port of the header in Screens/Screan Desktop/_24 (72px editorial header),
// wired to routing, location detection, search and the account menu.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCaptenly } from "@/context/CaptenlyContext";
import { isChromeless } from "./chromeRoutes";
import { Icon } from "@/components/Icon";

const NAV = [
  { href: "/", label: "الرئيسية", match: (p: string) => p === "/" },
  { href: "/explore", label: "استكشف المنشآت", match: (p: string) => p.startsWith("/explore") || p.startsWith("/pools") },
  { href: "/explore?type=coaches", label: "المدربين والأكاديميات", match: (p: string) => p.startsWith("/academy") },
  { href: "/magazine", label: "المجلة الرياضية", match: (p: string) => p.startsWith("/magazine") },
  { href: "/favorites", label: "المفضلة 🔖", match: (p: string) => p.startsWith("/favorites") },
];

const ACTIVE = "transition-colors bg-lime-tint text-primary font-bold rounded-full px-3 py-1.5";
const IDLE = "text-on-surface-variant hover:text-on-surface transition-colors font-body-compact text-body-compact px-2 py-1";

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { userLocation, setLocationModalOpen, unreadNotificationsCount } = useCaptenly();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (isChromeless(pathname)) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : "/explore");
  };

  return (
    <header className="hidden lg:block fixed top-0 w-full z-50 bg-surface-card/95 backdrop-blur-md shadow-[0_1px_8px_rgba(44,52,55,0.06)]">
      <div className="h-[72px] max-w-[1280px] mx-auto px-margin-desktop flex items-center justify-between gap-space-md">
        <Link href="/" className="flex items-center gap-space-sm shrink-0">
          <img alt="كابتنلي" className="h-8 w-auto object-contain" src="/images/logo/Captenly_minimalist_logo_design_785a47d1_2K.jpg" />
          <div className="flex flex-col justify-center">
            <span className="font-card-title text-card-title text-dark-slate tracking-tight">كابتنلي</span>
            <span className="font-micro-caption text-micro-caption text-text-muted hidden xl:inline">مجتمعك الرياضي الموثق في مصر</span>
          </div>
        </Link>

        <div className="flex-1 max-w-xl mx-space-sm hidden lg:flex items-center gap-space-xs">
          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            className="flex items-center gap-1.5 px-space-sm py-1.5 bg-surface-container-low rounded-full text-secondary hover:text-on-surface cursor-pointer shrink-0"
          >
            <Icon name="location_on" className="text-athletic-olive" />
            <span className="font-micro-caption text-micro-caption font-bold">
              {userLocation.city}، {userLocation.governorate}
            </span>
            <Icon name="arrow_drop_down" className="text-text-muted" />
          </button>
          <form onSubmit={submit} className="flex-1 flex items-center bg-surface-snow rounded-full px-space-sm py-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
            <Icon name="search" className="text-text-muted ml-space-xs" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-transparent border-0 outline-none font-body-compact text-body-compact text-on-surface placeholder:text-text-muted px-1"
              placeholder="ابحث عن كابتن، أكاديمية، مسبح أو صالة..."
              type="text"
            />
            <Link href="/explore?filters=1" className="px-2 py-0.5 bg-surface-container text-secondary rounded-full font-micro-caption text-micro-caption shrink-0">
              الرياضة ▾
            </Link>
          </form>
        </div>

        <div className="flex items-center gap-space-md">
          <nav className="hidden xl:flex items-center gap-space-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={n.match(pathname) ? ACTIVE : IDLE} aria-current={n.match(pathname) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-space-xs shrink-0">
            <a
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-action-whatsapp/10 text-on-surface hover:text-action-whatsapp transition-all"
              href="https://wa.me/201000000000?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D9%83%D8%A7%D8%A8%D8%AA%D9%86%D9%84%D9%8A"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon name="chat" className="text-action-whatsapp" />
              <span className="font-badge-label text-badge-label">تواصل</span>
            </a>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer shadow-sm text-on-primary"
                aria-label="حسابي"
              >
                <Icon name="person" className="text-on-primary" />
              </button>
              {menuOpen && (
                <div className="absolute left-0 top-11 w-64 bg-surface-card rounded-2xl shadow-[0_12px_36px_rgba(26,31,33,0.12)] p-2 flex flex-col">
                  {[
                    { href: "/dashboard/athlete", icon: "groups", label: "حسابي وإدارة العائلة والأبناء" },
                    { href: "/dashboard/ledger", icon: "schedule", label: "دفتر الحصص والجواز الرياضي" },
                    { href: "/dashboard/coach", icon: "sports_score", label: "لوحة تحليلات الكابتن والمنشأة" },
                    { href: "/badges", icon: "verified", label: "مركز التوثيق والشارات" },
                    { href: "/dashboard/athlete/settings", icon: "tune", label: "الإعدادات" },
                  ].map((i) => (
                    <Link key={i.href} href={i.href} className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-surface-container-low font-body-compact text-body-compact text-dark-slate">
                      <Icon name={i.icon} className="text-deep-olive" />
                      {i.label}
                    </Link>
                  ))}
                  <div className="h-px bg-border-hairline my-1" />
                  <Link href="/auth" className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-surface-container-low font-body-compact text-body-compact text-status-danger">
                    <Icon name="chevron_left" className="text-status-danger" />
                    تسجيل الخروج
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
