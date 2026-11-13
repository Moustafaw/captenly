"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { LocationAutocompleteInput } from "@/components/maps/LocationAutocompleteInput";
import { InteractiveLocationMapPicker } from "@/components/maps/InteractiveLocationMapPicker";
import { calculateDistanceKm, EGYPT_CITY_PRESETS } from "@/lib/maps";

export default function Desktop20() {
  const router = useRouter();
  const { userLocation, setUserCity, setUserCoordinates, requestAutoGeolocation, updateSmartFilters } =
    useCaptenly();
  const [customCity, setCustomCity] = useState("");

  const coveredCities = [
    { city: "المحلة الكبرى", gov: "الغربية", badge: "بحث جغرافي نشط ✓" },
    { city: "طنطا", gov: "الغربية", badge: "بحث جغرافي نشط ✓" },
    { city: "القاهرة", gov: "القاهرة", badge: "بحث جغرافي نشط ✓" },
    { city: "الإسكندرية", gov: "الإسكندرية", badge: "بحث جغرافي نشط ✓" },
    { city: "المنصورة", gov: "الدقهلية", badge: "بحث جغرافي نشط ✓" },
    { city: "الجيزة", gov: "الجيزة", badge: "بحث جغرافي نشط ✓" },
  ];

  const handleChooseCity = (city: string, gov = "مصر") => {
    setUserCity(city, gov);
    updateSmartFilters({ city: "الكل", sortBy: "nearest" });
    router.push(`/explore?city=${encodeURIComponent(city)}`);
  };

  const handlePickMapPoint = (lat: number, lng: number) => {
    let nearestPreset = EGYPT_CITY_PRESETS[0];
    let minPresetDist = Number.MAX_SAFE_INTEGER;
    for (const p of EGYPT_CITY_PRESETS) {
      const d = calculateDistanceKm(lat, lng, p.lat, p.lng);
      if (d < minPresetDist) {
        minPresetDist = d;
        nearestPreset = p;
      }
    }
    const nearPreset = minPresetDist <= 28;
    setUserCoordinates({
      lat,
      lng,
      city: nearPreset ? nearestPreset.city : "موقع محدد على الخريطة",
      governorate: nearPreset ? nearestPreset.governorate : "مصر",
    });
    updateSmartFilters({ city: "الكل", sortBy: "nearest" });
  };

  return (
    <div className="screen-root bg-canvas-alabaster font-body-default text-body-default text-on-surface antialiased min-h-screen pt-6 pb-16">
      <div className="max-w-[960px] mx-auto px-margin lg:px-margin-desktop flex flex-col gap-space-lg">
        <section className="rounded-[20px] bg-dark-slate text-surface-card p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="px-3 py-1 rounded-full bg-deep-carbon text-electric-volt text-xs font-bold w-fit">
              تحديد النطاق الجغرافي
            </span>
            <h1 className="font-hero-headline text-[28px] md:text-[32px]">
              أين تبحث عن نادٍ أو كابتن قريب منك؟
            </h1>
            <p className="font-body-compact text-surface-container-high">
              موقعك الحالي المختار: {userLocation.city}، {userLocation.governorate}
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await requestAutoGeolocation();
              router.push("/explore");
            }}
            className="px-5 py-3 rounded-full bg-electric-volt text-dark-slate font-card-title-sm flex items-center gap-2 shrink-0 hover:brightness-105"
          >
            <Icon name="near_me" className="text-[18px]" />
            <span>تحديد موقعي بالـ GPS تلقائياً</span>
          </button>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coveredCities.map((item) => (
            <button
              key={item.city}
              type="button"
              onClick={() => handleChooseCity(item.city, item.gov)}
              className={`text-right rounded-2xl p-6 shadow-sm border transition-all flex items-center justify-between ${
                userLocation.city.includes(item.city)
                  ? "bg-lime-tint/60 border-deep-olive"
                  : "bg-surface-card border-surface-container hover:border-deep-olive"
              }`}
            >
              <div>
                <div className="font-card-title text-dark-slate">{item.city}</div>
                <div className="text-xs text-text-muted mt-1">{item.gov}</div>
              </div>
              <div className="px-3 py-1 rounded-full bg-surface-snow text-deep-olive text-xs font-bold">
                {item.badge}
              </div>
            </button>
          ))}
        </section>

        <section className="bg-surface-card rounded-2xl p-6 shadow-sm border border-surface-container flex flex-col gap-4">
          <h2 className="font-card-title text-dark-slate">ابحث عن منطقتك أو حدّد موقعك على الخريطة</h2>
          <LocationAutocompleteInput
            onSelectLocation={(loc) => {
              setUserCoordinates({
                city: loc.city,
                governorate: loc.governorate,
                lat: loc.lat,
                lng: loc.lng,
              });
              updateSmartFilters({ sortBy: "nearest", city: "الكل" });
              router.push("/explore");
            }}
          />
          <InteractiveLocationMapPicker
            lat={userLocation.lat}
            lng={userLocation.lng}
            cityLabel={userLocation.city}
            onPickCoordinates={handlePickMapPoint}
            heightClass="h-60"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => router.push("/explore")}
              className="px-5 py-2.5 rounded-full bg-deep-olive text-white text-xs font-bold"
            >
              اعتماد النطاق واستكشاف المسابح ←
            </button>
          </div>
        </section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!customCity.trim()) return;
            setUserCity(customCity.trim(), "مصر");
            router.push("/explore?fallback=1");
          }}
          className="bg-surface-card rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center gap-3"
        >
          <input
            value={customCity}
            onChange={(e) => setCustomCity(e.target.value)}
            placeholder="تعيين مدينة أخرى (مثال: المنصورة، القاهرة، الإسكندرية)..."
            className="flex-1 w-full rounded-full bg-surface-snow px-5 py-3 text-sm outline-none border border-surface-container"
          />
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-dark-slate text-electric-volt font-badge-label shrink-0"
          >
            ابحث أو سجّل طلب توسع
          </button>
        </form>
      </div>
    </div>
  );
}
