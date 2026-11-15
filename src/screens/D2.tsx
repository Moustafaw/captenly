"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

function Desktop2Inner() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams?.get("q") || searchParams?.get("code") || "");
  const [otpCode, setOtpCode] = useState(searchParams?.get("otp") || "");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (pass1.length < 6) {
      setFeedback("كلمة المرور يجب أن لا تقل عن 6 أحرف.");
      return;
    }
    if (pass1 !== pass2) {
      setFeedback("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          query: query.trim() || undefined,
          otpCode: otpCode.trim() || undefined,
          newPassword: pass1,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setDone(true);
      } else {
        setFeedback(
          data?.messageAr ||
            "تعذر التحقق من رمز الاستعادة. تأكد من إدخال رمز التحقق الصحيح أو سجّل دخولك عبر Google أولاً."
        );
      }
    } catch {
      setFeedback("تعذر الاتصال بالخادم حالياً.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-[480px] w-full bg-surface-card rounded-[24px] p-8 shadow-xl flex flex-col gap-5">
        <div className="w-12 h-12 rounded-2xl bg-lime-tint text-deep-olive flex items-center justify-center">
          <Icon name="lock" className="text-[22px]" />
        </div>
        <div>
          <h1 className="font-hero-headline text-[24px] text-dark-slate">تعيين كلمة مرور جديدة</h1>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            أدخل رمز التحقق المرسل إليك، أو إن كنت مسجلاً عبر Google فسيتم التحديث مباشرة باسم جلستك الموثقة.
          </p>
        </div>

        {done ? (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-lime-tint text-deep-olive text-sm font-bold">
              ✓ تم تشفير وحفظ كلمة المرور الجديدة بنجاح في قاعدة البيانات!
            </div>
            <Link
              href="/auth/login"
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm text-center"
            >
              العودة لتسجيل الدخول
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="البريد الإلكتروني أو الهاتف أو كود العضوية (إن وُجد OTP)"
              className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
            />
            <input
              dir="ltr"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="رمز التحقق OTP (اتركه فارغاً عند التحقق بـ Google)"
              className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container text-left placeholder:text-right"
            />
            <input
              required
              minLength={6}
              type="password"
              value={pass1}
              onChange={(e) => setPass1(e.target.value)}
              placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
              className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
            />
            <input
              required
              minLength={6}
              type="password"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              placeholder="تأكيد كلمة المرور الجديدة"
              className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
            />
            {feedback && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                {feedback}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm mt-1 disabled:opacity-60"
            >
              {loading ? "جاري الحفظ..." : "حفظ كلمة المرور وتفعيل الدخول"}
            </button>

            <div className="pt-2 border-t border-surface-container">
              <GoogleSignInButton labelAr="أو تحقق سريعاً عبر Google ثم عيّن كلمتك" />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Desktop2() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas-alabaster" />}>
      <Desktop2Inner />
    </Suspense>
  );
}
