"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

export default function Desktop11() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => router.push("/auth/reset"), 1000);
  };

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-6">
      <div className="max-w-[480px] w-full bg-surface-card rounded-[24px] p-8 shadow-xl flex flex-col gap-5">
        <div className="w-12 h-12 rounded-2xl bg-lime-tint text-deep-olive flex items-center justify-center">
          <Icon name="lock_reset" className="text-[24px]" />
        </div>
        <div>
          <h1 className="font-hero-headline text-[24px] text-dark-slate">استعادة الوصول لحسابك</h1>
          <p className="font-body-compact text-text-muted mt-1">
            أدخل رقم الموبايل المسجل أو كود العضوية لإرسال رمز الاستعادة.
          </p>
        </div>

        {sent ? (
          <div className="p-4 rounded-xl bg-lime-tint text-deep-olive text-sm font-bold">
            ✓ تم إرسال الرمز! جاري توجيهك لصفحة التعيين...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010xxxxxxxx"
              className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm"
            >
              إرسال رمز الاستعادة
            </button>
          </form>
        )}

        <Link href="/auth/login" className="text-xs font-bold text-deep-olive hover:underline text-center">
          العودة لتسجيل الدخول
        </Link>
      </div>
    </div>
  );
}
