"use client";

// Global mobile bottom navigation dock (Screens/Screan Phone/_21)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isChromeless } from "./chromeRoutes";

export function SiteDock() {
  const pathname = usePathname() || "/";

  if (isChromeless(pathname)) return null;

  const tabs = [
    { href: "/", icon: "home", label: "الرئيسية", active: pathname === "/" },
    { href: "/explore", icon: "explore", label: "استكشف", active: pathname.startsWith("/explore") || pathname.startsWith("/pools") },
    { href: "/favorites", icon: "bookmark", label: "المفضلة", active: pathname.startsWith("/favorites") },
    { href: "/dashboard/ledger", icon: "sports", label: "حصصي", active: pathname.startsWith("/dashboard/ledger") },
    { href: "/dashboard/athlete", icon: "account_circle", label: "حسابي", active: pathname.startsWith("/dashboard/athlete") },
  ];

  return (
    <nav className="lg:hidden fixed bottom-3 inset-x-4 z-50 pb-safe pointer-events-none">
      <div className="max-w-md mx-auto h-16 px-space-xs rounded-full bg-surface-card/95 backdrop-blur-xl shadow-[0_12px_36px_rgba(26,31,33,0.12)] flex items-center justify-around pointer-events-auto border border-border-hairline/60">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              t.active ? "text-deep-olive font-bold" : "text-text-muted hover:text-dark-slate"
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">{t.icon}</span>
            <span className="font-badge-label text-[11px] leading-tight">{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
