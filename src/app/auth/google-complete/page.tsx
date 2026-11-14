"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Icon } from "@/components/Icon";
import { GoogleMark } from "@/components/auth/GoogleSignInButton";
import { useCaptenly } from "@/context/CaptenlyContext";

export default function GoogleCompletePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { restoreOrLoginWithGoogle } = useCaptenly();
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (handled || status !== "authenticated") return;
    const email = session?.user?.email;
    if (!email) return;

    let cancelled = false;
    setHandled(true);

    (async () => {
      const res = await restoreOrLoginWithGoogle({
        name: session.user?.name || email.split("@")[0] || "عضو كابتنلي",
        email,
        image: session.user?.image || null,
        isSimulatedPreview: false,
      });
      if (cancelled) return;

      if (res.isNewUser || res.persona.needsOnboarding) {
        router.replace("/auth/onboarding?source=google");
      } else if (res.persona.role === "coach") {
        router.replace("/dashboard/coach");
      } else if (res.persona.role === "facility_manager") {
        router.replace("/dashboard/facility");
      } else {
        router.replace("/dashboard/ledger");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handled, status, session, restoreOrLoginWithGoogle, router]);

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-[460px] w-full bg-surface-card rounded-[24px] p-8 shadow-xl text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-surface-snow border border-surface-container flex items-center justify-center">
          <GoogleMark className="w-7 h-7" />
        </div>

        {status === "unauthenticated" ? (
          <>
            <h1 className="font-hero-headline text-[22px] text-dark-slate">
              لم تكتمل جلسة الدخول عبر Google
            </h1>
            <p className="font-body-compact text-text-muted">
              تأكد من السماح بالوصول أو تحقق من إعدادات مفاتيح Google OAuth في البيئة ثم أعد المحاولة.
            </p>
            <Link
              href="/auth/login"
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm"
            >
              العودة لصفحة تسجيل الدخول
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-hero-headline text-[22px] text-dark-slate">
              جاري تجهيز ملفك وكود عضويتك...
            </h1>
            <p className="font-body-compact text-text-muted">
              تم التحقق من حساب Google بنجاح، يتم الآن مزامنة بياناتك وتوليد كود CAP-M الخاص بك.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-tint text-deep-olive text-xs font-bold">
              <Icon name="verified" className="text-[16px]" />
              <span>لحظات ويتم التحويل تلقائياً</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
