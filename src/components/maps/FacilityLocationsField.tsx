"use client";

import React, { useState } from "react";
import { Icon } from "@/components/Icon";
import { LocationPinPicker } from "@/components/maps/LocationPinPicker";
import type { FacilityLocation } from "@/types/captenly";

interface FacilityLocationsFieldProps {
  isAcademy: boolean;
  onToggleAcademy: (next: boolean) => void;
  locations: FacilityLocation[];
  onChangeLocations: (next: FacilityLocation[]) => void;
}

export function FacilityLocationsField({
  isAcademy,
  onToggleAcademy,
  locations,
  onChangeLocations,
}: FacilityLocationsFieldProps) {
  // For academy mode: track which slot currently has its interactive Leaflet map expanded
  const [expandedSlotIndex, setExpandedSlotIndex] = useState<number | null>(0);

  const primaryLocation = locations[0] || null;

  const handleSingleLocationChange = (loc: FacilityLocation) => {
    onChangeLocations([loc]);
  };

  const handleAcademySlotChange = (idx: number, loc: FacilityLocation) => {
    const next = [...locations];
    if (idx < next.length) {
      next[idx] = loc;
    } else {
      next.push(loc);
    }
    onChangeLocations(next);
    // Keep map open on the current edited slot or smoothly allow editing next slot
    setExpandedSlotIndex(idx);
  };

  const handleRemoveAcademySlot = (idx: number) => {
    const next = locations.filter((_, i) => i !== idx);
    onChangeLocations(next);
    if (next.length === 0) {
      setExpandedSlotIndex(0);
    } else if (expandedSlotIndex === idx) {
      setExpandedSlotIndex(null);
    }
  };

  // In academy mode, always render all pinned locations PLUS 1 automatic new empty slot at the end
  const slotCount = isAcademy ? locations.length + 1 : 1;

  return (
    <div className="md:col-span-2 flex flex-col gap-3">
      {/* Academy multi-location toggle checkbox */}
      <label className="flex items-start gap-3 p-4 rounded-2xl bg-surface-snow border-2 border-surface-container hover:border-deep-olive/60 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={isAcademy}
          onChange={(e) => {
            const checked = e.target.checked;
            onToggleAcademy(checked);
            if (!checked && locations.length > 1) {
              onChangeLocations([locations[0]]);
            }
            setExpandedSlotIndex(0);
          }}
          className="mt-0.5 w-5 h-5 accent-deep-olive rounded cursor-pointer shrink-0"
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-card-title-sm text-sm text-dark-slate">
            أكاديمية سباحة تعمل داخل نادي أو أكثر من موقع
          </span>
          <span className="text-xs text-text-muted leading-relaxed">
            عند تفعيل هذا الخيار يمكنك تحديد موقع النادي الذي تعمل به الآن، وكلما حددت موقعاً يظهر تلقائياً حقل جديد لإضافة نادٍ أو فرع آخر بعدد غير محدود.
          </span>
        </div>
      </label>

      {/* Single Facility Mandatory Location Picker */}
      {!isAcademy ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="font-badge-label text-dark-slate">
              تحديد الموقع الجغرافي للمنشأة / النادي (إجباري) *
            </label>
            <span className="text-[11px] font-semibold text-text-muted">
              يميز فروع الأسماء المتشابهة حسب الشارع والمدينة
            </span>
          </div>
          <LocationPinPicker
            value={primaryLocation}
            onChange={handleSingleLocationChange}
            locationId="loc-primary"
            showLabelInput={false}
            isExpanded={true}
            searchPlaceholder="ابحث باسم المنشأة، الشارع، الحي، أو أي محل مجاور..."
          />
        </div>
      ) : (
        /* Academy Multi-Club / Multi-Branch Dynamic Slots */
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="font-badge-label text-dark-slate">
              مواقع الأندية والفروع التي تعمل بها الأكاديمية * ({locations.length} محدد)
            </label>
            <span className="text-[11px] font-bold text-deep-olive">
              إلزامي تحديد موقع واحد على الأقل — يظهر حقل جديد تلقائياً لكل فرع إضافي
            </span>
          </div>

          {Array.from({ length: slotCount }).map((_, idx) => {
            const loc = locations[idx] || null;
            const isExtraEmptySlot = idx === locations.length && locations.length > 0;
            const expanded = expandedSlotIndex === idx || (idx === 0 && !loc);

            return (
              <div
                key={loc?.id || `empty-slot-${idx}`}
                className={`flex flex-col gap-2 ${
                  isExtraEmptySlot ? "opacity-95 border-t border-dashed border-surface-container pt-3" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-dark-slate flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-dark-slate text-electric-volt text-[11px] inline-flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>
                      {isExtraEmptySlot
                        ? `إضافة موقع / نادٍ آخر للأكاديمية (حقل #${idx + 1} — اختياري)`
                        : `موقع النادي / الفرع #${idx + 1}${idx === 0 ? " (إلزامي)" : ""}`}
                    </span>
                  </span>

                  {loc && locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAcademySlot(idx)}
                      className="text-[11px] font-bold text-status-danger hover:underline inline-flex items-center gap-1"
                    >
                      <Icon name="delete" className="text-[14px]" />
                      <span>إزالة الموقع</span>
                    </button>
                  )}
                </div>

                <LocationPinPicker
                  value={loc}
                  onChange={(nextLoc) => handleAcademySlotChange(idx, nextLoc)}
                  locationId={`loc-branch-${idx + 1}-${Date.now()}`}
                  showLabelInput={true}
                  labelInputPlaceholder={`اسم النادي في الفرع #${idx + 1} (مثال: نادي الشرطة بطنطا)`}
                  searchPlaceholder={
                    isExtraEmptySlot
                      ? `ابحث لتحديد موقع النادي / الفرع #${idx + 1} (أو اتركه فارغاً لو انتهيت)...`
                      : "ابحث باسم النادي، الشارع، الحي، أو أي محل مجاور..."
                  }
                  mapHeightClass="h-56"
                  isExpanded={expanded}
                  onToggleExpand={() =>
                    setExpandedSlotIndex((prev) => (prev === idx ? null : idx))
                  }
                  compactHeaderTitle={
                    loc
                      ? `${loc.labelAr || loc.city} — ${loc.addressAr}`
                      : `حقل تحديد موقع الفرع #${idx + 1}`
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
