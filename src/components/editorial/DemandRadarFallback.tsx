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
  const { userLocation, resetLocationToAllEgypt, subscribeDemandRadar, facilities, resetSmartFilters } =
    useCaptenly();

  const [fullNameAr, setFullNameAr] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState(userLocation.isSpecified ? userLocation.city : "");
  const [governorate, setGovernorate] = useState(
    userLocation.isSpecified ? userLocation.governorate : ""
  );
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
    <div className="bg-[#F7F9FA] py-8 flex flex-col gap-space-lg">
      <section className="rounded-[24px] bg-gradient-to-br from-[#EAF4F8] via-[#F7F9FA] to-white border border-[#1D6E7D]/15 text-[#0F172A] p-8 md:p-10 shadow-[0_8px_30px_rgba(29,110,125,0.06)] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#1D6E7D]/15 text-[#1D6E7D] font-badge-label text-xs font-bold w-fit shadow-xs">
            <Icon name="radar" className="text-[16px]" />
            <span>رادار التوسع والطلب الميداني</span>
          </div>
          <h2 className="font-hero-headline text-[26px] md:text-[32px] text-[#0F172A] leading-tight">
            {queryText
              ? `لم نجد نتائج مطابقة تماماً لـ «${queryText}» في هذا النطاق بعد`
              : `نطاق ${userLocation.city} قيد التجهيز والتوثيق الميداني قريباً`}
          </h2>
          <p className="font-body-default text-[#475569]">
            بدلاً من عرض بيانات وهمية، نفتح لك التسجيل المباشر في رادار الطلب ليبدأ فريق التوثيق فحص وتفعيل أول 3 أكاديميات وكباتن في مدينتك، أو يمكنك تصفح المنشآت المعلنة في جميع محافظات مصر الآن.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {onResetFilters && (
              <button
                type="button"
                onClick={() => {
                  resetSmartFilters();
                  onResetFilters();
                }}
                className="px-5 py-2.5 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-card-title-sm shadow-sm transition-colors"
              >
                مسح الفلاتر وعرض كل المنشآت ({facilities.length})
              </button>
            )}
            <Link
              href="/explore"
              onClick={() => {
                resetLocationToAllEgypt();
                resetSmartFilters();
              }}
              className="px-5 py-2.5 rounded-full bg-white border border-[#0F172A]/12 text-[#0F172A] font-badge-label hover:border-[#1D6E7D] hover:text-[#1D6E7D] transition-colors"
            >
              تصفح منشآت كل مصر
            </Link>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white text-[#0F172A] rounded-[20px] p-6 border border-[#0F172A]/8 shadow-sm flex flex-col gap-3"
        >
          <h3 className="font-card-title text-[#0F172A]">سجّل طلبك لتوثيق منشأة في حيك</h3>
          {submittedMsg ? (
            <div className="rounded-xl bg-[#EAF4F8] p-4 text-[#1D6E7D] font-bold text-sm flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon name="check_circle" className="text-[20px]" />
                <span>تم تسجيل طلبك في رادار التوسع!</span>
              </div>
              <p className="text-xs font-normal text-[#0F172A]">{submittedMsg}</p>
            </div>
          ) : (
            <>
              <input
                required
                value={fullNameAr}
                onChange={(e) => setFullNameAr(e.target.value)}
                placeholder="الاسم الكامل *"
                className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-sm outline-none border border-[#E2E8F0] focus:border-[#1D6E7D]"
              />
              <input
                required
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الموبايل / واتساب *"
                className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-sm text-right outline-none border border-[#E2E8F0] focus:border-[#1D6E7D]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="المدينة"
                  className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-sm outline-none border border-[#E2E8F0] focus:border-[#1D6E7D]"
                />
                <input
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  placeholder="المحافظة"
                  className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-sm outline-none border border-[#E2E8F0] focus:border-[#1D6E7D]"
                />
              </div>
              <select
                value={targetSport}
                onChange={(e) => setTargetSport(e.target.value as "swimming" | "fitness" | "other")}
                className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-sm outline-none border border-[#E2E8F0] focus:border-[#1D6E7D]"
              >
                <option value="swimming">مسابح ومدارس سباحة</option>
                <option value="other">مسابح أولمبية وتأهيل مائي</option>
              </select>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات إضافية (مثال: مسبح دافئ للأطفال / سيدات)"
                className="rounded-xl bg-[#F7F9FA] px-3.5 py-2.5 text-sm outline-none border border-[#E2E8F0] focus:border-[#1D6E7D]"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-full bg-[#1D6E7D] hover:bg-[#155460] text-white font-card-title-sm transition-colors shadow-xs"
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
