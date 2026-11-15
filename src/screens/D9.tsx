"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { GuestAccountGateScreen } from "@/components/auth/GuestAccountGateScreen";
import { getFacilityBookablePackages } from "@/lib/facilityPricing";
import { isMemberAccountRole } from "@/types/captenly";

function Desktop9Inner() {
  const searchParams = useSearchParams();
  const facSlug = searchParams?.get("facility") || "";
  const coachSlug = searchParams?.get("coach") || "";
  const pkgParam = searchParams?.get("pkg") || "";

  const {
    facilities,
    coaches,
    minorAthletes,
    currentPersona,
    createStructuredWhatsappLead,
    placesHydrating,
    isAuthenticated,
  } = useCaptenly();

  const initialCoach = useMemo(
    () => (coachSlug ? coaches.find((c) => c.slug === coachSlug || c.id === coachSlug) : undefined),
    [coaches, coachSlug]
  );

  const [bookingTargetType, setBookingTargetType] = useState<"facility" | "coach">(
    initialCoach ? "coach" : "facility"
  );

  const initialFacility = useMemo(
    () => (facSlug ? facilities.find((f) => f.slug === facSlug || f.id === facSlug) : facilities[0]),
    [facilities, facSlug]
  );

  const [selectedFacId, setSelectedFacId] = useState(initialFacility?.id || "");
  const [selectedCoachId, setSelectedCoachId] = useState(initialCoach?.id || coaches[0]?.id || "");
  const facility = facilities.find((f) => f.id === selectedFacId) || initialFacility;
  const coach = coaches.find((c) => c.id === selectedCoachId) || initialCoach || coaches[0];

  const facilityPackages = useMemo(
    () => (facility ? getFacilityBookablePackages(facility) : []),
    [facility]
  );
  const coachPackages = useMemo(() => {
    if (!coach) return [];
    if (coach.sessionOffers && coach.sessionOffers.length > 0) {
      return coach.sessionOffers.map((o) => ({
        id: o.id,
        nameAr: o.titleAr,
        baseMonthlyEgp: o.priceEgp,
      }));
    }
    return [
      {
        id: "coach-8",
        nameAr: "باقة تدريب خاصة — 8 حصص",
        baseMonthlyEgp: coach.privatePackage8Egp,
      },
      {
        id: "coach-12",
        nameAr: "باقة تدريب خاصة — 12 حصة",
        baseMonthlyEgp: coach.privatePackage12Egp,
      },
    ];
  }, [coach]);

  const activePackages = bookingTargetType === "coach" ? coachPackages : facilityPackages;
  const [selectedPkgId, setSelectedPkgId] = useState(
    pkgParam || activePackages[0]?.id || ""
  );
  const [selectedChildId, setSelectedChildId] = useState(minorAthletes[0]?.id || "");
  const [inquirerName, setInquirerName] = useState(
    currentPersona.role === "guest" ? "" : currentPersona.fullNameAr
  );
  const [inquirerPhone, setInquirerPhone] = useState(currentPersona.phone || "");
  const [athleteAge, setAthleteAge] = useState(
    minorAthletes[0]?.age ? String(minorAthletes[0].age) : "10"
  );
  const [preferredSchedule, setPreferredSchedule] = useState("الفترة المسائية — السبت والاثنين");
  const [generatedLead, setGeneratedLead] = useState<{
    referralCode: string;
    whatsappUrl: string;
  } | null>(null);

  if (!isAuthenticated) {
    return (
      <GuestAccountGateScreen
        titleAr="يرجى إنشاء حساب أو تسجيل الدخول لتجهيز الحجز"
        descriptionAr="لتجهيز طلب الحجز وإرسال كود عضويتك للأكاديمية أو الكابتن مباشرة بدون عمولة، يرجى تسجيل الدخول أولاً."
      />
    );
  }

  if (bookingTargetType === "facility" && !facility) {
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

  if (bookingTargetType === "coach" && !coach) {
    return (
      <div className="screen-root bg-canvas-alabaster font-body-default min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-[24px] bg-surface-card border border-surface-container p-8 text-center flex flex-col items-center gap-4 shadow-sm">
          <Icon name="sports" className="text-[36px] text-deep-olive" />
          <h1 className="font-section-title text-dark-slate">لا يوجد كباتن موثقون متاحون حالياً</h1>
          <Link
            href="/coaches"
            className="px-5 py-2.5 rounded-full bg-dark-slate text-electric-volt text-xs font-bold"
          >
            استعراض الكباتن المعتمدين ←
          </Link>
        </div>
      </div>
    );
  }

  const pkg = activePackages.find((p) => p.id === selectedPkgId) || activePackages[0];
  const selectedChild =
    isMemberAccountRole(currentPersona.role)
      ? minorAthletes.find((m) => m.id === selectedChildId)
      : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetNameAr =
      bookingTargetType === "coach" && coach ? coach.fullNameAr : facility?.nameAr || "";
    const targetId =
      bookingTargetType === "coach" && coach ? coach.id : facility?.id || "";
    const whatsappNumber =
      bookingTargetType === "coach" && coach
        ? coach.whatsappNumber
        : facility?.whatsappNumber;
    const specialtyLabel = `${pkg?.nameAr || "اشتراك شهري"}${
      selectedChild ? ` (للابن/الابنة: ${selectedChild.fullNameAr})` : ""
    }`;

    const res = createStructuredWhatsappLead({
      targetType: bookingTargetType,
      targetId,
      targetNameAr,
      whatsappNumber,
      inquirerNameAr: inquirerName.trim() || currentPersona.fullNameAr,
      inquirerPhone: inquirerPhone.trim(),
      athleteAge: Number(athleteAge) || selectedChild?.age || 10,
      requestedSpecialtyAr: specialtyLabel,
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
          {(facilities.length > 0 && coaches.length > 0) && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBookingTargetType("facility")}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                  bookingTargetType === "facility"
                    ? "bg-dark-slate text-electric-volt"
                    : "bg-surface-snow text-text-muted border border-surface-container"
                }`}
              >
                حجز منشأة / أكاديمية
              </button>
              <button
                type="button"
                onClick={() => setBookingTargetType("coach")}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                  bookingTargetType === "coach"
                    ? "bg-dark-slate text-electric-volt"
                    : "bg-surface-snow text-text-muted border border-surface-container"
                }`}
              >
                حجز باقة تدريب مع كابتن موثق
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bookingTargetType === "coach" && coach ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-dark-slate">الكابتن الموثق</label>
                <select
                  value={coach.id}
                  onChange={(e) => {
                    setSelectedCoachId(e.target.value);
                    setSelectedPkgId("");
                  }}
                  className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
                >
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullNameAr} — {c.city}
                    </option>
                  ))}
                </select>
              </div>
            ) : facility ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-dark-slate">المنشأة / النادي</label>
                <select
                  value={facility.id}
                  onChange={(e) => {
                    setSelectedFacId(e.target.value);
                    setSelectedPkgId("");
                  }}
                  className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nameAr} — {f.city}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-dark-slate">الباقة المطلوبة</label>
              <select
                value={pkg?.id || ""}
                onChange={(e) => setSelectedPkgId(e.target.value)}
                className="rounded-xl bg-surface-snow px-4 py-3 text-sm outline-none border border-surface-container"
              >
                {activePackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} ({p.baseMonthlyEgp} ج.م)
                  </option>
                ))}
              </select>
            </div>

            {isMemberAccountRole(currentPersona.role) && minorAthletes.length > 0 && (
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-deep-olive">
                  الحجز لصالح الابن / الابنة
                </label>
                <select
                  value={selectedChildId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedChildId(id);
                    const ch = minorAthletes.find((m) => m.id === id);
                    if (ch?.age) setAthleteAge(String(ch.age));
                  }}
                  className="rounded-xl bg-lime-tint/30 px-4 py-3 text-sm font-bold outline-none border border-deep-olive/30"
                >
                  {minorAthletes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullNameAr} ({m.age} سنوات
                      {m.currentStarLevel > 0 && m.starTitleAr ? ` — ${m.starTitleAr}` : ""})
                    </option>
                  ))}
                  <option value="">حجز باسمي الشخصي مباشرة</option>
                </select>
              </div>
            )}

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
              {currentPersona.memberCode}
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
