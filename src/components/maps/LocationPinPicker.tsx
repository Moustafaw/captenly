"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { Icon } from "@/components/Icon";
import { EGYPT_CITY_PRESETS } from "@/lib/maps";
import type { FacilityLocation } from "@/types/captenly";

interface PredictionOption {
  placeId: string;
  source: "google" | "osm";
  mainText: string;
  secondaryText: string;
  fullText: string;
  lat?: number;
  lng?: number;
  city?: string;
  governorate?: string;
  district?: string;
  streetAr?: string;
  addressLabel?: string;
}

interface LocationPinPickerProps {
  value: FacilityLocation | null;
  onChange: (loc: FacilityLocation) => void;
  locationId?: string;
  showLabelInput?: boolean;
  labelInputPlaceholder?: string;
  searchPlaceholder?: string;
  mapHeightClass?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  compactHeaderTitle?: string;
}

const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 }; // Cairo default view until pinned

export function LocationPinPicker({
  value,
  onChange,
  locationId,
  showLabelInput = false,
  labelInputPlaceholder = "اسم النادي أو المكان (مثال: نادي الشرطة بطنطا)",
  searchPlaceholder = "ابحث باسم الشارع، الحي، المنطقة، أي محل مجاور، أو اسم النادي...",
  mapHeightClass = "h-64",
  isExpanded = true,
  onToggleExpand,
  compactHeaderTitle,
}: LocationPinPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<PredictionOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState("");

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  onChangeRef.current = onChange;
  valueRef.current = value;

  const currentCenter = value?.coordinates || DEFAULT_CENTER;

  // Debounced hybrid autocomplete (Google Places + OSM streets/shops/districts)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setPredictions([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      const url = `/api/places/autocomplete?input=${encodeURIComponent(trimmed)}&lat=${currentCenter.lat}&lng=${currentCenter.lng}`;
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          setPredictions(Array.isArray(data?.predictions) ? data.predictions : []);
        })
        .catch(() => {
          if (!cancelled) setPredictions([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, currentCenter.lat, currentCenter.lng]);

  const reverseGeocodeAndEmit = async (
    lat: number,
    lng: number,
    preserveLabel?: string,
    preservePlaceId?: string
  ) => {
    setReverseBusy(true);
    setGpsError("");
    try {
      const res = await fetch(
        `/api/places/autocomplete?reverseLat=${encodeURIComponent(lat)}&reverseLng=${encodeURIComponent(lng)}`
      );
      const data = await res.json().catch(() => null);
      const loc = data?.ok && data.location ? data.location : null;
      const city = loc?.city || valueRef.current?.city || "القاهرة";
      const governorate = loc?.governorate || valueRef.current?.governorate || "مصر";
      const district = loc?.district || "";
      const streetAr = loc?.streetAr || "";
      const addressAr = loc?.addressLabel || `${city}، ${governorate}`;
      const labelAr =
        preserveLabel !== undefined
          ? preserveLabel
          : valueRef.current?.labelAr || loc?.placeName || "";

      onChangeRef.current({
        id: valueRef.current?.id || locationId || `loc-${Date.now()}`,
        labelAr: labelAr || undefined,
        governorate,
        city,
        district,
        streetAr: streetAr || undefined,
        addressAr,
        coordinates: { lat, lng },
        googlePlaceId: preservePlaceId ?? valueRef.current?.googlePlaceId,
      });
    } catch {
      onChangeRef.current({
        id: valueRef.current?.id || locationId || `loc-${Date.now()}`,
        labelAr: valueRef.current?.labelAr,
        governorate: valueRef.current?.governorate || "مصر",
        city: valueRef.current?.city || "موقع محدد على الخريطة",
        district: valueRef.current?.district || "",
        addressAr: valueRef.current?.addressAr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        coordinates: { lat, lng },
        googlePlaceId: preservePlaceId ?? valueRef.current?.googlePlaceId,
      });
    } finally {
      setReverseBusy(false);
    }
  };

  // Initialize Leaflet interactive pin-drop map on client when expanded
  useEffect(() => {
    if (!isExpanded || !mapDivRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapDivRef.current) return;

      const initCoords = valueRef.current?.coordinates || DEFAULT_CENTER;
      const zoomLevel = valueRef.current?.coordinates ? 16 : 6;

      if (!leafletMapRef.current) {
        const map = L.map(mapDivRef.current, {
          center: [initCoords.lat, initCoords.lng],
          zoom: zoomLevel,
          zoomControl: true,
          attributionControl: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);

        const pinIcon = L.divIcon({
          className: "captenly-pin-marker",
          html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
            <div style="width:36px;height:36px;border-radius:9999px;background:#2C3437;border:3px solid #C4F135;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,0,0,0.35);">
              <div style="width:10px;height:10px;border-radius:9999px;background:#C4F135;"></div>
            </div>
            <div style="width:3px;height:10px;background:#2C3437;margin-top:-2px;border-radius:9999px;"></div>
          </div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([initCoords.lat, initCoords.lng], {
          draggable: true,
          icon: pinIcon,
        }).addTo(map);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          map.panTo(pos, { animate: true });
          void reverseGeocodeAndEmit(pos.lat, pos.lng);
        });

        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          map.panTo([lat, lng], { animate: true });
          if (map.getZoom() < 15) map.setZoom(16);
          void reverseGeocodeAndEmit(lat, lng);
        });

        leafletMapRef.current = map;
        markerRef.current = marker;
      }

      setTimeout(() => {
        leafletMapRef.current?.invalidateSize?.();
      }, 120);
    });

    return () => {
      cancelled = true;
    };
  }, [isExpanded]);

  // Destroy map cleanly on unmount or collapse so re-expand mounts fresh
  useEffect(() => {
    if (isExpanded) return;
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      markerRef.current = null;
    }
  }, [isExpanded]);

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Pan & move marker when external selection changes coordinates
  const moveMapTo = (lat: number, lng: number, zoom = 16) => {
    if (markerRef.current && leafletMapRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      leafletMapRef.current.setView([lat, lng], zoom, { animate: true });
    }
  };

  const handlePickPrediction = async (item: PredictionOption) => {
    setResolving(true);
    setGpsError("");
    try {
      if (typeof item.lat === "number" && typeof item.lng === "number") {
        const nextLoc: FacilityLocation = {
          id: value?.id || locationId || `loc-${Date.now()}`,
          labelAr: value?.labelAr || item.mainText || undefined,
          governorate: item.governorate || "مصر",
          city: item.city || item.mainText,
          district: item.district || "",
          streetAr: item.streetAr || undefined,
          addressAr: item.addressLabel || item.fullText || item.mainText,
          coordinates: { lat: item.lat, lng: item.lng },
          googlePlaceId: item.source === "google" ? item.placeId : undefined,
        };
        onChange(nextLoc);
        moveMapTo(item.lat, item.lng, 16);
        setSearchQuery(item.mainText);
        setPredictions([]);
        return;
      }

      const res = await fetch(
        `/api/places/autocomplete?placeId=${encodeURIComponent(item.placeId)}`
      );
      const data = await res.json();
      if (data?.ok && data.location) {
        const loc = data.location;
        const nextLoc: FacilityLocation = {
          id: value?.id || locationId || `loc-${Date.now()}`,
          labelAr: value?.labelAr || loc.placeName || item.mainText || undefined,
          governorate: loc.governorate || "مصر",
          city: loc.city || item.mainText,
          district: loc.district || "",
          streetAr: loc.streetAr || undefined,
          addressAr: loc.addressLabel || item.fullText || item.mainText,
          coordinates: { lat: loc.lat, lng: loc.lng },
          googlePlaceId: item.placeId,
        };
        onChange(nextLoc);
        moveMapTo(loc.lat, loc.lng, 17);
        setSearchQuery(loc.placeName || item.mainText);
        setPredictions([]);
      } else {
        setGpsError("تعذر جلب إحداثيات هذا الاختيار، يمكنك النقر مباشرة على الخريطة أو سحب الدبوس.");
      }
    } catch {
      setGpsError("تعذر الاتصال بخدمة البحث — يمكنك تحديد الدبوس مباشرة على الخريطة.");
    } finally {
      setResolving(false);
    }
  };

  const handleUseCurrentGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError("المتصفح لا يدعم تحديد الموقع التلقائي، ابحث بالاسم أو اسحب الدبوس على الخريطة.");
      return;
    }
    setGpsBusy(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        moveMapTo(lat, lng, 17);
        void reverseGeocodeAndEmit(lat, lng).finally(() => setGpsBusy(false));
      },
      () => {
        setGpsBusy(false);
        setGpsError("يرجى السماح بصلاحية الموقع في المتصفح أو سحب الدبوس يدوياً على الخريطة.");
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  };

  const handleQuickCityJump = (preset: (typeof EGYPT_CITY_PRESETS)[number]) => {
    moveMapTo(preset.lat, preset.lng, 13);
    if (!value) {
      onChange({
        id: locationId || `loc-${Date.now()}`,
        governorate: preset.governorate,
        city: preset.city,
        district: "",
        addressAr: `${preset.city}، ${preset.governorate}`,
        coordinates: { lat: preset.lat, lng: preset.lng },
      });
    }
  };

  return (
    <div className="rounded-2xl bg-surface-snow border border-surface-container p-4 flex flex-col gap-3">
      {compactHeaderTitle && (
        <div className="flex items-center justify-between gap-2">
          <span className="font-badge-label text-xs text-dark-slate flex items-center gap-1.5">
            <Icon name="location_on" className="text-[16px] text-deep-olive" />
            <span>{compactHeaderTitle}</span>
          </span>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-[11px] font-bold text-deep-olive hover:underline"
            >
              {isExpanded ? "إخفاء الخريطة ▲" : "تحديد / تعديل على الخريطة ▼"}
            </button>
          )}
        </div>
      )}

      {/* Search bar + GPS trigger */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 bg-surface-card border border-surface-container rounded-xl px-3.5 py-2.5 focus-within:border-deep-olive">
          <Icon
            name={searching || resolving ? "travel_explore" : "search"}
            className={`text-[18px] text-deep-olive shrink-0 ${searching || resolving ? "animate-pulse" : ""}`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-xs sm:text-sm text-dark-slate outline-none placeholder:text-text-muted"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setPredictions([]);
              }}
              className="text-text-muted hover:text-dark-slate"
              aria-label="مسح البحث"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleUseCurrentGps}
          disabled={gpsBusy}
          className="px-4 py-2.5 rounded-xl bg-dark-slate text-electric-volt text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 hover:opacity-95 disabled:opacity-60"
        >
          <Icon name="my_location" className={`text-[16px] ${gpsBusy ? "animate-spin" : ""}`} />
          <span>{gpsBusy ? "جاري التحديد..." : "موقعي الحالي GPS"}</span>
        </button>
      </div>

      {/* Autocomplete Dropdown */}
      {predictions.length > 0 && (
        <div className="rounded-xl bg-surface-card border border-border-hairline shadow-lg overflow-hidden divide-y divide-border-hairline max-h-56 overflow-y-auto z-20">
          {predictions.map((item) => (
            <button
              key={item.placeId}
              type="button"
              disabled={resolving}
              onClick={() => handlePickPrediction(item)}
              className="w-full px-3.5 py-2.5 text-right hover:bg-lime-tint/50 transition-colors flex items-center justify-between gap-2 disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon name="place" className="text-[17px] text-deep-olive shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-dark-slate truncate">{item.mainText}</div>
                  <div className="text-[11px] text-text-muted truncate">{item.secondaryText}</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-snow text-text-muted shrink-0">
                {item.source === "google" ? "Google" : "خريطة"}
              </span>
            </button>
          ))}
        </div>
      )}

      {gpsError && (
        <div className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {gpsError}
        </div>
      )}

      {/* Interactive Pin Drop Map */}
      {isExpanded && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-text-muted font-bold ml-1">انتقال سريع على الخريطة:</span>
            {EGYPT_CITY_PRESETS.slice(0, 7).map((preset) => (
              <button
                key={preset.city}
                type="button"
                onClick={() => handleQuickCityJump(preset)}
                className="px-2.5 py-1 rounded-full bg-surface-card border border-surface-container hover:bg-lime-tint text-dark-slate font-semibold"
              >
                {preset.city}
              </button>
            ))}
          </div>

          <div className={`relative w-full ${mapHeightClass} rounded-2xl overflow-hidden border border-surface-container bg-surface-card`}>
            <div ref={mapDivRef} className="w-full h-full z-0" />
            <div className="pointer-events-none absolute top-2.5 right-2.5 left-2.5 flex items-center justify-between gap-2 z-[400]">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-dark-slate/90 text-electric-volt text-[11px] font-bold shadow">
                <Icon name="touch_app" className="text-[14px]" />
                <span>اسحب الدبوس أو اضغط على أي شارع/معلم لتحديد الموقع الدقيق</span>
              </span>
              {reverseBusy && (
                <span className="px-2.5 py-1 rounded-full bg-white/95 text-deep-olive text-[11px] font-bold shadow">
                  جاري قراءة العنوان...
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmed/Editable Pinned Address Card */}
      {value ? (
        <div className="rounded-xl bg-surface-card border border-deep-olive/30 p-3.5 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-deep-olive">
              <Icon name="check_circle" className="text-[16px]" />
              <span>
                الموقع المحدد: {value.governorate} • {value.city}
                {value.district ? ` • ${value.district}` : ""}
              </span>
            </div>
            <span dir="ltr" className="text-[10px] font-mono text-text-muted">
              {value.coordinates.lat.toFixed(5)}, {value.coordinates.lng.toFixed(5)}
            </span>
          </div>

          {showLabelInput && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-dark-slate">
                اسم النادي أو الفرع (توضيح للمشتركين)
              </label>
              <input
                type="text"
                value={value.labelAr || ""}
                onChange={(e) => onChange({ ...value, labelAr: e.target.value })}
                placeholder={labelInputPlaceholder}
                className="w-full rounded-xl bg-surface-snow px-3.5 py-2 text-xs text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-dark-slate">
              العنوان التفصيلي / الشارع / أقرب معلم مجاور *
            </label>
            <input
              type="text"
              required
              value={value.addressAr}
              onChange={(e) => onChange({ ...value, addressAr: e.target.value })}
              placeholder="مثال: شارع البحر — بجوار صيدلية ... — طنطا"
              className="w-full rounded-xl bg-surface-snow px-3.5 py-2 text-xs text-dark-slate outline-none border border-surface-container focus:border-deep-olive"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50/70 border border-amber-200 px-3.5 py-2.5 text-[11px] font-bold text-amber-900 flex items-center gap-2">
          <Icon name="info" className="text-[15px] shrink-0" />
          <span>ابحث عن الشارع أو المعلم المجاور أو اضغط على الخريطة لتثبيت الدبوس الجغرافي.</span>
        </div>
      )}
    </div>
  );
}
