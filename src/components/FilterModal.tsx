"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { SWIMMING_SPECIALTIES_9 } from "@/data/seedData";

export function FilterModal() {
  const {
    filterModalOpen,
    setFilterModalOpen,
    smartFilters,
    updateSmartFilters,
    resetSmartFilters,
  } = useCaptenly();

  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("");
  const [heatedPoolOnly, setHeatedPoolOnly] = useState<boolean>(smartFilters.heatedOnly);
  const [ladiesHoursOnly, setLadiesHoursOnly] = useState<boolean>(smartFilters.ladiesOnly);
  const [maxPriceEgp, setMaxPriceEgp] = useState<number>(smartFilters.maxPriceEgp);
  const [lifeguardOnly, setLifeguardOnly] = useState<boolean>(smartFilters.lifeguardOnly);

  useEffect(() => {
    if (!filterModalOpen) return;
    setHeatedPoolOnly(smartFilters.heatedOnly);
    setLadiesHoursOnly(smartFilters.ladiesOnly);
    setLifeguardOnly(smartFilters.lifeguardOnly);
    setMaxPriceEgp(smartFilters.maxPriceEgp);
    setSelectedSpecialty(
      SWIMMING_SPECIALTIES_9.includes(smartFilters.searchQuery) ? smartFilters.searchQuery : ""
    );
  }, [filterModalOpen, smartFilters]);

  if (!filterModalOpen) return null;

  const toggleSpecialty = (item: string) => {
    setSelectedSpecialty((prev) => (prev === item ? "" : item));
  };

  const resetFilters = () => {
    setSelectedSpecialty("");
    setHeatedPoolOnly(false);
    setLadiesHoursOnly(false);
    setMaxPriceEgp(2500);
    setLifeguardOnly(false);
    resetSmartFilters();
  };

  const applyFilters = () => {
    updateSmartFilters({
      heatedOnly: heatedPoolOnly,
      ladiesOnly: ladiesHoursOnly,
      lifeguardOnly,
      maxPriceEgp,
      ...(selectedSpecialty
        ? { searchQuery: selectedSpecialty }
        : SWIMMING_SPECIALTIES_9.includes(smartFilters.searchQuery)
        ? { searchQuery: "" }
        : {}),
    });
    setFilterModalOpen(false);
  };

  const activeFiltersCount =
    (selectedSpecialty ? 1 : 0) +
    (heatedPoolOnly ? 1 : 0) +
    (ladiesHoursOnly ? 1 : 0) +
    (lifeguardOnly ? 1 : 0) +
    (maxPriceEgp < 2500 ? 1 : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-deep-carbon/60 backdrop-blur-sm animate-fade-in"
      dir="rtl"
    >
      <div className="relative w-full max-w-lg bg-surface-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-border-hairline flex flex-col max-h-[92vh]">
        {/* Mobile Drag Indicator */}
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-surface-container-high"></div>
        </div>

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border-hairline flex items-center justify-between bg-surface-snow">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterModalOpen(false)}
              className="w-9 h-9 rounded-full bg-surface-card flex items-center justify-center text-dark-slate hover:bg-surface-container transition-colors border border-border-hairline"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="font-card-title text-card-title text-dark-slate">
                تصفية النتائج والخيارات
              </h2>
              {activeFiltersCount > 0 && (
                <span className="text-deep-olive font-bold text-micro-caption">
                  ({activeFiltersCount} نشطة)
                </span>
              )}
            </div>
          </div>
          <button
            onClick={resetFilters}
            className="text-micro-caption font-bold text-text-muted hover:text-status-danger transition-colors"
          >
            إعادة ضبط
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Section 1: Sports Tabs */}
          {/* Section 1: Swimming Scope */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dark-slate text-electric-volt font-bold text-badge-label">
              <Icon name="pool" className="text-[16px]" />
              <span>فلاتر السباحة والأكاديميات المائية (9 تخصصات)</span>
            </div>
          </div>

          {/* Section 2: Specialties Chips Grid */}
          <div>
            <label className="block text-body-compact font-bold text-dark-slate mb-2">
              التخصص الدقيق المعتمد:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SWIMMING_SPECIALTIES_9.map((spec) => {
                const isSelected = selectedSpecialty === spec;
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => toggleSpecialty(spec)}
                    className={`flex items-center justify-between p-3 rounded-xl text-right text-micro-caption font-bold transition-all border ${
                      isSelected
                        ? "bg-lime-tint text-deep-olive border-athletic-olive/40 shadow-xs"
                        : "bg-surface-snow text-dark-slate border-border-hairline hover:bg-surface-container-low"
                    }`}
                  >
                    <span className="truncate">{spec}</span>
                    <Icon name={isSelected ? "check_circle" : "add_circle"} className="text-[18px] shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Essential Amenities Toggles */}
          <div className="space-y-3 pt-2">
            <label className="block text-body-compact font-bold text-dark-slate">
              معايير الجودة والأمان:
            </label>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-snow border border-border-hairline">
              <div className="flex items-center gap-2.5">
                <Icon name="thermostat" className="text-deep-olive text-[20px]" />
                <div>
                  <span className="block font-bold text-body-compact text-dark-slate">
                    مسبح مدفأ شتاءً (28°C–30°C)
                  </span>
                  <span className="block text-[11px] text-text-muted">
                    حرارة مياه معتمدة لحماية الجهاز التنفسي للأطفال
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={heatedPoolOnly}
                onChange={(e) => setHeatedPoolOnly(e.target.checked)}
                className="w-5 h-5 accent-deep-olive rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-snow border border-border-hairline">
              <div className="flex items-center gap-2.5">
                <Icon name="female" className="text-deep-olive text-[20px]" />
                <div>
                  <span className="block font-bold text-body-compact text-dark-slate">
                    مواعيد وفترات سيدات مغلقة
                  </span>
                  <span className="block text-[11px] text-text-muted">
                    خصوصية تامة مع مدربات ومنقذات معتمدات
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={ladiesHoursOnly}
                onChange={(e) => setLadiesHoursOnly(e.target.checked)}
                className="w-5 h-5 accent-deep-olive rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-snow border border-border-hairline">
              <div className="flex items-center gap-2.5">
                <Icon name="verified" className="text-deep-olive text-[20px]" />
                <div>
                  <span className="block font-bold text-body-compact text-dark-slate">
                    إشراف إنقاذ مائي معتمد (EDLF)
                  </span>
                  <span className="block text-[11px] text-text-muted">
                    عرض المسابح التي يتوفر بها منقذ مائي معتمد على مدار الفترات
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={lifeguardOnly}
                onChange={(e) => setLifeguardOnly(e.target.checked)}
                className="w-5 h-5 accent-deep-olive rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Section 4: Price Slider */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-body-compact font-bold text-dark-slate">
                الحد الأقصى للاشتراك الشهري:
              </span>
              <span className="text-body-compact font-extrabold text-deep-olive">
                حتى {maxPriceEgp} ج.م / شهر
              </span>
            </div>
            <input
              type="range"
              min="400"
              max="2500"
              step="50"
              value={maxPriceEgp}
              onChange={(e) => setMaxPriceEgp(Number(e.target.value))}
              className="w-full accent-deep-olive cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-text-muted">
              <span>400 ج.م</span>
              <span>1450 ج.م</span>
              <span>2500 ج.م</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border-hairline bg-surface-snow flex items-center justify-between">
          <button
            type="button"
            onClick={resetFilters}
            className="text-micro-caption font-bold text-text-muted hover:text-dark-slate underline"
          >
            مسح الكل
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="px-6 py-2.5 rounded-full bg-deep-olive text-white font-bold text-body-compact hover:brightness-105 transition-all shadow-sm"
          >
            تطبيق الفلاتر ({activeFiltersCount})
          </button>
        </div>
      </div>
    </div>
  );
}
