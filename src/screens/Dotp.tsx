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

  const [digits, setDigits] = useState(["1", "2", "3", "4", "5", "6"]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDigit = (idx: number, val: string) => {
    const d = val.replace(/\D/g, "").slice(-1);
    setDigits((prev) => prev.map((x, i) => (i === idx ? d : x)));
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (digits.join("").length < 4) {
      setErrorMsg("يرجى إدخال رمز التحقق المكون من 6 أرقام.");
      return;
    }
    if (roleParam === "coach") {
      router.push("/claim?mode=coach");
    } else if (roleParam === "facility_manager") {
      router.push("/claim");
    } else {
      router.push("/auth/onboarding");
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
            أدخل رمز التحقق المرسل لرقمك ({currentPersona.phone || "010xxxxxxxx"}) — الكود التجريبي الجاهز: 123456
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
