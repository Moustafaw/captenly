"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import {
  EGYPT_CITY_PRESETS,
  getGoogleMapsApiKey,
  loadGoogleMapsSdk,
} from "@/lib/maps";

export interface SelectedLocationPayload {
  city: string;
  governorate: string;
  lat: number;
  lng: number;
  addressLabel: string;
}

interface LocationAutocompleteInputProps {
  initialValue?: string;
  placeholder?: string;
  onSelectLocation: (loc: SelectedLocationPayload) => void;
}

export function LocationAutocompleteInput({
  initialValue = "",
  placeholder = "ابحث بالمدينة أو الحي أو اسم المنشأة (مثلاً: المحلة، طنطا، مدينة نصر)...",
  onSelectLocation,
}: LocationAutocompleteInputProps) {
  const { facilities } = useCaptenly();
  const apiKey = getGoogleMapsApiKey();

  const [query, setQuery] = useState(initialValue);
  const [placesReady, setPlacesReady] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Attach Google Places Autocomplete when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is available
  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    let cancelled = false;
    let listener: any = null;

    loadGoogleMapsSdk(apiKey)
      .then((maps) => {
        if (cancelled || !inputRef.current || !maps?.places?.Autocomplete) return;
        const ac = new maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "eg" },
          fields: ["geometry", "address_components", "formatted_address", "name"],
        });
        setPlacesReady(true);

        listener = ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const lat = place?.geometry?.location?.lat?.();
          const lng = place?.geometry?.location?.lng?.();
          if (typeof lat !== "number" || typeof lng !== "number") return;

          const components: any[] = place.address_components || [];
          const locality =
            components.find((c) => c.types?.includes("locality"))?.long_name ||
            components.find((c) => c.types?.includes("administrative_area_level_2"))?.long_name ||
            place.name ||
            "موقع مختار";
          const gov =
            components.find((c) => c.types?.includes("administrative_area_level_1"))?.long_name ||
            "مصر";
          const label = place.formatted_address || locality;
          setQuery(label);
          onSelectLocation({
            city: locality.replace(/^مركز\s+/, ""),
            governorate: gov.replace(/^محافظة\s+/, ""),
            lat,
            lng,
            addressLabel: label,
          });
        });
      })
      .catch(() => {
        // Silently keep built-in Egyptian cities & district autocomplete
      });

    return () => {
      cancelled = true;
      if (listener && typeof listener.remove === "function") {
        listener.remove();
      }
    };
  }, [apiKey, onSelectLocation]);

  const localSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const seen = new Set<string>();
    const items: SelectedLocationPayload[] = [];

    for (const preset of EGYPT_CITY_PRESETS) {
      const key = `${preset.city}-${preset.governorate}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          city: preset.city,
          governorate: preset.governorate,
          lat: preset.lat,
          lng: preset.lng,
          addressLabel: `${preset.city}، محافظة ${preset.governorate}`,
        });
      }
    }

    for (const fac of facilities) {
      const key = `${fac.city}-${fac.district}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          city: fac.city,
          governorate: fac.governorate,
          lat: fac.coordinates.lat,
          lng: fac.coordinates.lng,
          addressLabel: `${fac.district} — ${fac.city} (${fac.nameAr})`,
        });
      }
    }

    if (!q) return items.slice(0, 6);
    return items
      .filter(
        (item) =>
          item.city.toLowerCase().includes(q) ||
          item.governorate.toLowerCase().includes(q) ||
          item.addressLabel.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, facilities]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 bg-surface-snow border border-surface-container rounded-2xl px-3.5 py-2.5 focus-within:border-deep-olive">
        <Icon name="search" className="text-[18px] text-deep-olive shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-dark-slate outline-none placeholder:text-text-muted"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-text-muted hover:text-dark-slate shrink-0"
            aria-label="مسح البحث"
          >
            <Icon name="close" className="text-[16px]" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-muted px-1">
        <span>
          {placesReady
            ? "متصل بالبحث التلقائي لخرائط Google Places"
            : "اقتراحات سريعة للمدن والأحياء المعتمدة:"}
        </span>
      </div>

      {localSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {localSuggestions.map((item) => (
            <button
              key={item.addressLabel}
              type="button"
              onClick={() => {
                setQuery(item.city);
                onSelectLocation(item);
              }}
              className="px-3 py-1.5 rounded-full bg-surface-snow hover:bg-lime-tint border border-surface-container text-xs font-semibold text-dark-slate flex items-center gap-1 transition-colors"
            >
              <Icon name="location_on" className="text-[13px] text-deep-olive" />
              <span>{item.addressLabel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
