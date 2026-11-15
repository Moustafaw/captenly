"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GoogleMark } from "@/components/auth/GoogleSignInButton";
import { useCaptenly } from "@/context/CaptenlyContext";

export default function GoogleCompletePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { restoreOrLoginWithGoogle } = useCaptenly();
  const handledRef = useRef(false);
  const restoreRef = useRef(restoreOrLoginWithGoogle);
  restoreRef.current = restoreOrLoginWithGoogle;
  const [sessionFailed, setSessionFailed] = useState(false);

  const completeAndRedirect = async (user: {
    email: string;
    name?: string | null;
    image?: string | null;
  }) => {
    if (handledRef.current) return;
    handledRef.current = true;

    try {
      const res = await restoreRef.current({
        name: user.name || user.email.split("@")[0] || "عضو كابتنلي",
        email: user.email,
        image: user.image || null,
        isSimulatedPreview: false,
      });

      const targetPath =
        res.persona.role === "coach"
          ? "/dashboard/coach"
          : res.persona.role === "facility_manager"
            ? "/dashboard/facility"
            : "/dashboard/athlete";

      router.replace(targetPath);
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          if (window.location.pathname === "/auth/google-complete") {
            window.location.replace(targetPath);
          }
        }, 250);
      }
    } catch {
      handledRef.current = false;
      setSessionFailed(true);
    }
  };

  useEffect(() => {
    if (handledRef.current) return;
    if (status === "authenticated" && session?.user?.email) {
      void completeAndRedirect({
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  useEffect(() => {
    if (handledRef.current) return;
    let active = true;

    const verifySessionDirectly = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = res.ok ? await res.json().catch(() => null) : null;
        if (!active || handledRef.current) return;
        if (data?.user?.email) {
          await completeAndRedirect({
            email: String(data.user.email),
            name: typeof data.user.name === "string" ? data.user.name : null,
            image: typeof data.user.image === "string" ? data.user.image : null,
          });
          return;
        }
        if (status === "unauthenticated") {
          setSessionFailed(true);
        }
      } catch {
        if (active && status === "unauthenticated") {
          setSessionFailed(true);
        }
      }
    };

    void verifySessionDirectly();

    const fallbackTimer = window.setTimeout(() => {
      if (!handledRef.current && active) {
        void verifySessionDirectly();
      }
    }, 1200);

    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-[420px] w-full bg-surface-card rounded-[24px] p-8 shadow-xl text-center flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-surface-snow border border-surface-container flex items-center justify-center">
          <GoogleMark className="w-6 h-6" />
        </div>

        {sessionFailed && status === "unauthenticated" ? (
          <>
            <h1 className="font-hero-headline text-[20px] text-dark-slate">
              لم تكتمل جلسة الدخول عبر Google
            </h1>
            <p className="font-body-compact text-text-muted">
              يرجى إعادة المحاولة لتسجيل الدخول إلى حسابك.
            </p>
            <Link
              href="/auth/login"
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm"
            >
              العودة لصفحة تسجيل الدخول
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-1">
            <div className="w-7 h-7 rounded-full border-2 border-surface-container border-t-deep-olive animate-spin" />
            <p className="text-sm font-bold text-dark-slate">جاري تسجيل الدخول...</p>
          </div>
        )}
      </div>
    </div>
  );
}
