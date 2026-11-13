"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isChromeless } from "./chromeRoutes";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

export function SiteDock() {
  const pathname = usePathname() || "/";
  const { currentPersona } = useCaptenly();
  const dockRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const isCoach = currentPersona.role === "coach";
  const isFacility = currentPersona.role === "facility_manager";

  const tabs = [
    { href: "/", icon: "home", label: "الرئيسية", active: pathname === "/" },
    {
      href: "/explore",
      icon: "explore",
      label: "استكشف",
      active: pathname.startsWith("/explore") || pathname.startsWith("/pools"),
    },
    {
      href: "/compare",
      icon: "compare_arrows",
      label: "قارن",
      active: pathname.startsWith("/compare"),
    },
    {
      href: "/dashboard/ledger",
      icon: "qr_code_2",
      label: "حصصي QR",
      active: pathname.startsWith("/dashboard/ledger"),
    },
    isCoach
      ? {
          href: "/dashboard/coach",
          icon: "sports_score",
          label: "الكابتن",
          active: pathname.startsWith("/dashboard/coach"),
        }
      : isFacility
      ? {
          href: "/dashboard/facility",
          icon: "stadium",
          label: "المنشأة",
          active: pathname.startsWith("/dashboard/facility"),
        }
      : {
          href: "/dashboard/athlete",
          icon: "account_circle",
          label: "حسابي",
          active: pathname.startsWith("/dashboard/athlete"),
        },
  ];

  useEffect(() => {
    const update = () => {
      const idx = tabs.findIndex((t) => t.active);
      const el = idx >= 0 ? itemRefs.current[idx] : null;
      const container = dockRef.current;
      if (el && container) {
        const cRect = container.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();
        setIndicator({
          left: eRect.left - cRect.left,
          width: eRect.width,
          ready: true,
        });
      } else {
        setIndicator((prev) => ({ ...prev, ready: false }));
      }
    };
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, currentPersona.role]);

  if (isChromeless(pathname)) return null;

  return (
    <>
      <div className="lg:hidden h-24" aria-hidden="true" />
      <nav className="lg:hidden fixed bottom-3 inset-x-3 z-40 pointer-events-none">
        <div
          ref={dockRef}
          className="relative max-w-md mx-auto h-16 px-2 rounded-full bg-surface-card/95 backdrop-blur-xl shadow-[0_12px_36px_rgba(26,31,33,0.14)] flex items-center justify-around pointer-events-auto border border-border-hairline/70"
        >
          {indicator.ready && (
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-full bg-[#65A30D]/12 transition-all duration-300 ease-out"
                style={{ left: indicator.left, width: indicator.width }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-1 h-[3px] rounded-full bg-[#65A30D] transition-all duration-300 ease-out"
                style={{
                  left: indicator.left + Math.max(8, indicator.width * 0.25),
                  width: Math.max(18, indicator.width * 0.5),
                }}
              />
            </>
          )}

          {tabs.map((t, idx) => (
            <Link
              key={t.href}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              href={t.href}
              className={`relative z-10 min-w-[52px] min-h-[46px] px-2.5 py-1 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors duration-300 ${
                t.active ? "text-[#65A30D] font-extrabold" : "text-text-muted hover:text-[#65A30D]"
              }`}
            >
              <Icon
                name={t.icon}
                className={`text-[19px] transition-transform duration-300 ${
                  t.active ? "-translate-y-0.5 scale-110" : ""
                }`}
              />
              <span className="font-badge-label text-[10px] leading-tight whitespace-nowrap">
                {t.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
