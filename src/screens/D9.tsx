"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";

function Desktop9Inner() {
  const searchParams = useSearchParams();
  const facSlug = searchParams?.get("facility") || "";
  const pkgParam = searchParams?.get("pkg") || "";

  const { facilities, currentPersona, createStructuredWhatsappLead, placesHydrating } = useCaptenly();

  const initialFacility = useMemo(
    () => (facSlug ? facilities.find((f) => f.slug === facSlug || f.id === facSlug) : facilities[0]),
    [facilities, facSlug]
  );

  const [selectedFacId, setSelectedFacId] = useState(initialFacility?.id || "");
  const facility = facilities.find((f) => f.id === selectedFacId) || initialFacility;

  const [selectedPkgId, setSelectedPkgId] = useState(
    pkgParam || facility?.pricePackages[0]?.id || ""
  );
  const [inquirerName, setInquirerName] = useState(
    currentPersona.role === "guest" ? "" : currentPersona.fullNameAr
  );
  const [inquirerPhone, setInquirerPhone] = useState(currentPersona.phone || "");
  const [athleteAge, setAthleteAge] = useState("10");
  const [preferredSchedule, setPreferredSchedule] = useState("الفترة المسائية — السبت والاثنين");
  const [generatedLead, setGeneratedLead] = useState<{
    referralCode: string;
    whatsappUrl: string;
  } | null>(null);

  if (!facility) {
    return (
      <div className="screen-root bg-canvas-alabaster font-body-default min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-[24px] bg-surface-card border border-surface-container p-8 text-center flex flex-col items-center gap-4 shadow-sm">
          <Icon name="pool" className="text-[36px] text-deep-olive" />
          <h1 className="font-section-title text-dark-slate">
            {placesHydrating ? "جاري تحميل المنشآت..." : "لا توجد منشآت متاحة للحجز المباشر حالياً"}
          </h1>
          <p className="text-xs text-text-muted leading-relaxed">
            استكشف المسابح القريبة منك أو انتظر تفعيل المنشآت الموثقة في منطقتك للبدء في طلبات التواصل المباشر.
          </p>
          <Link
            href="/explore"
            className="px-5 py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
          >
            استكشاف المسابح القريبة ←
          </Link>
        </div>
      </div>
    );
  }

  const pkg =
    facility.pricePackages.find((p) => p.id === selectedPkgId) || facility.pricePackages[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createStructuredWhatsappLead({
      targetType: "facility",
      targetId: facility.id,
      targetNameAr: facility.nameAr,
      whatsappNumber: facility.whatsappNumber,
      inquirerNameAr: inquirerName.trim() || currentPersona.fullNameAr,
      inquirerPhone: inquirerPhone.trim(),
      athleteAge: Number(athleteAge) || 10,
      requestedSpecialtyAr: pkg?.nameAr || facility.specialtiesAr[0] || "اشتراك شهري",
      preferredScheduleAr: preferredSchedule,
    });
    setGeneratedLead({ referralCode: res.referralCode, whatsappUrl: res.whatsappUrl });
    if (res.whatsappUrl) {
      window.open(res.whatsappUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[960px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        <div>
          <h1 className="font-hero-headline text-[28px] text-dark-slate">
            تجهيز طلب الحجز والتواصل المهيكل (0% عمولة)
          </h1>
          <p className="font-body-compact text-text-muted mt-1">
            رسالة واتساب جاهزة تتضمن تفاصيل الباقة وكود عضويتك لتسهيل تفعيل دفتر الحصص مع المكان مباشرة
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-card rounded-[20px] p-6 md:p-8 shadow-sm border border-surface-container flex flex-col gap-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-dark-slate">المنشأة / النادي</label>
              <select
                value={facility.id}
                onChange={(e) => setSelectedFacId(e.target.value)}
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nameAr} — {f.city}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-dark-slate">الباقة المطلوبة</label>
              <select
                value={pkg?.id || ""}
                onChange={(e) => setSelectedPkgId(e.target.value)}
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
              >
                {facility.pricePackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} ({p.baseMonthlyEgp} ج.م)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-dark-slate">الاسم *</label>
              <input
                required
                value={inquirerName}
                onChange={(e) => setInquirerName(e.target.value)}
                placeholder="الاسم الكامل"
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-dark-slate">رقم الموبايل *</label>
              <input
                required
                type="tel"
                dir="ltr"
                value={inquirerPhone}
                onChange={(e) => setInquirerPhone(e.target.value)}
                placeholder="010xxxxxxxx"
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm text-right outline-none border border-surface-container"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-dark-slate">عمر المتدرب</label>
              <input
                type="number"
                min={3}
                max={80}
                value={athleteAge}
                onChange={(e) => setAthleteAge(e.target.value)}
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-dark-slate">المواعيد المفضلة</label>
              <input
                value={preferredSchedule}
                onChange={(e) => setPreferredSchedule(e.target.value)}
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
              />
            </div>
          </div>

          <div className="rounded-xl bg-surface-snow p-4 text-xs text-text-muted flex items-center justify-between flex-wrap gap-2">
            <span>سيُدرج كود عضويتك تلقائياً في الرسالة لتسهيل تفعيل دفتر الـ QR:</span>
            <span className="font-mono font-bold text-deep-olive">
              {currentPersona.memberCode || "CAP-M-5190"}
            </span>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-full bg-action-whatsapp text-white font-card-title flex items-center justify-center gap-2 shadow-md hover:opacity-95"
          >
            <Icon name="chat" className="text-[20px]" />
            <span>فتح الواتساب وإرسال طلب الحجز فوراً</span>
          </button>

          {generatedLead && (
            <div className="rounded-xl bg-lime-tint/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-deep-olive">
              <span>✓ تم تسجيل طلبك برقم إحالة {generatedLead.referralCode}</span>
              <div className="flex items-center gap-3">
                <a
                  href={generatedLead.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  إعادة فتح واتساب
                </a>
                <Link href="/dashboard/ledger" className="underline text-dark-slate">
                  الانتقال لدفتر الحصص ←
                </Link>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function Desktop9() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas-alabaster" />}>
      <Desktop9Inner />
    </Suspense>
  );
}
