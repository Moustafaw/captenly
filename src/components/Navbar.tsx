"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCaptenly } from "@/context/CaptenlyContext";

export function Navbar() {
  const pathname = usePathname();
  const {
    currentPersona,
    userLocation,
    setLocationModalOpen,
    setFilterModalOpen,
    savedFavoriteIds,
    unreadNotificationsCount,
  } = useCaptenly();

  const [searchQuery, setSearchQuery] = useState("");
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "الرئيسية" },
    { href: "/explore", label: "استكشف المنشآت" },
    { href: "/explore?category=pools", label: "المسابح" },
    { href: "/dashboard/athlete", label: "دفتر الحصص والجواز" },
    { href: "/magazine", label: "المجلة الرياضية" },
  ];

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-surface-card/95 backdrop-blur-md shadow-[0_1px_8px_rgba(44,52,55,0.06)] border-b border-border-hairline/60">
        <div className="h-[72px] max-w-[1340px] mx-auto px-4 md:px-6 flex items-center justify-between gap-3">
          {/* Logo & Slogan */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-dark-slate flex items-center justify-center p-1.5 shadow-sm">
                <svg
                  viewBox="0 0 120 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full"
                >
                  <circle cx="74" cy="26" r="11" fill="#B0FE09" />
                  <path
                    d="M40 52C48 43 60 42 71 47L82 53"
                    stroke="#FFFFFF"
                    strokeWidth="9"
                    strokeLinecap="round"
                  />
                  <path
                    d="M80 55C67 48 51 54 51 68C51 82 67 87 80 79"
                    stroke="#FFFFFF"
                    strokeWidth="11"
                    strokeLinecap="round"
                  />
                  <path
                    d="M46 75L30 89"
                    stroke="#B0FE09"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="font-cairo font-bold text-[20px] text-dark-slate tracking-tight leading-none">
                  كابتنلي
                </span>
                <span className="text-[11px] text-text-muted hidden xl:inline font-cairo mt-0.5">
                  مجتمعك الرياضي الموثق في مصر
                </span>
              </div>
            </Link>

            {/* Location Selector Pill */}
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low hover:bg-lime-tint/70 rounded-full text-secondary hover:text-deep-olive transition-colors shrink-0 text-xs font-semibold"
              title="تغيير النطاق الجغرافي"
            >
              <span className="material-symbols-outlined text-[16px] text-athletic-olive">
                location_on
              </span>
              <span className="truncate max-w-[120px] sm:max-w-none">
                {userLocation.city}
              </span>
              <span className="material-symbols-outlined text-[14px]">
                arrow_drop_down
              </span>
            </button>
          </div>

          {/* Search Bar (Desktop / Tablet) */}
          <div className="flex-1 max-w-md mx-2 hidden lg:flex items-center gap-1">
            <div className="flex-1 flex items-center bg-surface-snow rounded-full px-3.5 py-1.5 border border-border-hairline shadow-xs focus-within:ring-2 focus-within:ring-deep-olive/20 focus-within:border-deep-olive">
              <span className="material-symbols-outlined text-[18px] text-text-muted ml-1.5">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن كابتن سباحة، أكاديمية، أو مسبح..."
                className="w-full bg-transparent border-0 outline-none text-body-compact text-dark-slate placeholder:text-text-muted text-xs"
              />
              <button
                type="button"
                onClick={() => setFilterModalOpen(true)}
                className="px-2 py-0.5 bg-surface-container hover:bg-lime-tint text-secondary hover:text-deep-olive rounded-full text-[11px] font-semibold shrink-0 transition-colors"
              >
                الفلاتر ▾
              </button>
            </div>
          </div>

          {/* Nav Links (Desktop) */}
          <nav className="hidden xl:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href.split("?")[0]);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? "bg-lime-tint text-deep-olive shadow-xs"
                      : "text-text-muted hover:text-dark-slate hover:bg-surface-snow"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Action Icons (Desktop + Mobile) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* WhatsApp Contact CTA */}
            <a
              href="https://wa.me/201019000000?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D9%83%D8%A7%D8%A8%D8%AA%D9%86%D9%84%D9%8A%D8%8C%20%D8%A3%D8%AD%D8%AA%D8%A7%D8%AC%20%D9%85%D8%B3%D8%A7%D8%B9%D8%AF%D8%A9%20%D9%81%D9%8A%20%D8%A7%D8%AE%D8%AA%D9%8A%D8%A7%D8%B1%20%D8%A3%D9%83%D8%A7%D8%AF%D9%8A%D9%85%D9%8A%D8%A9"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-action-whatsapp/15 text-dark-slate hover:text-action-whatsapp transition-all text-xs font-bold"
            >
              <span className="material-symbols-outlined text-[17px] text-action-whatsapp">
                chat
              </span>
              <span>تواصل</span>
            </a>

            {/* Saved Bookmarks */}
            <Link
              href="/favorites"
              className="w-9 h-9 rounded-full bg-surface-snow hover:bg-surface-container-low flex items-center justify-center text-text-muted hover:text-dark-slate transition-colors relative border border-border-hairline"
              title="المفضلة وقوائم الحفظ"
            >
              <span className="material-symbols-outlined text-[18px]">bookmark</span>
              {savedFavoriteIds.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-deep-olive text-white text-[9px] font-bold flex items-center justify-center">
                  {savedFavoriteIds.length}
                </span>
              )}
            </Link>

            {/* Notifications Bell */}
            <Link
              href="/notifications"
              className="w-9 h-9 rounded-full bg-surface-snow hover:bg-surface-container-low flex items-center justify-center text-text-muted hover:text-dark-slate transition-colors relative border border-border-hairline"
              title="مركز التنبيهات"
            >
              <span className="material-symbols-outlined text-[18px]">
                notifications
              </span>
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-status-danger ring-2 ring-surface-card animate-pulse"></span>
              )}
            </Link>

            {/* Profile Dropdown Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary hover:opacity-90 transition-opacity shadow-xs border-2 border-surface-card"
                title="الملف الشخصي والحساب"
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div
                  className="absolute left-0 mt-2 w-64 bg-surface-card rounded-2xl shadow-xl border border-border-hairline py-2 z-50 text-right animate-scale-in"
                  dir="rtl"
                >
                  <div className="px-4 py-2 border-b border-border-hairline">
                    <span className="block text-micro-caption text-text-muted">
                      الحساب النشط:
                    </span>
                    <span className="block font-bold text-dark-slate text-body-compact">
                      {currentPersona.fullNameAr}
                    </span>
                    <span className="block text-micro-caption text-deep-olive">
                      {currentPersona.personaTitleAr}
                    </span>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/dashboard/athlete/settings"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-snow text-dark-slate text-xs"
                    >
                      <span className="material-symbols-outlined text-[18px] text-deep-olive">
                        manage_accounts
                      </span>
                      <span>إدارة العائلة والأبناء (قانون 151)</span>
                    </Link>

                    <Link
                      href="/dashboard/coach"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-snow text-dark-slate text-xs"
                    >
                      <span className="material-symbols-outlined text-[18px] text-athletic-olive">
                        sports
                      </span>
                      <span>لوحة الكابتن وإدارة النشر</span>
                    </Link>

                    <Link
                      href="/dashboard/facility"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-snow text-dark-slate text-xs"
                    >
                      <span className="material-symbols-outlined text-[18px] text-secondary">
                        domain
                      </span>
                      <span>لوحة المنشأة والرادار المحلي</span>
                    </Link>

                    <Link
                      href="/badges"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-snow text-dark-slate text-xs"
                    >
                      <span className="material-symbols-outlined text-[18px] text-deep-olive">
                        workspace_premium
                      </span>
                      <span>مركز التوثيق والشارات المعتمدة</span>
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-border-hairline px-4 py-2">
                    <Link
                      href="/auth"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center justify-between text-xs font-bold text-deep-olive hover:underline"
                    >
                      <span>تبديل الحساب أو تسجيل الخروج</span>
                      <span className="material-symbols-outlined text-[16px]">
                        logout
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop for closing dropdown */}
      {profileDropdownOpen && (
        <div
          onClick={() => setProfileDropdownOpen(false)}
          className="fixed inset-0 z-30"
        />
      )}
    </>
  );
}
