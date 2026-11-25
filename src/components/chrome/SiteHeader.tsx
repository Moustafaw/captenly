"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCaptenly } from "@/context/CaptenlyContext";
import { isChromeless } from "./chromeRoutes";
import { Icon } from "@/components/Icon";
import { signOut } from "next-auth/react";
import { GoogleMark } from "@/components/auth/GoogleSignInButton";
import { CaptenlyImage } from "@/components/CaptenlyImage";

const ACTIVE_TAB =
  "relative z-10 px-2.5 xl:px-3 py-1.5 rounded-full text-[#1D6E7D] font-extrabold text-[12px] xl:text-[12.5px] whitespace-nowrap transition-colors duration-300";
const IDLE_TAB =
  "relative z-10 px-2.5 xl:px-3 py-1.5 rounded-full text-[#475569] hover:text-[#1D6E7D] font-bold text-[12px] xl:text-[12.5px] whitespace-nowrap transition-colors duration-300";

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const {
    userLocation,
    setLocationModalOpen,
    unreadNotificationsCount,
    savedFavoriteIds,
    minorAthletes,
    currentPersona,
    isAuthenticated,
    openAuthGateModal,
    effectiveOffline,
    signOutToGuest,
    myStaffAssignments,
    activeStaffAssignment,
    switchToStaffMode,
    respondToStaffInvitation,
    storageHydrated,
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

  const staticNavStart: Array<{
    href: string;
    label: string;
    title?: string;
    match: (p: string) => boolean;
    gated?: boolean;
  }> = [
    { href: "/", label: "الرئيسية", match: (p: string) => p === "/" },
    {
      href: "/explore",
      label: "استكشف",
      match: (p: string) =>
        p.startsWith("/explore") ||
        p.startsWith("/pools") ||
        p.startsWith("/academy") ||
        (isAuthenticated && (p.startsWith("/coaches") || p.startsWith("/c/"))),
    },
    {
      href: "/compare",
      label: "قارن",
      match: (p: string) => p.startsWith("/compare"),
    },
  ];

  const staticNavEnd: Array<{
    href: string;
    label: string;
    title?: string;
    match: (p: string) => boolean;
    gated?: boolean;
  }> = [
    {
      href: "/dashboard/ledger",
      label: "دفتر الحصص QR",
      match: (p: string) => p.startsWith("/dashboard/ledger"),
      gated: true,
    },
    {
      href: "/magazine",
      label: "المجلة الرياضية",
      match: (p: string) => p.startsWith("/magazine"),
    },
  ];

  const verifiedStaffAssignment =
    activeStaffAssignment &&
    (!activeStaffAssignment.invitationStatus || activeStaffAssignment.invitationStatus === "accepted")
      ? activeStaffAssignment
      : null;

  const acceptedStaffAssignments = myStaffAssignments.filter(
    (s) => !s.invitationStatus || s.invitationStatus === "accepted"
  );

  const roleNavItems: Array<{
    href: string;
    label: string;
    title?: string;
    match: (p: string) => boolean;
    gated?: boolean;
  }> = !storageHydrated || !isAuthenticated
    ? [
        {
          href: "/coaches",
          label: "الكباتن الموثقون",
          match: (p: string) => p.startsWith("/coaches") || p.startsWith("/c/"),
        },
      ]
    : verifiedStaffAssignment
    ? [
        {
          href: "/dashboard/facility",
          label: "لوحة المنشأة",
          title: `لوحة ${verifiedStaffAssignment.facilityNameAr} (${verifiedStaffAssignment.roleTitleAr})`,
          match: (p: string) => p.startsWith("/dashboard/facility") || p.startsWith("/dashboard/ledger"),
        },
      ]
    : currentPersona.role === "coach"
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

  const NAV = [...staticNavStart, ...roleNavItems, ...staticNavEnd];

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
  }, [pathname, currentPersona.role, isAuthenticated, activeStaffAssignment?.id, storageHydrated]);

  if (isChromeless(pathname)) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : "/explore");
  };

  return (
    <header className="hidden lg:block sticky top-0 w-full z-50 bg-white/95 backdrop-blur-md shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
      {/* Row 1: Brand + Location + Spacious Search + User Controls */}
      <div className="h-[64px] max-w-[1280px] mx-auto px-margin lg:px-margin-desktop flex items-center justify-between gap-4">
        <Link href="/" className="relative z-10 flex items-center gap-2.5 shrink-0 cursor-pointer">
          <CaptenlyImage
            alt="كابتنلي"
            width={176}
            height={44}
            priority
            className="h-11 w-auto object-contain"
            src="/images/logo/captenly-logo-horizontal-dark.png"
          />
        </Link>

        <div className="flex-1 max-w-2xl mx-4 flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#F7F9FA] hover:bg-[#EAF4F8] rounded-full text-[#475569] hover:text-[#1D6E7D] cursor-pointer shrink-0 transition-colors border border-[#0F172A]/5"
          >
            <Icon name="location_on" className="text-[#1D6E7D] text-[16px]" />
            <span className="font-micro-caption text-[12px] font-bold whitespace-nowrap">
              {userLocation.isSpecified
                ? `${userLocation.city}، ${userLocation.governorate}`
                : "نطاق البحث: كل مصر"}
            </span>
            <Icon name="arrow_drop_down" className="text-[#64748B]" />
          </button>

          <form
            onSubmit={submit}
            className="flex-1 min-w-0 flex items-center bg-[#F7F9FA] rounded-full px-3.5 py-1.5 border border-[#0F172A]/10 focus-within:border-[#1D6E7D] focus-within:bg-white transition-colors"
          >
            <Icon name="search" className="text-[#64748B] ml-2 text-[17px] shrink-0" />
            <input
              aria-label="ابحث عن أكاديمية، مسبح، أو كابتن سباحة"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full min-w-0 bg-transparent border-0 outline-none font-body-compact text-[13px] text-[#0F172A] placeholder:text-[#475569] px-1"
              placeholder="ابحث عن أكاديمية، مسبح، أو كابتن سباحة..."
              type="text"
            />
            <Link
              href="/explore?filters=1"
              aria-label="فتح الفلاتر المتقدمة"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#0F172A]/10 text-[#475569] rounded-full font-micro-caption text-[11px] font-bold shrink-0 hover:bg-[#EAF4F8] hover:text-[#1D6E7D] transition-colors"
            >
              <Icon name="tune" className="text-[13px]" />
              <span>الفلاتر</span>
            </Link>
          </form>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {effectiveOffline && isAuthenticated && (
            <Link
              href="/dashboard/ledger"
              title="وضع الأوفلاين مفعل للـ QR"
              className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold flex items-center gap-1"
            >
              <Icon name="wifi_off" className="text-[14px]" />
              <span>أوفلاين</span>
            </Link>
          )}

          {!storageHydrated ? (
            <div aria-hidden="true" className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-full bg-[#F7F9FA] animate-pulse" />
              <span className="w-24 h-9 rounded-full bg-[#F7F9FA] animate-pulse" />
              <span className="w-24 h-9 rounded-full bg-[#EAF4F8] animate-pulse" />
            </div>
          ) : isAuthenticated ? (
            <>
              <Link
                href="/favorites"
                aria-label={savedFavoriteIds.length > 0 ? `المفضلة (${savedFavoriteIds.length})` : "المفضلة"}
                title="المفضلة"
                className="relative w-9 h-9 rounded-full bg-[#F7F9FA] hover:bg-[#EAF4F8] text-[#0F172A] hover:text-[#1D6E7D] flex items-center justify-center transition-colors border border-[#0F172A]/6"
              >
                <Icon name="bookmark" className="text-[18px]" />
                {savedFavoriteIds.length > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1D6E7D] text-white text-[10px] font-bold flex items-center justify-center"
                  >
                    {savedFavoriteIds.length}
                  </span>
                )}
              </Link>

              <Link
                href="/notifications"
                aria-label={unreadNotificationsCount > 0 ? `الإشعارات (${unreadNotificationsCount})` : "الإشعارات"}
                className="relative w-9 h-9 rounded-full bg-[#F7F9FA] hover:bg-[#EAF4F8] text-[#0F172A] hover:text-[#1D6E7D] flex items-center justify-center transition-colors border border-[#0F172A]/6"
              >
                <Icon name="notifications" className="text-[18px]" />
                {unreadNotificationsCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1D6E7D] text-white text-[10px] font-bold flex items-center justify-center"
                  >
                    {unreadNotificationsCount}
                  </span>
                )}
              </Link>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="w-9 h-9 rounded-full bg-[#1D6E7D] overflow-hidden border border-[#1D6E7D]/30 flex items-center justify-center cursor-pointer shadow-sm text-white hover:brightness-110 transition-all"
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
                    <Icon name="person" className="text-white text-[18px]" />
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-12 w-72 bg-white rounded-2xl shadow-[0_12px_36px_rgba(15,23,42,0.14)] p-2.5 flex flex-col border border-[#0F172A]/10 z-50">
                    <div className="px-3 py-2.5 rounded-xl bg-[#EAF4F8]/70 border border-[#1D6E7D]/15 mb-1.5 flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-[#1D6E7D]/25 flex items-center justify-center shrink-0">
                        {currentPersona.avatarUrl ? (
                          <img
                            src={currentPersona.avatarUrl}
                            alt={currentPersona.fullNameAr}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Icon name="person" className="text-[#1D6E7D] text-[18px]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-card-title-sm text-[#0F172A] truncate">{currentPersona.fullNameAr}</div>
                        {currentPersona.email && (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-[#64748B] truncate" dir="ltr">
                            <GoogleMark className="w-3 h-3 shrink-0" />
                            <span className="truncate">{currentPersona.email}</span>
                          </div>
                        )}
                        {currentPersona.memberCode && currentPersona.role !== "facility_manager" && (
                          <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-0.5">
                            <span>كود:</span>
                            <span className="font-mono font-bold text-[#1D6E7D]">
                              {currentPersona.memberCode}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Workspace Context Switcher: يظهر فقط للعضو العادي عند قبول دعوة موظف داخل منشأة */}
                    {currentPersona.role !== "guest" &&
                      currentPersona.role !== "coach" &&
                      currentPersona.role !== "facility_manager" &&
                      acceptedStaffAssignments.length > 0 && (
                        <div className="px-2.5 py-2 mb-1.5 rounded-xl bg-[#F7F9FA] border border-[#0F172A]/8 flex flex-col gap-1.5">
                          <div className="text-[10px] font-bold text-[#64748B] flex items-center gap-1">
                            <Icon name="workspaces" className="text-[13px] text-[#1D6E7D]" />
                            <span>نطاق العمل الحالي:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                switchToStaffMode(null);
                                setMenuOpen(false);
                                router.push("/dashboard/athlete");
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                !verifiedStaffAssignment
                                  ? "bg-[#1D6E7D] text-white"
                                  : "bg-white text-[#0F172A] border border-[#0F172A]/10"
                              }`}
                            >
                              حسابي الشخصي
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const targetAssign =
                                  verifiedStaffAssignment || acceptedStaffAssignments[0];
                                if (targetAssign) {
                                  switchToStaffMode(targetAssign.id);
                                  setMenuOpen(false);
                                  router.push("/dashboard/facility");
                                }
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                verifiedStaffAssignment
                                  ? "bg-[#1D6E7D] text-white"
                                  : "bg-white text-[#0F172A] border border-[#0F172A]/10"
                              }`}
                            >
                              إدارة المنشأة
                            </button>
                          </div>
                        </div>
                      )}

                    {myStaffAssignments.length > 0 && (
                      <div className="px-2.5 py-2 mb-1.5 rounded-xl bg-[#EAF4F8]/70 border border-[#1D6E7D]/20 flex flex-col gap-1.5">
                        <div className="text-[10px] font-bold text-[#1D6E7D] flex items-center gap-1">
                          <Icon name="swap_horiz" className="text-[14px]" />
                          <span>صلاحيات ودعوات فريق العمل:</span>
                        </div>
                        {myStaffAssignments.map((assign) => {
                          if (assign.invitationStatus === "pending") {
                            return (
                              <div
                                key={assign.id}
                                className="w-full p-2 rounded-lg bg-white border border-[#1D6E7D]/25 flex flex-col gap-1.5"
                              >
                                <span className="text-[10px] font-bold text-[#0F172A] truncate">
                                  دعوة: {assign.roleTitleAr} ({assign.facilityNameAr})
                                </span>
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      respondToStaffInvitation(assign.facilityId, assign.id, "accepted")
                                    }
                                    className="flex-1 py-1 rounded-md bg-[#1D6E7D] text-white text-[10px] font-bold"
                                  >
                                    قبول ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      respondToStaffInvitation(assign.facilityId, assign.id, "declined")
                                    }
                                    className="flex-1 py-1 rounded-md bg-red-50 text-[#DC2626] text-[10px] font-bold"
                                  >
                                    رفض ✕
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          const isCurrent = verifiedStaffAssignment?.id === assign.id;
                          return (
                            <button
                              key={assign.id}
                              type="button"
                              onClick={() => {
                                if (isCurrent) {
                                  switchToStaffMode(null);
                                  setMenuOpen(false);
                                  router.push("/dashboard/athlete");
                                } else {
                                  switchToStaffMode(assign.id);
                                  setMenuOpen(false);
                                  router.push("/dashboard/facility");
                                }
                              }}
                              className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-between transition-all ${
                                isCurrent
                                  ? "bg-[#1D6E7D] text-white"
                                  : "bg-white text-[#0F172A] hover:bg-[#F7F9FA] border border-[#0F172A]/10"
                              }`}
                            >
                              <span className="truncate">{assign.facilityNameAr} ({assign.roleTitleAr})</span>
                              <span className="text-[10px] shrink-0 mr-1">
                                {isCurrent ? "العودة لحسابي ↩" : "تفعيل ➔"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {(currentPersona.role === "coach"
                      ? [
                          { href: "/dashboard/coach", icon: "sports_score", label: "لوحة الكابتن والربط" },
                          { href: "/dashboard/ledger", icon: "qr_code_2", label: "دفتر طلابي (QR)" },
                          { href: "/favorites", icon: "bookmark", label: "المفضلة" },
                        ]
                      : currentPersona.role === "facility_manager"
                      ? [
                          { href: "/dashboard/facility", icon: "stadium", label: "لوحة إدارة الأكاديمية" },
                          { href: "/dashboard/ledger", icon: "qr_code_2", label: "دفاتر المشتركين (QR)" },
                          { href: "/favorites", icon: "bookmark", label: "المفضلة" },
                        ]
                      : [
                          {
                            href: "/dashboard/athlete",
                            icon: "person",
                            label:
                              minorAthletes.length > 0
                                ? "ملفي الرياضي والأبناء"
                                : "ملفي الرياضي وأرقامي",
                          },
                          { href: "/dashboard/ledger", icon: "qr_code_2", label: "دفتر الحصص الـ QR أوفلاين" },
                          { href: "/favorites", icon: "bookmark", label: "المفضلة" },
                          { href: "/compare", icon: "compare_arrows", label: "مقارنة المنشآت" },
                        ]
                    ).map((i) => (
                      <Link
                        key={i.href}
                        href={i.href}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#EAF4F8] font-body-compact text-body-compact text-[#0F172A] hover:text-[#1D6E7D] transition-colors"
                      >
                        <Icon name={i.icon} className="text-[#1D6E7D] text-[17px]" />
                        <span>{i.label}</span>
                      </Link>
                    ))}

                    <div className="h-px bg-[#0F172A]/8 my-1.5" />
                    <div className="flex flex-col gap-1 px-1">
                      <button
                        type="button"
                        onClick={() => {
                          signOutToGuest();
                          if (currentPersona.authProvider === "google") {
                            signOut({ redirect: false }).catch(() => undefined);
                          }
                          setMenuOpen(false);
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-50 font-body-compact text-body-compact text-[#DC2626] font-bold text-right transition-colors"
                      >
                        <Icon name="logout" className="text-[17px]" />
                        <span>تسجيل الخروج</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openAuthGateModal("حفظ المنشآت في المفضلة")}
                aria-label="المفضلة"
                title="المفضلة (يتطلب تسجيل الدخول)"
                className="w-9 h-9 rounded-full bg-[#F7F9FA] hover:bg-[#EAF4F8] text-[#0F172A] hover:text-[#1D6E7D] flex items-center justify-center transition-colors border border-[#0F172A]/5"
              >
                <Icon name="bookmark" className="text-[18px]" />
              </button>
              <Link
                href="/auth/login"
                className="px-4 py-2 rounded-full bg-[#F7F9FA] hover:bg-[#EAF4F8] text-[#0F172A] hover:text-[#1D6E7D] text-xs font-bold transition-colors whitespace-nowrap border border-[#0F172A]/10"
              >
                تسجيل الدخول
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-xs font-extrabold transition-colors whitespace-nowrap shadow-sm"
              >
                إنشاء حساب
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Clean Dedicated Sections Bar with Dynamic Floating Indicator */}
      <div className="w-full bg-[#F7F9FA]/95 border-t border-[#0F172A]/5">
        <div className="max-w-[1280px] mx-auto px-margin lg:px-margin-desktop h-[48px] flex items-center justify-between gap-4">
          <nav
            ref={navRef}
            className="relative flex items-center gap-0.5 overflow-x-auto scrollbar-none py-1.5"
          >
            {indicator.ready && (
              <>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-full bg-[#EAF4F8] transition-all duration-300 ease-out"
                  style={{ left: indicator.left, width: indicator.width }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 h-[3px] rounded-full bg-[#1D6E7D] transition-all duration-300 ease-out"
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
                title={n.title}
                onClick={(e) => {
                  if ("gated" in n && n.gated && !isAuthenticated) {
                    e.preventDefault();
                    openAuthGateModal(n.label);
                  }
                }}
                className={n.match(pathname) ? ACTIVE_TAB : IDLE_TAB}
                aria-current={n.match(pathname) ? "page" : undefined}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {!storageHydrated ? (
            <span
              aria-hidden="true"
              className="hidden xl:inline-flex w-44 h-6 rounded-full bg-[#EAF4F8]/70 animate-pulse shrink-0"
            />
          ) : currentPersona.role === "guest" ? (
            <span className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/15 text-[11px] font-bold shrink-0">
              <Icon name="verified" className="text-[13px]" />
              <span>0% عمولة — حجز وتقييم مباشر</span>
            </span>
          ) : activeStaffAssignment ? (
            (() => {
              const staffRoleLabel = activeStaffAssignment.roleTitleAr?.trim() || "موظف المنشأة";
              const staffFacilityLabel = activeStaffAssignment.facilityNameAr?.trim();
              const staffSummary = staffFacilityLabel
                ? `${staffRoleLabel} • ${staffFacilityLabel}`
                : staffRoleLabel;
              const staffFullTitle = staffFacilityLabel
                ? `وضع موظف: ${staffRoleLabel} — ${staffFacilityLabel}`
                : `وضع موظف: ${staffRoleLabel}`;
              return (
                <Link
                  href="/dashboard/facility"
                  title={staffFullTitle}
                  aria-label={staffFullTitle}
                  className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] border border-[#1D6E7D]/15 text-[11px] font-bold shrink-0 max-w-[260px]"
                >
                  <Icon name="badge" className="text-[14px] shrink-0" />
                  <span className="truncate">{staffSummary}</span>
                </Link>
              );
            })()
          ) : currentPersona.role === "coach" ? (
            <Link
              href="/dashboard/coach"
              className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-[11px] font-bold shrink-0"
            >
              <Icon name="verified" className="text-[14px]" />
              <span>وضع الكابتن ({currentPersona.memberCode || "CAP-C"})</span>
            </Link>
          ) : currentPersona.role === "facility_manager" ? (
            <Link
              href="/dashboard/facility"
              className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF4F8] text-[#1D6E7D] text-[11px] font-bold shrink-0"
            >
              <Icon name="stadium" className="text-[14px]" />
              <span>وضع إدارة المنشأة</span>
            </Link>
          ) : (
            <Link
              href="/dashboard/ledger"
              className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#0F172A]/10 text-[11px] font-bold text-[#0F172A] hover:border-[#1D6E7D] transition-colors shrink-0"
            >
              <Icon name="qr_code_2" className="text-[14px] text-[#1D6E7D]" />
              <span>كود العضوية:</span>
              <span className="font-mono text-[#1D6E7D]">{currentPersona.memberCode}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
