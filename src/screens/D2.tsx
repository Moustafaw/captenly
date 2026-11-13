"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function Desktop2() {
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pass1.length >= 4 && pass1 === pass2) setDone(true);
  };

  return (
    <div className="screen-root min-h-screen bg-canvas-alabaster flex items-center justify-center p-6">
      <div className="max-w-[480px] w-full bg-surface-card rounded-[24px] p-8 shadow-xl flex flex-col gap-5">
        <div className="w-12 h-12 rounded-2xl bg-lime-tint text-deep-olive flex items-center justify-center">
          <Icon name="lock" className="text-[22px]" />
        </div>
        <h1 className="font-hero-headline text-[24px] text-dark-slate">تعيين رمز مرور جديد</h1>

        {done ? (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-lime-tint text-deep-olive text-sm font-bold">
              ✓ تم تحديث رمز المرور بنجاح!
            </div>
            <Link
              href="/auth/login"
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm text-center"
            >
              تسجيل الدخول الآن
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              required
              type="password"
              value={pass1}
              onChange={(e) => setPass1(e.target.value)}
              placeholder="الرمز الجديد (4 أرقام أو أحرف على الأقل)"
              className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
            />
            <input
              required
              type="password"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              placeholder="تأكيد الرمز الجديد"
              className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm mt-1"
            >
              حفظ الرمز الجديد
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
