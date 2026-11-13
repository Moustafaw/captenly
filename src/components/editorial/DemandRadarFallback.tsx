"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

interface DemandRadarFallbackProps {
  queryText?: string;
  onResetFilters?: () => void;
}

export function DemandRadarFallback({
  queryText,
  onResetFilters,
}: DemandRadarFallbackProps) {
  const { userLocation, setUserCity, subscribeDemandRadar, facilities, resetSmartFilters } =
    useCaptenly();

  const [fullNameAr, setFullNameAr] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState(userLocation.city || "المنصورة");
  const [governorate, setGovernorate] = useState(userLocation.governorate || "الدقهلية");
  const [targetSport, setTargetSport] = useState<"swimming" | "fitness" | "other">("swimming");
  const [notes, setNotes] = useState("");
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = subscribeDemandRadar({
      fullNameAr: fullNameAr.trim(),
      phone: phone.trim(),
      city: city.trim(),
      governorate: governorate.trim(),
      targetSport,
      notes: notes.trim() || undefined,
    });
    if (res.ok) setSubmittedMsg(res.messageAr);
  };

  return (
    <div className="bg-canvas-alabaster py-8 flex flex-col gap-space-lg">
      <section className="rounded-[20px] bg-dark-slate text-surface-card p-8 md:p-10 shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-deep-carbon text-electric-volt font-badge-label text-xs w-fit">
            <Icon name="radar" className="text-[16px]" />
            <span>رادار التوسع والطلب الميداني</span>
          </div>
          <h2 className="font-hero-headline text-[26px] md:text-[32px] leading-tight">
            {queryText
              ? `لم نجد نتائج مطابقة تماماً لـ «${queryText}» في هذا النطاق بعد`
              : `نطاق ${userLocation.city} قيد التجهيز والتوثيق الميداني قريباً`}
          </h2>
          <p className="font-body-default text-surface-container-high">
            بدلاً من عرض بيانات وهمية، نفتح لك التسجيل المباشر في رادار الطلب ليبدأ فريق التوثيق فحص وتفعيل أول 3 أكاديميات وكباتن في مدينتك، أو يمكنك تصفح المنشآت المعلنة في المحلة وطنطا الآن.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {onResetFilters && (
              <button
                type="button"
                onClick={() => {
                  resetSmartFilters();
                  onResetFilters();
                }}
                className="px-5 py-2.5 rounded-full bg-electric-volt text-dark-slate font-card-title-sm shadow-sm"
              >
                مسح الفلاتر وعرض كل المنشآت ({facilities.length})
              </button>
            )}
            <Link
              href="/explore"
              onClick={() => {
                setUserCity("المحلة الكبرى", "الغربية");
                resetSmartFilters();
              }}
              className="px-5 py-2.5 rounded-full bg-white/10 text-surface-card font-badge-label hover:bg-white/20"
            >
              تصفح منشآت المحلة الكبرى والغربية
            </Link>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-surface-card text-dark-slate rounded-2xl p-6 shadow-md flex flex-col gap-3"
        >
          <h3 className="font-card-title text-dark-slate">سجّل طلبك لتوثيق منشأة في حيك</h3>
          {submittedMsg ? (
            <div className="rounded-xl bg-lime-tint p-4 text-deep-olive font-bold text-sm flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon name="check_circle" className="text-[20px]" />
                <span>تم تسجيل طلبك في رادار التوسع!</span>
              </div>
              <p className="text-xs font-normal text-dark-slate">{submittedMsg}</p>
            </div>
          ) : (
            <>
              <input
                required
                value={fullNameAr}
                onChange={(e) => setFullNameAr(e.target.value)}
                placeholder="الاسم الكامل *"
                className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm outline-none border border-surface-container focus:border-deep-olive"
              />
              <input
                required
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الموبايل / واتساب *"
                className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm text-right outline-none border border-surface-container focus:border-deep-olive"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="المدينة"
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm outline-none border border-surface-container"
                />
                <input
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  placeholder="المحافظة"
                  className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm outline-none border border-surface-container"
                />
              </div>
              <select
                value={targetSport}
                onChange={(e) => setTargetSport(e.target.value as "swimming" | "fitness" | "other")}
                className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm outline-none border border-surface-container"
              >
                <option value="swimming">مسابح ومدارس سباحة</option>
                <option value="other">مسابح أولمبية وتأهيل مائي</option>
              </select>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات إضافية (مثال: مسبح دافئ للأطفال / سيدات)"
                className="rounded-xl bg-surface-snow px-3.5 py-2.5 text-sm outline-none border border-surface-container"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-full bg-dark-slate text-electric-volt font-card-title-sm hover:opacity-95"
              >
                إرسال الطلب وإبلاغي فور التفعيل
              </button>
            </>
          )}
        </form>
      </section>
    </div>
  );
}
