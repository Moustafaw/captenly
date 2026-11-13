"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { isChromeless } from "./chromeRoutes";
import { signOut } from "next-auth/react";
import { GoogleMark, GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export function MobileHeader() {
  const pathname = usePathname() || "/";
  const {
    userLocation,
    setLocationModalOpen,
    unreadNotificationsCount,
    savedFavoriteIds,
    currentPersona,
    effectiveOffline,
    signOutToGuest,
  } = useCaptenly();

  const [sheetOpen, setSheetOpen] = useState(false);

  if (isChromeless(pathname)) return null;

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 w-full bg-surface-card/95 backdrop-blur-md shadow-[0_2px_10px_rgba(44,52,55,0.06)]">
        <div className="h-[58px] px-margin flex items-center justify-between gap-2">
          <Link href="/" className="shrink-0 flex items-center">
            <img
              src="/images/logo/captenly-logo-horizontal-dark.png"
              alt="كابتنلي"
              className="h-8 w-auto object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-surface-container-low text-dark-slate text-[11px] font-bold max-w-[135px] truncate"
          >
            <Icon name="location_on" className="text-deep-olive text-[14px] shrink-0" />
            <span className="truncate">{userLocation.city}</span>
            <Icon name="arrow_drop_down" className="text-text-muted text-[14px] shrink-0" />
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {effectiveOffline && (
              <Link
                href="/dashboard/ledger"
                aria-label="وضع الأوفلاين"
                className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center"
              >
                <Icon name="wifi_off" className="text-[15px]" />
              </Link>
            )}

            <Link
              href="/favorites"
              aria-label="المفضلة"
              className="relative w-8 h-8 rounded-full bg-surface-container-low text-dark-slate flex items-center justify-center"
            >
              <Icon name="bookmark" className="text-[17px]" />
              {savedFavoriteIds.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-dark-slate text-electric-volt text-[9px] font-bold flex items-center justify-center">
                  {savedFavoriteIds.length}
                </span>
              )}
            </Link>

            <Link
              href="/notifications"
              aria-label="الإشعارات"
              className="relative w-8 h-8 rounded-full bg-surface-container-low text-dark-slate flex items-center justify-center"
            >
              <Icon name="notifications" className="text-[17px]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-deep-olive text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="قائمة الحساب والأقسام"
              className="w-8 h-8 rounded-full bg-primary overflow-hidden border border-deep-olive/30 flex items-center justify-center text-on-primary"
            >
              {currentPersona.avatarUrl ? (
                <img
                  src={currentPersona.avatarUrl}
                  alt={currentPersona.fullNameAr}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Icon name="person" className="text-[17px]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Full Drawer / Account & Sections Sheet */}
      {sheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-dark-slate/50 backdrop-blur-sm flex justify-end"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-[86%] max-w-sm h-full bg-surface-card p-5 overflow-y-auto flex flex-col gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <img
                src="/images/logo/captenly-logo-horizontal-dark.png"
                alt="كابتنلي"
                className="h-8 w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="إغلاق القائمة"
                className="w-8 h-8 rounded-full bg-surface-snow text-dark-slate flex items-center justify-center"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            {/* Active Persona Banner */}
            <div className="rounded-2xl bg-dark-slate text-surface-card p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full overflow-hidden bg-deep-carbon flex items-center justify-center shrink-0 border border-electric-volt/50">
                {currentPersona.avatarUrl ? (
                  <img
                    src={currentPersona.avatarUrl}
                    alt={currentPersona.fullNameAr}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Icon name="person" className="text-electric-volt text-[20px]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-card-title-sm truncate">{currentPersona.fullNameAr}</div>
                {currentPersona.email && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-surface-container-high truncate" dir="ltr">
                    <GoogleMark className="w-3 h-3 shrink-0" />
                    <span className="truncate">{currentPersona.email}</span>
                  </div>
                )}
                <div className="text-[11px] font-mono text-electric-volt mt-0.5">
                  {currentPersona.memberCode || "CAP-M-5190"}
                </div>
              </div>
            </div>

            {/* Role-Isolated Sections */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-muted px-2 mb-1">أقسام المنصة</span>
              {[
                { href: "/", icon: "home", label: "الرئيسية" },
                { href: "/explore", icon: "explore", label: "استكشف المسابح والمدربين" },
                { href: "/favorites", icon: "bookmark", label: "المفضلة" },
                { href: "/compare", icon: "compare_arrows", label: "مقارنة الباقات" },
                { href: "/magazine", icon: "menu_book", label: "المجلة الرياضية" },
                ...(currentPersona.role === "coach"
                  ? [
                      { href: "/dashboard/coach", icon: "sports_score", label: "لوحة الكابتن والربط" },
                      { href: "/dashboard/ledger", icon: "qr_code_2", label: "دفتر طلابي (QR)" },
                      { href: "/dashboard/athlete/settings", icon: "tune", label: "الإعدادات وصورة البروفايل" },
                    ]
                  : currentPersona.role === "facility_manager"
                  ? [
                      { href: "/dashboard/facility", icon: "stadium", label: "لوحة إدارة الأكاديمية" },
                      { href: "/dashboard/ledger", icon: "qr_code_2", label: "دفاتر المشتركين (QR)" },
                      { href: "/dashboard/athlete/settings", icon: "tune", label: "الإعدادات وصورة البروفايل" },
                    ]
                  : currentPersona.role === "guest"
                  ? [
                      { href: "/claim", icon: "verified", label: "وثّق أكاديميتك أو حسابك ككابتن" },
                    ]
                  : [
                      { href: "/dashboard/athlete", icon: "person", label: "ملفي الرياضي والأسرة" },
                      { href: "/dashboard/ledger", icon: "qr_code_2", label: "دفتر الحصص الـ QR أوفلاين" },
                      { href: "/dashboard/athlete/settings", icon: "tune", label: "الإعدادات وصورة البروفايل" },
                    ]),
                { href: "/about", icon: "info", label: "عن كابتنلي والخصوصية" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSheetOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-surface-snow text-dark-slate text-sm font-bold"
                >
                  <Icon name={item.icon} className="text-deep-olive text-[18px]" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {currentPersona.authProvider === "google" ? (
                <>
                  <Link
                    href="/auth/onboarding?source=google"
                    onClick={() => setSheetOpen(false)}
                    className="w-full py-2.5 rounded-full bg-lime-tint text-deep-olive font-bold text-xs text-center flex items-center justify-center gap-1.5"
                  >
                    <GoogleMark className="w-4 h-4" />
                    <span>تعديل نوع الحساب والبيانات</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      signOutToGuest();
                      signOut({ redirect: false }).catch(() => undefined);
                      setSheetOpen(false);
                    }}
                    className="w-full py-2.5 rounded-full bg-red-50 text-status-danger font-bold text-xs text-center"
                  >
                    تسجيل الخروج من Google
                  </button>
                </>
              ) : (
                <>
                  <GoogleSignInButton
                    compact
                    labelAr="المتابعة عبر حساب Google"
                    className="w-full py-2.5"
                    onSuccessNavigate={() => setSheetOpen(false)}
                  />
                  <Link
                    href="/auth"
                    onClick={() => setSheetOpen(false)}
                    className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-bold text-xs text-center"
                  >
                    بوابة الدخول والتسجيل
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
