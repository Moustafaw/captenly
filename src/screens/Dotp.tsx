"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

function DotpInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentPersona } = useCaptenly();

  const codeParam = searchParams?.get("code") || currentPersona.memberCode || "";
  const roleParam = searchParams?.get("role") || currentPersona.role;
  const flowParam = searchParams?.get("flow") || "register";

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleDigit = (idx: number, val: string) => {
    const d = val.replace(/\D/g, "").slice(-1);
    setDigits((prev) => prev.map((x, i) => (i === idx ? d : x)));
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifying) return;
    const otpCode = digits.join("");
    if (otpCode.length < 6) {
      setErrorMsg("يرجى إدخال رمز التحقق المكون من 6 أرقام المرسل إليك، أو الانتقال لتسجيل الدخول بكلمة المرور.");
      return;
    }

    const queryTarget = (searchParams?.get("q") || codeParam || "").trim();
    if (!queryTarget) {
      setErrorMsg("يرجى تحديد البريد الإلكتروني أو رقم الموبايل أو كود العضوية المرتبط بالتحقق.");
      return;
    }

    setVerifying(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/member-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_otp",
          query: queryTarget,
          otpCode,
          clearOtp: flowParam === "register" || flowParam === "login",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.messageAr || "رمز التحقق غير صحيح أو منتهي الصلاحية.");
        return;
      }

      if (flowParam === "register" || flowParam === "login") {
        if (roleParam === "coach") {
          router.push(currentPersona.linkedCoachId ? "/dashboard/coach" : "/claim?mode=coach");
        } else if (roleParam === "facility_manager") {
          router.push(currentPersona.linkedFacilityId ? "/dashboard/facility" : "/claim");
        } else {
          router.push("/dashboard/athlete");
        }
        return;
      }

      router.push(
        `/auth/reset?otp=${encodeURIComponent(otpCode)}&code=${encodeURIComponent(
          data.profile?.memberCode || codeParam
        )}&q=${encodeURIComponent(queryTarget)}`
      );
    } catch {
      setErrorMsg("تعذر الاتصال بالخادم للتحقق من الرمز.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-6">
      <div className="max-w-[520px] w-full bg-surface-card rounded-[24px] p-8 shadow-xl flex flex-col gap-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-lime-tint text-deep-olive flex items-center justify-center mx-auto">
          <Icon name="verified" className="text-[28px]" />
        </div>

        <div>
          <h1 className="font-hero-headline text-[24px] text-dark-slate">
            تأكيد رقم الهاتف وتفعيل كود العضوية
          </h1>
          <p className="font-body-compact text-text-muted mt-1">
            أدخل رمز التحقق المكون من 6 أرقام المرسل إليك ({currentPersona.phone || "بريدك / هاتفك المسجل"}).
          </p>
        </div>

        <div className="rounded-xl bg-surface-snow p-3 text-xs font-bold text-deep-olive">
          كود عضويتك المخصص: <span className="font-mono text-sm">{codeParam}</span>
        </div>

        <form onSubmit={handleConfirm} className="flex flex-col gap-5">
          <div className="flex items-center justify-center gap-2" dir="ltr">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigit(idx, e.target.value)}
                className="w-12 h-14 text-center text-xl font-black rounded-xl bg-surface-snow border border-surface-container focus:border-deep-olive outline-none text-dark-slate"
              />
            ))}
          </div>

          {errorMsg && <div className="text-xs font-bold text-status-danger">{errorMsg}</div>}

          <button
            type="submit"
            className="w-full py-3.5 rounded-full bg-dark-slate text-electric-volt font-card-title shadow-md hover:opacity-95"
          >
            تأكيد الرمز والمتابعة ←
          </button>
        </form>

        <Link href="/auth/login" className="text-xs text-text-muted hover:text-dark-slate">
          العودة لتعديل رقم الهاتف
        </Link>
      </div>
    </div>
  );
}

export default function Dotp() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas-alabaster" />}>
      <DotpInner />
    </Suspense>
  );
}
