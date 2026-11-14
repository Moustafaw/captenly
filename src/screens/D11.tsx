"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

export default function Desktop11() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string; hasGoogle?: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_otp", query: clean }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setStatusMsg({ ok: true, text: data.messageAr || "تم إرسال رمز الاستعادة بنجاح." });
        setTimeout(() => router.push(`/auth/reset?q=${encodeURIComponent(clean)}`), 900);
      } else {
        setStatusMsg({
          ok: false,
          hasGoogle: Boolean(data?.hasGoogleOption),
          text:
            data?.messageAr ||
            "تعذر إرسال رمز الاستعادة. تأكد من صحة البريد الإلكتروني أو رقم الهاتف المسجل.",
        });
      }
    } catch {
      setStatusMsg({ ok: false, text: "تعذر الاتصال بالخادم حالياً." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-[480px] w-full bg-surface-card rounded-[24px] p-8 shadow-xl flex flex-col gap-5">
        <div className="w-12 h-12 rounded-2xl bg-lime-tint text-deep-olive flex items-center justify-center">
          <Icon name="lock_reset" className="text-[24px]" />
        </div>
        <div>
          <h1 className="font-hero-headline text-[24px] text-dark-slate">استعادة الوصول لحسابك</h1>
          <p className="font-body-compact text-text-muted mt-1">
            أدخل البريد الإلكتروني أو رقم الموبايل المسجل لإرسال رمز التحقق وتعيين كلمة مرور جديدة.
          </p>
        </div>

        {statusMsg && (
          <div
            className={`p-4 rounded-xl text-xs sm:text-sm font-bold leading-relaxed ${
              statusMsg.ok
                ? "bg-lime-tint text-deep-olive"
                : "bg-amber-50 border border-amber-200 text-amber-900"
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {!statusMsg?.ok && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="البريد الإلكتروني أو رقم الموبايل (010xxxxxxxx)"
              className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm disabled:opacity-60"
            >
              {loading ? "جاري التحقق والإرسال..." : "إرسال رمز الاستعادة"}
            </button>
          </form>
        )}

        <div className="flex items-center justify-between text-xs font-bold pt-1">
          <Link href="/auth/login" className="text-deep-olive hover:underline">
            العودة لتسجيل الدخول
          </Link>
          <Link href="/auth/reset" className="text-text-muted hover:text-dark-slate">
            لديّ رمز تحقق / تسجيل عبر Google ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
