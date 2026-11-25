"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { isChromeless } from "./chromeRoutes";
import { signOut } from "next-auth/react";
import { GoogleMark, GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { CaptenlyImage } from "@/components/CaptenlyImage";

export function MobileHeader() {
  const pathname = usePathname() || "/";
  const {
    userLocation,
    setLocationModalOpen,
    unreadNotificationsCount,
    savedFavoriteIds,
    currentPersona,
    isAuthenticated,
    openAuthGateModal,
    effectiveOffline,
    signOutToGuest,
    myStaffAssignments,
    activeStaffAssignment,
    switchToStaffMode,
    respondToStaffInvitation,
  } = useCaptenly();

  const [sheetOpen, setSheetOpen] = useState(false);

  if (isChromeless(pathname)) return null;

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
        <div className="h-[58px] px-margin flex items-center justify-between gap-2">
          <Link href="/" className="relative z-10 shrink-0 flex items-center cursor-pointer">
            <CaptenlyImage
              src="/images/logo/captenly-logo-horizontal-dark.png"
              alt="كابتنلي"
              width={136}
              height={32}
              priority
              className="h-8 w-auto object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#F7F9FA] border border-[#0F172A]/10 text-[#0F172A] text-[11px] font-bold max-w-[135px] truncate hover:border-[#1D6E7D]/40 transition-colors"
          >
            <Icon name="location_on" className="text-[#1D6E7D] text-[14px] shrink-0" />
            <span className="truncate">
              {userLocation.isSpecified ? userLocation.city : "كل مصر"}
            </span>
            <Icon name="arrow_drop_down" className="text-[#64748B] text-[14px] shrink-0" />
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAuthenticated ? (
              <>
                {activeStaffAssignment && (
                  <Link
                    href="/dashboard/facility"
                    className="px-2 py-1 rounded-full bg-[#1D6E7D] text-white text-[10px] font-bold whitespace-nowrap"
                  >
                    وضع موظف ✓
                  </Link>
                )}
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
                  aria-label={savedFavoriteIds.length > 0 ? `المفضلة (${savedFavoriteIds.length})` : "المفضلة"}
                  className="relative w-8 h-8 rounded-full bg-[#F7F9FA] text-[#0F172A] hover:bg-[#EAF4F8] hover:text-[#1D6E7D] flex items-center justify-center transition-colors"
                >
                  <Icon name="bookmark" className="text-[17px]" />
                  {savedFavoriteIds.length > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#1D6E7D] text-white text-[9px] font-bold flex items-center justify-center"
                    >
                      {savedFavoriteIds.length}
                    </span>
                  )}
                </Link>

                <Link
                  href="/notifications"
                  aria-label={unreadNotificationsCount > 0 ? `الإشعارات (${unreadNotificationsCount})` : "الإشعارات"}
                  className="relative w-8 h-8 rounded-full bg-[#F7F9FA] text-[#0F172A] hover:bg-[#EAF4F8] hover:text-[#1D6E7D] flex items-center justify-center transition-colors"
                >
                  <Icon name="notifications" className="text-[17px]" />
                  {unreadNotificationsCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#1D6E7D] text-white text-[9px] font-bold flex items-center justify-center"
                    >
                      {unreadNotificationsCount}
                    </span>
                  )}
                </Link>

                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  aria-label="قائمة الحساب والأقسام"
                  className="w-8 h-8 rounded-full bg-[#1D6E7D] overflow-hidden border border-[#1D6E7D]/30 flex items-center justify-center text-white"
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
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-2.5 py-1.5 rounded-full bg-[#F7F9FA] border border-[#0F172A]/10 text-[#0F172A] text-[11px] font-bold whitespace-nowrap"
                >
                  دخول
                </Link>
                <Link
                  href="/auth/register"
                  className="px-3 py-1.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white text-[11px] font-extrabold whitespace-nowrap shadow-sm transition-colors"
                >
                  حساب جديد
                </Link>
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  aria-label="القائمة الجانبية"
                  className="w-8 h-8 rounded-full bg-[#F7F9FA] border border-[#0F172A]/10 flex items-center justify-center text-[#0F172A]"
                >
                  <Icon name="menu" className="text-[18px]" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Full Drawer / Side Sheet (Zero duplication with Bottom Dock!) */}
      {sheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-[#0F172A]/45 backdrop-blur-sm flex justify-end"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-[86%] max-w-sm h-full bg-white p-5 overflow-y-auto flex flex-col gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Link
                href="/"
                onClick={() => setSheetOpen(false)}
                className="shrink-0 flex items-center cursor-pointer"
              >
                <img
                  src="/images/logo/captenly-logo-horizontal-dark.png"
                  alt="كابتنلي"
                  className="h-8 w-auto object-contain"
                />
              </Link>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="إغلاق القائمة"
                className="w-8 h-8 rounded-full bg-[#F7F9FA] text-[#0F172A] hover:bg-[#EAF4F8] flex items-center justify-center transition-colors"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            {isAuthenticated ? (
              <div className="rounded-2xl bg-[#EAF4F8] border border-[#1D6E7D]/15 text-[#0F172A] p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-white flex items-center justify-center shrink-0 border border-[#1D6E7D]/30">
                  {currentPersona.avatarUrl ? (
                    <img
                      src={currentPersona.avatarUrl}
                      alt={currentPersona.fullNameAr}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon name="person" className="text-[#1D6E7D] text-[20px]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-card-title-sm truncate">{currentPersona.fullNameAr}</div>
                  {currentPersona.email && (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-[#64748B] truncate" dir="ltr">
                      <GoogleMark className="w-3 h-3 shrink-0" />
                      <span className="truncate">{currentPersona.email}</span>
                    </div>
                  )}
                  {currentPersona.memberCode && currentPersona.role !== "facility_manager" && (
                    <div className="text-[11px] font-mono text-[#1D6E7D] font-bold mt-0.5">
                      {currentPersona.memberCode}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#EAF4F8] border border-[#1D6E7D]/15 text-[#0F172A] p-4 flex flex-col gap-2.5">
                <div className="font-card-title-sm text-[#1D6E7D] font-extrabold">مرحباً بك في كابتنلي</div>
                <p className="text-[11px] text-[#475569] leading-relaxed">
                  أنشئ حسابك المجاني لحفظ المفضلة ومقارنة المنشآت والحصول على كود العضوية ودفتر الحصص الـ QR.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href="/auth/login"
                    onClick={() => setSheetOpen(false)}
                    className="py-2 rounded-full bg-white border border-[#0F172A]/10 text-[#0F172A] font-bold text-xs text-center"
                  >
                    تسجيل دخول
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setSheetOpen(false)}
                    className="py-2 rounded-full bg-[#1D6E7D] text-white font-extrabold text-xs text-center shadow-sm"
                  >
                    إنشاء حساب
                  </Link>
                </div>
              </div>
            )}

            {isAuthenticated && myStaffAssignments.length > 0 && (
              <div className="rounded-2xl bg-[#EAF4F8]/70 border border-[#1D6E7D]/20 p-3 flex flex-col gap-2">
                <div className="text-[11px] font-bold text-[#1D6E7D] flex items-center gap-1.5">
                  <Icon name="swap_horiz" className="text-[16px]" />
                  <span>تبديل الحساب الوظيفي بالمنشأة</span>
                </div>
                {myStaffAssignments.map((assign) => {
                  if (assign.invitationStatus === "pending") {
                    return (
                      <div
                        key={assign.id}
                        className="w-full p-2.5 rounded-xl bg-white border border-[#1D6E7D]/25 flex flex-col gap-1.5"
                      >
                        <span className="text-xs font-bold text-[#0F172A] truncate">
                          دعوة: {assign.roleTitleAr} ({assign.facilityNameAr})
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              respondToStaffInvitation(assign.facilityId, assign.id, "accepted")
                            }
                            className="flex-1 py-1.5 rounded-lg bg-[#1D6E7D] text-white text-xs font-bold"
                          >
                            قبول الدعوة ✓
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              respondToStaffInvitation(assign.facilityId, assign.id, "declined")
                            }
                            className="flex-1 py-1.5 rounded-lg bg-red-50 text-[#DC2626] text-xs font-bold"
                          >
                            رفض ✕
                          </button>
                        </div>
                      </div>
                    );
                  }
                  const isCurrent = activeStaffAssignment?.id === assign.id;
                  return (
                    <Link
                      key={assign.id}
                      href={isCurrent ? "/dashboard/athlete" : "/dashboard/facility"}
                      onClick={() => {
                        switchToStaffMode(isCurrent ? null : assign.id);
                        setSheetOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between ${
                        isCurrent
                          ? "bg-[#1D6E7D] text-white"
                          : "bg-white text-[#0F172A] border border-[#0F172A]/10"
                      }`}
                    >
                      <span className="truncate">{assign.facilityNameAr} ({assign.roleTitleAr})</span>
                      <span className="text-[10px] shrink-0 mr-1">
                        {isCurrent ? "العودة لحسابي ↩" : "تفعيل ➔"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Side Drawer Sections — Strictly Clean Non-Duplicating Navigation */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-[#64748B] px-2 mb-1">أقسام المنصة</span>
              {[
                { href: "/coaches", icon: "sports", label: "الكباتن الموثقون", gated: false },
                { href: "/compare", icon: "compare_arrows", label: "قارن بين المنشآت", gated: false },
                { href: "/dashboard/ledger", icon: "qr_code_2", label: "دفتر الحصص QR", gated: true },
                { href: "/magazine", icon: "menu_book", label: "المجلة الرياضية", gated: false },
                { href: "/favorites", icon: "bookmark", label: "المفضلة", gated: true },
                { href: "/notifications", icon: "notifications", label: "مركز الإشعارات", gated: true },
                ...(!isAuthenticated
                  ? [
                      {
                        href: "/claim",
                        icon: "verified",
                        label: "وثّق أكاديميتك أو حسابك ككابتن",
                        gated: true,
                      },
                    ]
                  : []),
                { href: "/about", icon: "info", label: "عن كابتنلي", gated: false },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    setSheetOpen(false);
                    if (item.gated && !isAuthenticated) {
                      e.preventDefault();
                      openAuthGateModal(item.label);
                    }
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#EAF4F8] text-[#0F172A] hover:text-[#1D6E7D] text-sm font-bold transition-colors"
                >
                  <Icon name={item.icon} className="text-[#1D6E7D] text-[18px]" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    signOutToGuest();
                    if (currentPersona.authProvider === "google") {
                      signOut({ redirect: false }).catch(() => undefined);
                    }
                    setSheetOpen(false);
                  }}
                  className="w-full py-2.5 rounded-full bg-red-50 hover:bg-red-100 text-[#DC2626] font-bold text-xs text-center transition-colors"
                >
                  تسجيل الخروج
                </button>
              ) : (
                <GoogleSignInButton
                  compact
                  labelAr="المتابعة السريعة عبر Google"
                  className="w-full py-2.5"
                  onSuccessNavigate={() => setSheetOpen(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
