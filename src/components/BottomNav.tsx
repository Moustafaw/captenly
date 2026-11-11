"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCaptenly } from "@/context/CaptenlyContext";

export function BottomNav() {
  const pathname = usePathname();
  const { currentPersona } = useCaptenly();

  // Determine active profile link based on user role
  const getAccountHref = () => {
    if (currentPersona.role === "coach") return "/dashboard/coach";
    if (currentPersona.role === "facility_manager") return "/dashboard/facility";
    if (currentPersona.role === "super_admin") return "/admin";
    if (currentPersona.role === "guest") return "/auth";
    return "/dashboard/athlete/settings";
  };

  const navItems = [
    {
      href: "/",
      label: "الرئيسية",
      icon: "home",
      active: pathname === "/",
    },
    {
      href: "/explore",
      label: "استكشف",
      icon: "explore",
      active: pathname === "/explore" || pathname.startsWith("/f/") || pathname.startsWith("/c/"),
    },
    {
      href: "/favorites",
      label: "المفضلة",
      icon: "bookmark",
      active: pathname === "/favorites",
    },
    {
      href: "/dashboard/athlete",
      label: "حصصي",
      icon: "sports",
      active: pathname === "/dashboard/athlete",
    },
    {
      href: getAccountHref(),
      label: "حسابي",
      icon: "account_circle",
      active: pathname.includes("/settings") || pathname.startsWith("/dashboard/") || pathname === "/auth",
    },
  ];

  return (
    <nav
      aria-label="شريط التنقل السفلي للهاتف"
      className="fixed bottom-3 inset-x-4 z-50 pb-safe md:hidden pointer-events-none"
    >
      <div className="max-w-md mx-auto h-16 px-2 rounded-full bg-surface-card/95 backdrop-blur-xl shadow-floating border border-border-hairline/60 flex items-center justify-around pointer-events-auto">
        {navItems.map((item) => {
          const isActive = item.active;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-w-[48px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 ${
                isActive
                  ? "text-deep-olive font-bold"
                  : "text-text-muted hover:text-dark-slate"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] transition-transform ${
                  isActive ? "scale-110" : ""
                }`}
                style={
                  isActive
                    ? { fontVariationSettings: "'FILL' 1, 'wght' 600" }
                    : undefined
                }
              >
                {item.icon}
              </span>
              <span className="text-[11px] leading-tight font-cairo">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
