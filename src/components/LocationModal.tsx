"use client";

import React, { useState } from "react";
import { useCaptenly } from "@/context/CaptenlyContext";

export function LocationModal() {
  const {
    userLocation,
    setUserCity,
    requestAutoGeolocation,
    locationModalOpen,
    setLocationModalOpen,
    subscribeDemandRadar,
  } = useCaptenly();

  const [selectedRadius, setSelectedRadius] = useState<number>(5);
  const [waitlistSuccessMsg, setWaitlistSuccessMsg] = useState<string>("");
  const [waitlistPhone, setWaitlistPhone] = useState<string>("");
  const [isLocating, setIsLocating] = useState<boolean>(false);

  if (!locationModalOpen) return null;

  const CITIES_LIST = [
    { name: "المحلة الكبرى", gov: "الغربية", covered: true, distanceKm: 0.8 },
    { name: "طنطا", gov: "الغربية", covered: true, distanceKm: 24.5 },
    { name: "سمنود", gov: "الغربية", covered: true, distanceKm: 6.2 },
    { name: "زفتى", gov: "الغربية", covered: true, distanceKm: 32.0 },
    { name: "كفر الزيات", gov: "الغربية", covered: true, distanceKm: 36.0 },
    { name: "المنصورة", gov: "الدقهلية", covered: true, distanceKm: 28.0 },
    { name: "القاهرة", gov: "القاهرة", covered: false, distanceKm: 115.0 },
    { name: "الجيزة", gov: "الجيزة", covered: false, distanceKm: 120.0 },
    { name: "الإسكندرية", gov: "الإسكندرية", covered: false, distanceKm: 135.0 },
  ];

  const handleCitySelect = (city: string, gov: string) => {
    setUserCity(city, gov);
    setWaitlistSuccessMsg("");
  };

  const handleAutoLocate = async () => {
    setIsLocating(true);
    await requestAutoGeolocation();
    setTimeout(() => {
      setIsLocating(false);
    }, 600);
  };

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistPhone) return;
    const res = subscribeDemandRadar({
      fullNameAr: "زائر مهتم",
      phone: waitlistPhone,
      city: userLocation.city,
      governorate: userLocation.governorate,
      targetSport: "swimming",
    });
    setWaitlistSuccessMsg(res.messageAr);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-carbon/60 backdrop-blur-sm animate-fade-in"
      dir="rtl"
    >
      <div className="relative w-full max-w-lg bg-surface-card rounded-3xl shadow-2xl overflow-hidden border border-border-hairline flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border-hairline flex items-center justify-between bg-surface-snow">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-lime-tint text-deep-olive flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">location_on</span>
            </div>
            <div>
              <h3 className="font-card-title text-card-title text-dark-slate">
                تحديد النطاق والموقع الجغرافي
              </h3>
              <p className="text-micro-caption text-text-muted">
                استكشف الأكاديميات والمسابح الأقرب لخط سيرك
              </p>
            </div>
          </div>
          <button
            onClick={() => setLocationModalOpen(false)}
            className="w-9 h-9 rounded-full bg-surface-card text-text-muted hover:text-dark-slate flex items-center justify-center transition-colors border border-border-hairline"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Auto GPS Button */}
          <button
            onClick={handleAutoLocate}
            disabled={isLocating}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-lime-tint/70 hover:bg-lime-tint text-deep-olive transition-colors border border-athletic-olive/20 font-bold"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[22px]">my_location</span>
              <div className="text-right">
                <span className="block text-body-compact font-bold">
                  {isLocating ? "جاري تحديد موقعك بدقة..." : "تحديد موقعي التلقائي (GPS)"}
                </span>
                <span className="block text-micro-caption text-deep-olive/80">
                  حساب المسافة والترشيح التلقائي لأقرب المنشآت
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>

          {/* Current Selection Status Banner */}
          <div
            className={`p-4 rounded-2xl border ${
              userLocation.isOutsideCoverage
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-surface-snow border-border-hairline text-dark-slate"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${
                  userLocation.isOutsideCoverage ? "text-amber-600" : "text-deep-olive"
                }`}
              >
                {userLocation.isOutsideCoverage ? "info" : "verified"}
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-card-title-sm">
                    {userLocation.city} ({userLocation.governorate})
                  </span>
                  {!userLocation.isOutsideCoverage && (
                    <span className="px-2 py-0.5 rounded-full bg-lime-tint text-deep-olive text-micro-caption font-bold">
                      نطاق مغطى بالكامل ✓
                    </span>
                  )}
                </div>
                <p className="text-micro-caption leading-relaxed text-text-muted">
                  {userLocation.isOutsideCoverage
                    ? "المنصة تغطي حالياً محافظة الغربية (المحلة الكبرى وطنطا ومحيطهما). سنعرض لك أقرب المنشآت المعتمدة المتاحة لدينا في الغربية، ويمكنك الانضمام لقائمة الانتظار لمدينتك."
                    : `المسافة التقديرية لأقرب مسبح معتمد: ${userLocation.distanceKm} كم`}
                </p>
              </div>
            </div>
          </div>

          {/* If Outside Coverage: Demand Radar Waitlist Form */}
          {userLocation.isOutsideCoverage && (
            <div className="p-4 rounded-2xl bg-dark-slate text-surface-card space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-electric-volt text-[18px]">⚡</span>
                <span className="font-bold text-card-title-sm text-electric-volt">
                  رادار الطلب المحلي في {userLocation.city}
                </span>
              </div>
              <p className="text-micro-caption text-surface-snow leading-relaxed">
                سجل رقم هاتفك لتكون أول من يعلم فور افتتاح منشأة أو أكاديمية موثقة في حيك عندما نصل لـ 30 اشتراكاً!
              </p>
              {waitlistSuccessMsg ? (
                <div className="p-3 rounded-xl bg-status-success/20 text-electric-volt text-body-compact border border-status-success/40">
                  {waitlistSuccessMsg}
                </div>
              ) : (
                <form onSubmit={handleWaitlistSubmit} className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="رقم واتساب (01xxxxxxxxx)"
                    value={waitlistPhone}
                    onChange={(e) => setWaitlistPhone(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-surface-card text-dark-slate placeholder:text-text-muted text-body-compact outline-none focus:ring-2 focus:ring-electric-volt"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-electric-volt text-dark-slate font-bold text-body-compact hover:brightness-105 transition-all shrink-0"
                  >
                    انضم للرادار
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Quick Cities Grid */}
          <div>
            <label className="block text-body-compact font-bold text-dark-slate mb-2">
              اختر مدينتك مباشرة:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CITIES_LIST.map((c) => {
                const isSelected = userLocation.city === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => handleCitySelect(c.name, c.gov)}
                    className={`p-2.5 rounded-xl text-center text-body-compact font-cairo transition-all border ${
                      isSelected
                        ? "bg-dark-slate text-electric-volt border-dark-slate font-bold shadow-sm"
                        : "bg-surface-card hover:bg-surface-snow text-dark-slate border-border-hairline"
                    }`}
                  >
                    <span className="block truncate">{c.name}</span>
                    <span className="block text-[10px] text-text-muted truncate mt-0.5">
                      {c.covered ? "✓ متاح الآن" : "قريباً"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Distance Radius Slider (Only if inside covered area) */}
          {!userLocation.isOutsideCoverage && (
            <div className="p-4 rounded-2xl bg-surface-snow border border-border-hairline space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-body-compact font-bold text-dark-slate">
                  نطاق البحث الجغرافي الأقصى:
                </span>
                <span className="text-body-compact font-bold text-deep-olive px-2.5 py-0.5 rounded-full bg-lime-tint">
                  {selectedRadius} كم
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[2, 5, 10, 25].map((rad) => (
                  <button
                    key={rad}
                    type="button"
                    onClick={() => setSelectedRadius(rad)}
                    className={`py-1.5 rounded-lg text-micro-caption font-bold border transition-all ${
                      selectedRadius === rad
                        ? "bg-deep-olive text-white border-deep-olive"
                        : "bg-surface-card text-dark-slate border-border-hairline hover:bg-surface-container-low"
                    }`}
                  >
                    {rad} كم
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border-hairline bg-surface-snow flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleCitySelect("المحلة الكبرى", "الغربية")}
            className="text-micro-caption text-text-muted hover:text-dark-slate underline"
          >
            إعادة الضبط لمدينة المحلة الكبرى
          </button>
          <button
            type="button"
            onClick={() => setLocationModalOpen(false)}
            className="px-6 py-2.5 rounded-full bg-deep-olive text-white font-bold text-body-compact hover:brightness-105 transition-all shadow-sm"
          >
            تطبيق وحفظ النطاق
          </button>
        </div>
      </div>
    </div>
  );
}
