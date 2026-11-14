"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

interface GoogleStatusResponse {
  configured: boolean;
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

function makeGoogleAvatarDataUrl(letter: string, bgHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="${bgHex}"/><text x="80" y="98" text-anchor="middle" font-family="Cairo, Arial, sans-serif" font-size="68" font-weight="800" fill="#ffffff">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PREVIEW_ACCOUNTS = [
  {
    name: "مصطفى عزت",
    email: "mostafa.ezzat@gmail.com",
    avatar: makeGoogleAvatarDataUrl("م", "#166534"),
    note: "حساب جديد — يجلب الاسم والصورة ويفتح اختيار الدور",
  },
  {
    name: "سلمى عبد الرحمن",
    email: "salma.swimmer@gmail.com",
    avatar: makeGoogleAvatarDataUrl("س", "#1D4ED8"),
    note: "حساب جديد — للتجربة كولية أمر أو سبّاحة",
  },
];

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
  onSuccessNavigate,
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const { restoreOrLoginWithGoogle } = useCaptenly();

  const [statusInfo, setStatusInfo] = useState<GoogleStatusResponse | null>(null);
  const [loadingClick, setLoadingClick] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  const [customName, setCustomName] = useState("مصطفى عزت");
  const [customEmail, setCustomEmail] = useState("mostafa.ezzat@gmail.com");
  const [selectedAvatar, setSelectedAvatar] = useState(PREVIEW_ACCOUNTS[0].avatar);

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

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const callbackUri = `${origin}${statusInfo?.callbackPath || "/api/auth/callback/google"}`;

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

      setPreviewOpen(true);
    } finally {
      setLoadingClick(false);
    }
  };

  const handlePreviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = customName.trim();
    const cleanEmail = customEmail.trim();
    if (!cleanName || !cleanEmail.includes("@")) return;

    const firstChar = cleanName.charAt(0) || "ك";
    const avatarUrl = selectedAvatar || makeGoogleAvatarDataUrl(firstChar, "#166534");

    setLoadingClick(true);
    try {
      const res = await restoreOrLoginWithGoogle({
        name: cleanName,
        email: cleanEmail,
        image: avatarUrl,
        isSimulatedPreview: true,
      });

      const targetPath =
        res.isNewUser || res.persona.needsOnboarding
          ? "/auth/onboarding?source=google&preview=1"
          : res.persona.role === "coach"
            ? "/dashboard/coach"
            : res.persona.role === "facility_manager"
              ? "/dashboard/facility"
              : "/dashboard/ledger";

      setPreviewOpen(false);
      if (onSuccessNavigate) onSuccessNavigate();
      router.push(targetPath);
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          const expectedPath = targetPath.split("?")[0];
          if (window.location.pathname !== expectedPath) {
            window.location.assign(targetPath);
          }
        }, 200);
      }
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
        {statusInfo && !statusInfo.configured && !compact && (
          <span className="mr-auto px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
            معاينة ذكية
          </span>
        )}
      </button>

      {previewOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-google-modal="true"
            className="fixed inset-0 z-[100] bg-dark-slate/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="google-preview-title"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-surface-card rounded-[24px] p-6 shadow-2xl border border-surface-container flex flex-col gap-4"
            >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-surface-snow border border-surface-container flex items-center justify-center shrink-0">
                  <GoogleMark className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="google-preview-title" className="font-card-title text-dark-slate text-base">
                    تسجيل الدخول بحساب Google
                  </h2>
                  <p className="text-[11px] text-text-muted">
                    Auth.js v5 جاهز — يعمل حالياً بوضع المعاينة الذكي لحين وضع مفاتيح .env.local
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                aria-label="إغلاق النافذة"
                className="w-8 h-8 rounded-full bg-surface-snow text-dark-slate hover:bg-surface-container flex items-center justify-center shrink-0"
              >
                <Icon name="close" className="text-[17px]" />
              </button>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900 leading-relaxed">
              <strong>ملاحظة تقنية:</strong> لم يتم العثور على مفاتيح{" "}
              <span className="font-mono font-bold">
                {(statusInfo?.missingKeys || ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AUTH_SECRET"]).join(" , ")}
              </span>{" "}
              في ملف <span className="font-mono">.env.local</span> بعد. يمكنك الآن اختيار أو كتابة حساب Google لمعاينة المسار الكامل (توليد الكود + اختيار الدور + الهاتف الاختياري)، أو تفعيل الربط الحقيقي بالخطوات بالأسفل.
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-dark-slate">اختر حساب Google جاهز للمعاينة:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PREVIEW_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setCustomName(acc.name);
                      setCustomEmail(acc.email);
                      setSelectedAvatar(acc.avatar);
                    }}
                    className={`p-2.5 rounded-xl border text-right flex items-center gap-2.5 transition-colors ${
                      customEmail === acc.email
                        ? "bg-lime-tint/60 border-deep-olive"
                        : "bg-surface-snow border-surface-container hover:border-deep-olive/50"
                    }`}
                  >
                    <img
                      src={acc.avatar}
                      alt={acc.name}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-dark-slate truncate">{acc.name}</div>
                      <div className="text-[10px] text-text-muted font-mono truncate" dir="ltr">
                        {acc.email}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handlePreviewSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">الاسم القادم من Google *</label>
                  <input
                    required
                    value={customName}
                    onChange={(e) => {
                      setCustomName(e.target.value);
                      const firstChar = e.target.value.trim().charAt(0) || "م";
                      setSelectedAvatar(makeGoogleAvatarDataUrl(firstChar, "#166534"));
                    }}
                    className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm outline-none border border-surface-container focus:border-deep-olive"
                    placeholder="اكتب اسمك"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-dark-slate">بريد Gmail *</label>
                  <input
                    required
                    type="email"
                    dir="ltr"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm outline-none border border-surface-container focus:border-deep-olive text-left"
                    placeholder="name@gmail.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title text-sm shadow-md hover:opacity-95 flex items-center justify-center gap-2"
              >
                <GoogleMark className="w-4 h-4" />
                <span>اختبار تسجيل الدخول عبر Google ←</span>
              </button>
            </form>

            <div className="border-t border-surface-container pt-3">
              <button
                type="button"
                onClick={() => setShowSetupGuide((v) => !v)}
                className="text-xs font-bold text-deep-olive hover:underline flex items-center gap-1"
              >
                <Icon name="tune" className="text-[15px]" />
                <span>
                  {showSetupGuide
                    ? "إخفاء خطوات التفعيل الحقيقي في Google Cloud"
                    : "كيفية تفعيل التحويل الحقيقي لـ accounts.google.com؟"}
                </span>
              </button>

              {showSetupGuide && (
                <div className="mt-2.5 rounded-xl bg-surface-snow p-3.5 text-[11px] text-dark-slate space-y-2 border border-surface-container">
                  <div>
                    1. أنشئ ملف <span className="font-mono font-bold">.env.local</span> بجوار{" "}
                    <span className="font-mono">.env.example</span> وأضف:
                  </div>
                  <pre
                    dir="ltr"
                    className="bg-dark-slate text-electric-volt p-2.5 rounded-lg font-mono text-[10px] overflow-x-auto"
                  >{`AUTH_SECRET="your-random-secret"\nGOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"\nGOOGLE_CLIENT_SECRET="GOCSPX-xxx"`}</pre>
                  <div>2. في Google Cloud Console أضف رابط العودة التالي (Authorized Redirect URI):</div>
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-surface-container">
                    <span dir="ltr" className="font-mono text-[10px] truncate flex-1 text-deep-olive">
                      {callbackUri}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(callbackUri).catch(() => undefined);
                        setCopiedUri(true);
                        setTimeout(() => setCopiedUri(false), 1800);
                      }}
                      className="px-2 py-0.5 rounded bg-dark-slate text-white text-[10px] font-bold shrink-0"
                    >
                      {copiedUri ? "تم النسخ" : "نسخ"}
                    </button>
                  </div>
                  <div>3. أعد تشغيل السيرفر وسيتحول هذا الزر تلقائياً لتسجيل الدخول الحقيقي مع Google.</div>
                </div>
              )}
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
