"use client";

import React, { useState } from "react";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { LocationAutocompleteInput } from "@/components/maps/LocationAutocompleteInput";
import { InteractiveLocationMapPicker } from "@/components/maps/InteractiveLocationMapPicker";
import { calculateDistanceKm, EGYPT_CITY_PRESETS } from "@/lib/maps";

export function LocationModal() {
  const {
    userLocation,
    setUserCity,
    setUserCoordinates,
    requestAutoGeolocation,
    locationModalOpen,
    setLocationModalOpen,
    updateSmartFilters,
  } = useCaptenly();

  const [selectedRadius, setSelectedRadius] = useState<number>(10);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  if (!locationModalOpen) return null;

  const CITIES_LIST = [
    { name: "المحلة الكبرى", gov: "الغربية" },
    { name: "طنطا", gov: "الغربية" },
    { name: "المنصورة", gov: "الدقهلية" },
    { name: "القاهرة", gov: "القاهرة" },
    { name: "الجيزة", gov: "الجيزة" },
    { name: "الإسكندرية", gov: "الإسكندرية" },
    { name: "الزقازيق", gov: "الشرقية" },
    { name: "شبين الكوم", gov: "المنوفية" },
    { name: "دمياط", gov: "دمياط" },
  ];

  const handleCitySelect = (city: string, gov: string) => {
    setUserCity(city, gov);
    updateSmartFilters({ city: "الكل", sortBy: "nearest" });
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

  const handleAutoLocate = async () => {
    setIsLocating(true);
    await requestAutoGeolocation();
    updateSmartFilters({ city: "الكل", sortBy: "nearest" });
    setTimeout(() => {
      setIsLocating(false);
    }, 600);
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
              <Icon name="location_on" className="text-[20px]" />
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
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Smart Google Places / City Search */}
          <LocationAutocompleteInput
            initialValue=""
            onSelectLocation={(loc) => {
              setUserCoordinates({
                city: loc.city,
                governorate: loc.governorate,
                lat: loc.lat,
                lng: loc.lng,
              });
              updateSmartFilters({ city: "الكل", sortBy: "nearest" });
            }}
          />

          {/* Auto GPS Button */}
          <button
            onClick={handleAutoLocate}
            disabled={isLocating}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-lime-tint/70 hover:bg-lime-tint text-deep-olive transition-colors border border-athletic-olive/20 font-bold"
          >
            <div className="flex items-center gap-2.5">
              <Icon name="near_me" className="text-[20px]" />
              <div className="text-right">
                <span className="block text-body-compact font-bold">
                  {isLocating ? "جاري تحديد موقعك بدقة..." : "تحديد موقعي التلقائي (GPS)"}
                </span>
                <span className="block text-micro-caption text-deep-olive/80">
                  حساب المسافة والترشيح التلقائي لأقرب المسابح والأكاديميات
                </span>
              </div>
            </div>
            <Icon name="chevron_left" className="text-[18px]" />
          </button>

          {/* Interactive Google Map Pin Picker */}
          <InteractiveLocationMapPicker
            lat={userLocation.lat}
            lng={userLocation.lng}
            cityLabel={userLocation.city}
            onPickCoordinates={handlePickMapPoint}
            heightClass="h-44"
          />

          {/* Current Selection Status Banner */}
          <div className="p-4 rounded-2xl border bg-surface-snow border-border-hairline text-dark-slate">
            <div className="flex items-start gap-3">
              <Icon name="verified" className="text-[20px] shrink-0 mt-0.5 text-deep-olive" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-card-title-sm">
                    {userLocation.city} ({userLocation.governorate})
                  </span>
                  <span className="text-deep-olive text-micro-caption font-extrabold">
                    • بحث جغرافي نشط ✓
                  </span>
                </div>
                <p className="text-micro-caption leading-relaxed text-text-muted">
                  يتم ترتيب المسابح والأكاديميات المسجلة ونتائج خرائط Google تلقائياً حسب الأقرب لإحداثياتك الحالية
                  {userLocation.distanceKm > 0 ? ` (أقرب منشأة: ${userLocation.distanceKm} كم)` : ""}.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Cities Grid */}
          <div>
            <label className="block text-body-compact font-bold text-dark-slate mb-2">
              اختر مدينتك مباشرة:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CITIES_LIST.map((c) => {
                const isSelected = userLocation.city.includes(c.name);
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
                    <span className="block text-[10px] opacity-75 truncate mt-0.5">{c.gov}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Distance Radius Selector */}
          <div className="p-4 rounded-2xl bg-surface-snow border border-border-hairline space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-body-compact font-bold text-dark-slate">
                نطاق البحث الجغرافي الأقصى:
              </span>
              <span className="text-body-compact font-extrabold text-deep-olive">
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
