"use client";

import React, { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

interface GoogleStatusResponse {
  configured: boolean;
  previewAllowed?: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasAuthSecret: boolean;
  missingKeys: string[];
  callbackPath: string;
}

interface GoogleSignInButtonProps {
  labelAr?: string;
  variant?: "light" | "dark";
  compact?: boolean;
  className?: string;
  onSuccessNavigate?: () => void;
}

export function GoogleMark({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  labelAr = "المتابعة عبر حساب Google",
  variant = "light",
  compact = false,
  className = "",
}: GoogleSignInButtonProps) {
  const [statusInfo, setStatusInfo] = useState<GoogleStatusResponse | null>(null);
  const [loadingClick, setLoadingClick] = useState(false);
  const [previewBlockedNotice, setPreviewBlockedNotice] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/google-status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data) setStatusInfo(data);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const handleClick = async () => {
    setLoadingClick(true);
    try {
      let currentStatus = statusInfo;
      if (!currentStatus) {
        const res = await fetch("/api/auth/google-status").catch(() => null);
        if (res && res.ok) {
          currentStatus = await res.json();
          setStatusInfo(currentStatus);
        }
      }

      if (currentStatus?.configured) {
        await signIn("google", { callbackUrl: "/auth/google-complete" });
        return;
      }

      // Security remediation (F-001): never open client-side unauthenticated Google preview bypass
      setPreviewBlockedNotice(true);
    } finally {
      setLoadingClick(false);
    }
  };

  const baseStyle =
    variant === "dark"
      ? "bg-white text-dark-slate hover:bg-surface-snow border border-white/20 shadow-md"
      : "bg-white text-dark-slate hover:bg-surface-snow border border-surface-container hover:border-deep-olive shadow-sm";

  const sizeStyle = compact
    ? "px-3.5 py-2 text-xs gap-2"
    : "w-full px-5 py-3.5 text-sm gap-2.5";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loadingClick}
        className={`rounded-full font-bold inline-flex items-center justify-center transition-all cursor-pointer disabled:opacity-60 ${baseStyle} ${sizeStyle} ${className}`}
      >
        <GoogleMark className={compact ? "w-4 h-4 shrink-0" : "w-5 h-5 shrink-0"} />
        <span>{loadingClick ? "جاري التحويل إلى Google..." : labelAr}</span>
      </button>
      {previewBlockedNotice && (
        <p className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-bold text-amber-900">
          تسجيل الدخول عبر Google يتطلب تفعيل مفاتيح OAuth الحقيقية في إعدادات الخادم؛ استخدم الدخول بكود العضوية أو الهاتف مؤقتاً.
        </p>
      )}
    </>
  );
}
