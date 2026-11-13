"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCaptenly } from "@/context/CaptenlyContext";
import { isChromeless } from "./chromeRoutes";
import { Icon } from "@/components/Icon";
import { signOut } from "next-auth/react";
import { GoogleMark, GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const STATIC_NAV_START = [
  { href: "/", label: "الرئيسية", match: (p: string) => p === "/" },
  {
    href: "/explore",
    label: "استكشف",
    match: (p: string) =>
      p.startsWith("/explore") ||
      p.startsWith("/pools") ||
      p.startsWith("/coaches") ||
      p.startsWith("/compare") ||
      p.startsWith("/c/") ||
      p.startsWith("/academy") ||
      p.startsWith("/claim"),
  },
];

const STATIC_NAV_END = [
  {
    href: "/magazine",
    label: "المجلة الرياضية",
    match: (p: string) => p.startsWith("/magazine"),
  },
];

const ACTIVE_TAB =
  "relative z-10 px-2.5 xl:px-3 py-1.5 rounded-full text-[#65A30D] font-extrabold text-[12px] xl:text-[12.5px] whitespace-nowrap transition-colors duration-300";
const IDLE_TAB =
  "relative z-10 px-2.5 xl:px-3 py-1.5 rounded-full text-text-muted hover:text-[#65A30D] font-bold text-[12px] xl:text-[12.5px] whitespace-nowrap transition-colors duration-300";

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const {
    userLocation,
    setLocationModalOpen,
    unreadNotificationsCount,
    savedFavoriteIds,
    currentPersona,
    effectiveOffline,
    signOutToGuest,
  } = useCaptenly();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.closest?.('[data-google-modal="true"]')) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const roleNavItems =
    currentPersona.role === "coach"
      ? [
          {
            href: "/dashboard/coach",
            label: "لوحة الكابتن",
            match: (p: string) => p.startsWith("/dashboard/coach") || p.startsWith("/dashboard/ledger"),
          },
        ]
      : currentPersona.role === "facility_manager"
      ? [
          {
            href: "/dashboard/facility",
            label: "لوحة المنشأة",
            match: (p: string) => p.startsWith("/dashboard/facility") || p.startsWith("/dashboard/ledger"),
          },
        ]
      : [
          {
            href: "/dashboard/athlete",
            label: "مساحتي وحصصي",
            match: (p: string) => p.startsWith("/dashboard/athlete") || p.startsWith("/dashboard/ledger"),
          },
        ];

  const NAV = [...STATIC_NAV_START, ...roleNavItems, ...STATIC_NAV_END];

  useEffect(() => {
    const updateIndicator = () => {
      const activeIdx = NAV.findIndex((n) => n.match(pathname));
      const el = activeIdx >= 0 ? tabRefs.current[activeIdx] : null;
      const container = navRef.current;
      if (el && container) {
        const cRect = container.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();
        setIndicator({
          left: eRect.left - cRect.left + container.scrollLeft,
          width: eRect.width,
          ready: true,
        });
      } else {
        setIndicator((prev) => ({ ...prev, ready: false }));
      }
    };
    const raf = requestAnimationFrame(updateIndicator);
    window.addEventListener("resize", updateIndicator);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateIndicator);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, currentPersona.role]);

  if (isChromeless(pathname)) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : "/explore");
  };

  return (
    <header className="hidden lg:block sticky top-0 w-full z-50 bg-surface-card/95 backdrop-blur-md shadow-[0_2px_12px_rgba(44,52,55,0.06)]">
      {/* Row 1: Brand + Location + Spacious Search + User Controls */}
      <div className="h-[64px] max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <img
            alt="كابتنلي"
            className="h-11 w-auto object-contain"
            src="/images/logo/captenly-logo-horizontal-dark.png"
          />
        </Link>

        <div className="flex-1 max-w-2xl mx-4 flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low hover:bg-lime-tint/60 rounded-full text-secondary hover:text-dark-slate cursor-pointer shrink-0 transition-colors"
          >
            <Icon name="location_on" className="text-athletic-olive text-[16px]" />
            <span className="font-micro-caption text-[12px] font-bold whitespace-nowrap">
              {userLocation.city}، {userLocation.governorate}
            </span>
            <Icon name="arrow_drop_down" className="text-text-muted" />
          </button>

          <form
            onSubmit={submit}
            className="flex-1 min-w-0 flex items-center bg-surface-snow rounded-full px-3.5 py-1.5 border border-surface-container focus-within:border-deep-olive transition-colors"
          >
            <Icon name="search" className="text-text-muted ml-2 text-[17px] shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full min-w-0 bg-transparent border-0 outline-none font-body-compact text-[13px] text-on-surface placeholder:text-text-muted px-1"
              placeholder="ابحث عن أكاديمية، مسبح، أو كابتن سباحة..."
              type="text"
            />
            <Link
              href="/explore?filters=1"
              className="px-2.5 py-1 bg-surface-container text-secondary rounded-full font-micro-caption text-[11px] font-bold shrink-0 hover:bg-lime-tint hover:text-deep-olive transition-colors"
            >
              فلاتر ▾
            </Link>
          </form>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {effectiveOffline && (
            <Link
              href="/dashboard/ledger"
              title="وضع الأوفلاين مفعل للـ QR"
              className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold flex items-center gap-1"
            >
              <Icon name="wifi_off" className="text-[14px]" />
              <span>أوفلاين</span>
            </Link>
          )}

          <Link
            href="/favorites"
            aria-label="المفضلة"
            title="المفضلة"
            className="relative w-9 h-9 rounded-full bg-surface-container-low hover:bg-lime-tint text-dark-slate flex items-center justify-center transition-colors"
          >
            <Icon name="bookmark" className="text-[18px]" />
            {savedFavoriteIds.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-dark-slate text-electric-volt text-[10px] font-bold flex items-center justify-center">
                {savedFavoriteIds.length}
              </span>
            )}
          </Link>

          <Link
            href="/notifications"
            aria-label="الإشعارات"
            className="relative w-9 h-9 rounded-full bg-surface-container-low hover:bg-lime-tint text-dark-slate flex items-center justify-center transition-colors"
          >
            <Icon name="notifications" className="text-[18px]" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-deep-olive text-white text-[10px] font-bold flex items-center justify-center">
                {unreadNotificationsCount}
              </span>
            )}
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-primary overflow-hidden border border-deep-olive/30 flex items-center justify-center cursor-pointer shadow-sm text-on-primary hover:brightness-110 transition-all"
              aria-label="حسابي"
            >
              {currentPersona.avatarUrl ? (
                <img
                  src={currentPersona.avatarUrl}
                  alt={currentPersona.fullNameAr}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Icon name="person" className="text-on-primary text-[18px]" />
              )}
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-12 w-72 bg-surface-card rounded-2xl shadow-[0_12px_36px_rgba(26,31,33,0.16)] p-2.5 flex flex-col border border-surface-container z-50">
                <div className="px-3 py-2 rounded-xl bg-surface-snow mb-1.5 flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container flex items-center justify-center shrink-0">
                    {currentPersona.avatarUrl ? (
                      <img
                        src={currentPersona.avatarUrl}
                        alt={currentPersona.fullNameAr}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Icon name="person" className="text-deep-olive text-[18px]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-card-title-sm text-dark-slate truncate">{currentPersona.fullNameAr}</div>
                    {currentPersona.email && (
                      <div className="flex items-center gap-1 text-[10px] font-mono text-text-muted truncate" dir="ltr">
                        <GoogleMark className="w-3 h-3 shrink-0" />
                        <span className="truncate">{currentPersona.email}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-text-muted mt-0.5">
                      <span>كود:</span>
                      <span className="font-mono font-bold text-deep-olive">
                        {currentPersona.memberCode || "CAP-M"}
                      </span>
                    </div>
                  </div>
                </div>

                {(currentPersona.role === "coach"
                  ? [
                      { href: "/dashboard/coach", icon: "sports_score", label: "لوحة الكابتن والربط" },
                      { href: "/dashboard/ledger", icon: "qr_code_2", label: "دفتر طلابي (QR)" },
                      { href: "/favorites", icon: "bookmark", label: "المفضلة" },
                      { href: "/badges", icon: "verified", label: "مركز الشارات الخضراء" },
                      { href: "/dashboard/athlete/settings", icon: "tune", label: "الإعدادات والأمان" },
                    ]
                  : currentPersona.role === "facility_manager"
                  ? [
                      { href: "/dashboard/facility", icon: "stadium", label: "لوحة إدارة الأكاديمية" },
                      { href: "/dashboard/ledger", icon: "qr_code_2", label: "دفاتر المشتركين (QR)" },
                      { href: "/favorites", icon: "bookmark", label: "المفضلة" },
                      { href: "/badges", icon: "verified", label: "مركز التوثيق والشارات" },
                      { href: "/dashboard/athlete/settings", icon: "tune", label: "الإعدادات والأمان" },
                    ]
                  : currentPersona.role === "guest"
                  ? [
                      { href: "/favorites", icon: "bookmark", label: "المفضلة" },
                      { href: "/compare", icon: "compare_arrows", label: "مقارنة المنشآت" },
                      { href: "/claim", icon: "verified", label: "توثيق أكاديمية أو كابتن" },
                    ]
                  : [
                      { href: "/dashboard/athlete", icon: "person", label: "ملفي الرياضي والعائلة" },
                      { href: "/dashboard/ledger", icon: "qr_code_2", label: "دفتر الحصص الـ QR أوفلاين" },
                      { href: "/favorites", icon: "bookmark", label: "المفضلة" },
                      { href: "/compare", icon: "compare_arrows", label: "مقارنة المنشآت" },
                      { href: "/dashboard/athlete/settings", icon: "tune", label: "الإعدادات والأمان" },
                    ]
                ).map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-surface-container-low font-body-compact text-body-compact text-dark-slate"
                  >
                    <Icon name={i.icon} className="text-deep-olive text-[17px]" />
                    {i.label}
                  </Link>
                ))}

                <div className="h-px bg-border-hairline my-1.5" />
                <div className="flex flex-col gap-1.5 px-1">
                  {currentPersona.authProvider === "google" ? (
                    <>
                      <Link
                        href="/auth/onboarding?source=google"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-surface-container-low font-body-compact text-body-compact text-deep-olive font-bold"
                      >
                        <GoogleMark className="w-4 h-4 shrink-0" />
                        <span>إعداد نوع الحساب والملف</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          signOutToGuest();
                          signOut({ redirect: false }).catch(() => undefined);
                          setMenuOpen(false);
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-50 font-body-compact text-body-compact text-status-danger font-bold text-right"
                      >
                        <Icon name="logout" className="text-[17px]" />
                        <span>تسجيل الخروج من Google</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <GoogleSignInButton
                        compact
                        labelAr="الدخول بحساب Google"
                        className="w-full"
                        onSuccessNavigate={() => setMenuOpen(false)}
                      />
                      <Link
                        href="/auth"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-surface-container-low font-body-compact text-body-compact text-deep-olive font-bold"
                      >
                        <Icon name="login" className="text-[17px]" />
                        تسجيل حساب / بوابة الأدوار
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Clean Dedicated Sections Bar with Dynamic Floating Indicator */}
      <div className="w-full bg-surface-snow/95 border-t border-surface-container/70">
        <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop h-[48px] flex items-center justify-between gap-4">
          <nav
            ref={navRef}
            className="relative flex items-center gap-0.5 overflow-x-auto scrollbar-none py-1.5"
          >
            {indicator.ready && (
              <>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-full bg-[#65A30D]/10 transition-all duration-300 ease-out"
                  style={{ left: indicator.left, width: indicator.width }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 h-[3px] rounded-full bg-[#65A30D] transition-all duration-300 ease-out"
                  style={{
                    left: indicator.left + 12,
                    width: Math.max(16, indicator.width - 24),
                  }}
                />
              </>
            )}
            {NAV.map((n, idx) => (
              <Link
                key={n.href}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                href={n.href}
                className={n.match(pathname) ? ACTIVE_TAB : IDLE_TAB}
                aria-current={n.match(pathname) ? "page" : undefined}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {currentPersona.role === "guest" ? (
            <Link
              href="/auth/register"
              className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-dark-slate text-electric-volt text-[11px] font-bold shrink-0"
            >
              <span>سجّل للحصول على كود عضويتك</span>
            </Link>
          ) : currentPersona.role === "coach" ? (
            <Link
              href="/dashboard/coach"
              className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-tint text-deep-olive text-[11px] font-bold shrink-0"
            >
              <Icon name="verified" className="text-[14px]" />
              <span>وضع الكابتن ({currentPersona.memberCode || "CAP-C"})</span>
            </Link>
          ) : currentPersona.role === "facility_manager" ? (
            <Link
              href="/dashboard/facility"
              className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-tint text-deep-olive text-[11px] font-bold shrink-0"
            >
              <Icon name="stadium" className="text-[14px]" />
              <span>وضع إدارة المنشأة</span>
            </Link>
          ) : (
            <Link
              href="/dashboard/ledger"
              className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-card border border-surface-container text-[11px] font-bold text-dark-slate hover:border-deep-olive transition-colors shrink-0"
            >
              <Icon name="qr_code_2" className="text-[14px] text-deep-olive" />
              <span>كود العضوية:</span>
              <span className="font-mono text-deep-olive">{currentPersona.memberCode || "CAP-M-5190"}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
