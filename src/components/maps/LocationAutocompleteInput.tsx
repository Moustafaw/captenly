"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { useCaptenly } from "@/context/CaptenlyContext";
import { EGYPT_CITY_PRESETS } from "@/lib/maps";

export interface SelectedLocationPayload {
  city: string;
  governorate: string;
  lat: number;
  lng: number;
  addressLabel: string;
}

interface PredictionItem {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

interface LocationAutocompleteInputProps {
  initialValue?: string;
  placeholder?: string;
  onSelectLocation: (loc: SelectedLocationPayload) => void;
}

export function LocationAutocompleteInput({
  initialValue = "",
  placeholder = "ابحث عن مدينتك، حيّك، أو أقرب معلم (مثال: المعادي، المحلة، سموحة)...",
  onSelectLocation,
}: LocationAutocompleteInputProps) {
  const { facilities } = useCaptenly();
  const [query, setQuery] = useState(initialValue);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [placesOnline, setPlacesOnline] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Server-backed Google Places API (New) Autocomplete — works securely without browser referrer/legacy key issues
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setPredictions([]);
      setLoading(false);
      setErrorMsg("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMsg("");

    const timer = setTimeout(() => {
      fetch(`/api/places/autocomplete?input=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          if (!data || data.ok === false) {
            setPlacesOnline(false);
            setPredictions([]);
          } else {
            setPlacesOnline(true);
            setPredictions(Array.isArray(data.predictions) ? data.predictions : []);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPlacesOnline(false);
            setPredictions([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handlePickPrediction = async (item: PredictionItem) => {
    setResolvingId(item.placeId);
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/places/autocomplete?placeId=${encodeURIComponent(item.placeId)}`
      );
      const data = await res.json();
      if (data?.ok && data.location) {
        setQuery(data.location.addressLabel || item.mainText);
        setPredictions([]);
        onSelectLocation(data.location as SelectedLocationPayload);
      } else {
        setErrorMsg("تعذر جلب إحداثيات هذا الموقع من خرائط Google، جرب اختياراً آخر.");
      }
    } catch {
      setErrorMsg("حدث خطأ أثناء الاتصال بخدمة المواقع.");
    } finally {
      setResolvingId(null);
    }
  };

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
          addressLabel: `${preset.city}، ${preset.governorate}`,
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
          addressLabel: `${fac.district} — ${fac.city}`,
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
      .slice(0, 6);
  }, [query, facilities]);

  return (
    <div className="flex flex-col gap-2 relative">
      <div className="flex items-center gap-2 bg-surface-snow border border-surface-container rounded-2xl px-3.5 py-2.5 focus-within:border-deep-olive">
        <Icon
          name={loading || resolvingId ? "travel_explore" : "search"}
          className={`text-[18px] text-deep-olive shrink-0 ${loading || resolvingId ? "animate-pulse" : ""}`}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-dark-slate outline-none placeholder:text-text-muted"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setPredictions([]);
              setErrorMsg("");
            }}
            className="text-text-muted hover:text-dark-slate shrink-0"
            aria-label="مسح البحث"
          >
            <Icon name="close" className="text-[16px]" />
          </button>
        )}
      </div>

      {/* Live Google Places (New) Predictions List */}
      {predictions.length > 0 && (
        <div className="rounded-2xl bg-surface-card border border-border-hairline shadow-lg overflow-hidden divide-y divide-border-hairline max-h-60 overflow-y-auto">
          {predictions.map((item) => (
            <button
              key={item.placeId}
              type="button"
              disabled={resolvingId === item.placeId}
              onClick={() => handlePickPrediction(item)}
              className="w-full px-3.5 py-2.5 text-right hover:bg-lime-tint/60 transition-colors flex items-center justify-between gap-2 disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon name="location_on" className="text-[17px] text-deep-olive shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-dark-slate truncate">{item.mainText}</div>
                  <div className="text-[10px] text-text-muted truncate">{item.secondaryText}</div>
                </div>
              </div>
              {resolvingId === item.placeId ? (
                <span className="text-[10px] font-bold text-deep-olive shrink-0">جاري التحديد...</span>
              ) : (
                <Icon name="chevron_left" className="text-[16px] text-text-muted shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {errorMsg && (
        <div className="text-[11px] font-bold text-red-600 px-1">{errorMsg}</div>
      )}

      <div className="flex items-center justify-between text-[11px] text-text-muted px-1">
        <span>
          {placesOnline
            ? "بحث فوري متصل بخرائط Google Places (مصر)"
            : "اقتراحات سريعة للمدن المصرية:"}
        </span>
      </div>

      {predictions.length === 0 && localSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {localSuggestions.map((item) => (
            <button
              key={item.addressLabel}
              type="button"
              onClick={() => {
                setQuery(item.city);
                setPredictions([]);
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
