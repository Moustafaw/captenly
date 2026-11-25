"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Facility } from "@/types/captenly";
import { Icon } from "@/components/Icon";
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsPlaceUrl,
  cleanPublicAddressAr,
  formatDistanceAr,
  getFacilityDistanceKm,
  getGoogleMapsApiKey,
  loadGoogleMapsSdk,
} from "@/lib/maps";

interface CaptenlyGoogleMapProps {
  facilities: Facility[];
  selectedFacilityId?: string;
  onSelectFacility?: (id: string) => void;
  userCoordinates?: { lat: number; lng: number };
  heightClass?: string;
  compact?: boolean;
  showPinStrip?: boolean;
}

export function CaptenlyGoogleMap({
  facilities,
  selectedFacilityId,
  onSelectFacility,
  userCoordinates,
  heightClass = "h-64",
  compact = false,
  showPinStrip = true,
}: CaptenlyGoogleMapProps) {
  const apiKey = getGoogleMapsApiKey();
  const [sdkFailed, setSdkFailed] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [shouldLoadSdk, setShouldLoadSdk] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const activeFacility = useMemo(() => {
    if (facilities.length === 0) return null;
    return facilities.find((f) => f.id === selectedFacilityId) || facilities[0];
  }, [facilities, selectedFacilityId]);

  const hasValidCoords = Boolean(
    activeFacility?.coordinates &&
      Number.isFinite(activeFacility.coordinates.lat) &&
      Number.isFinite(activeFacility.coordinates.lng) &&
      !(activeFacility.coordinates.lat === 0 && activeFacility.coordinates.lng === 0)
  );
  const useInteractiveJsSdk = Boolean(apiKey) && !sdkFailed && hasValidCoords;

  useEffect(() => {
    if (!sdkFailed || !apiKey) return;
    const onOnline = () => {
      setSdkReady(false);
      setSdkFailed(false);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sdkFailed, apiKey]);

  // Defer Google Maps SDK slightly until visible or browser is idle (preserves F-012 fallback timer & lowers TBT)
  useEffect(() => {
    if (!useInteractiveJsSdk || shouldLoadSdk) return;
    const target = mapContainerRef.current || wrapperRef.current;
    const timer = setTimeout(() => setShouldLoadSdk(true), 600);
    if (!target || typeof IntersectionObserver === "undefined") {
      return () => clearTimeout(timer);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          clearTimeout(timer);
          setShouldLoadSdk(true);
          io.disconnect();
        }
      },
      { rootMargin: "250px" }
    );
    io.observe(target);
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, [useInteractiveJsSdk, shouldLoadSdk]);

  // Load Google Maps JavaScript SDK when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured
  useEffect(() => {
    if (!useInteractiveJsSdk || !shouldLoadSdk || !activeFacility || !hasValidCoords || !mapContainerRef.current) return;

    let cancelled = false;
    const win = window as any;
    const prevAuthFail = win.gm_authFailure;
    win.gm_authFailure = () => {
      if (!cancelled) setSdkFailed(true);
      if (typeof prevAuthFail === "function") prevAuthFail();
    };
    const fallbackTimer = setTimeout(() => {
      if (!cancelled && !mapInstanceRef.current) setSdkFailed(true);
    }, 4500);

    loadGoogleMapsSdk(apiKey)
      .then((maps) => {
        clearTimeout(fallbackTimer);
        if (cancelled || !mapContainerRef.current) return;
        setSdkReady(true);

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new maps.Map(mapContainerRef.current, {
            center: {
              lat: activeFacility.coordinates.lat,
              lng: activeFacility.coordinates.lng,
            },
            zoom: compact ? 15 : 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
        }

        // Clear old markers
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        const bounds = new maps.LatLngBounds();

        facilities.forEach((fac) => {
          const isSelected = fac.id === activeFacility.id;
          const pos = { lat: fac.coordinates.lat, lng: fac.coordinates.lng };
          bounds.extend(pos);

          const basePrice = fac.pricePackages[0]?.baseMonthlyEgp ?? null;
          const marker = new maps.Marker({
            position: pos,
            map: mapInstanceRef.current,
            title: basePrice != null ? `${fac.nameAr} — ${basePrice} ج.م` : fac.nameAr,
            label:
              isSelected && basePrice != null
                ? {
                    text: `${basePrice}`,
                    color: "#C4F135",
                    fontWeight: "bold",
                    fontSize: "11px",
                  }
                : undefined,
            zIndex: isSelected ? 10 : 1,
          });

          marker.addListener("click", () => {
            onSelectFacility?.(fac.id);
          });
          markersRef.current.push(marker);
        });

        if (facilities.length > 1 && !selectedFacilityId) {
          mapInstanceRef.current.fitBounds(bounds, 40);
        } else {
          mapInstanceRef.current.panTo({
            lat: activeFacility.coordinates.lat,
            lng: activeFacility.coordinates.lng,
          });
          mapInstanceRef.current.setZoom(compact ? 15 : 14);
        }
      })
      .catch(() => {
        clearTimeout(fallbackTimer);
        if (!cancelled) setSdkFailed(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      win.gm_authFailure = prevAuthFail;
    };
  }, [
    apiKey,
    useInteractiveJsSdk,
    shouldLoadSdk,
    hasValidCoords,
    facilities,
    activeFacility,
    selectedFacilityId,
    compact,
    onSelectFacility,
  ]);

  if (!activeFacility) {
    return (
      <div
        className={`${heightClass} rounded-2xl bg-surface-snow border border-surface-container flex flex-col items-center justify-center p-4 text-center gap-2`}
      >
        <Icon name="location_on" className="text-[28px] text-text-muted" />
        <p className="text-xs font-bold text-text-muted">لا توجد مواقع مطابقة لعرضها على الخريطة حالياً.</p>
      </div>
    );
  }

  const cleanAddr = cleanPublicAddressAr(activeFacility.addressAr);
  const textLocationQuery = [activeFacility.nameAr, cleanAddr, activeFacility.city]
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .join(" ");

  const distanceText =
    userCoordinates && hasValidCoords
      ? formatDistanceAr(getFacilityDistanceKm(activeFacility, userCoordinates))
      : "";

  const directionsUrl = hasValidCoords
    ? buildGoogleMapsDirectionsUrl(activeFacility.coordinates.lat, activeFacility.coordinates.lng)
    : textLocationQuery
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(textLocationQuery)}&travelmode=driving`
      : "";

  const placeUrl = hasValidCoords
    ? buildGoogleMapsPlaceUrl(
        activeFacility.coordinates.lat,
        activeFacility.coordinates.lng,
        activeFacility.nameAr
      )
    : textLocationQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(textLocationQuery)}`
      : "";

  return (
    <div className="flex flex-col gap-3">
      {/* Live Map Frame (JS SDK when configured, Google Maps Embed out-of-the-box) */}
      <div
        className={`relative ${heightClass} rounded-2xl bg-surface-snow overflow-hidden border border-surface-container`}
      >
        {useInteractiveJsSdk ? (
          <>
            <div ref={mapContainerRef} className="w-full h-full" />
            {!sdkReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-snow/80 text-xs font-bold text-dark-slate">
                جاري تحميل خرائط Google التفاعلية...
              </div>
            )}
          </>
        ) : (
          <div
            data-testid="captenly-map-fallback-card"
            className="relative w-full h-full bg-gradient-to-br from-[#0B1C2E] via-[#133248] to-[#1D6E7D] text-white p-5 flex flex-col justify-between"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto gap-1.5 px-3">
              <div className="w-11 h-11 rounded-full bg-[#A3FF00] text-[#0B1C2E] flex items-center justify-center shadow-lg border-2 border-white">
                <Icon name="pool" className="text-[22px]" />
              </div>
              <div className="font-extrabold text-sm leading-snug line-clamp-1">
                {activeFacility.nameAr}
              </div>
              <p className="text-[11px] text-white/80 line-clamp-2 max-w-md">
                {cleanAddr ||
                  [activeFacility.district, activeFacility.city].filter(Boolean).join(" • ") ||
                  "لم تُضف بيانات العنوان التفصيلية لهذه المنشأة بعد."}
              </p>
              {!hasValidCoords && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-300/35 text-[10px] font-bold text-amber-100">
                  الإحداثيات الدقيقة غير مضافة بعد
                </span>
              )}
            </div>
            <div className="relative z-10 flex flex-wrap items-center justify-center gap-2">
              {placeUrl && (
                <a
                  href={placeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#0B1C2E] hover:bg-[#A3FF00] text-xs font-extrabold shadow-sm transition-colors"
                >
                  <Icon name="directions" className="text-[15px]" />
                  <span>افتح الموقع في خرائط Google</span>
                </a>
              )}
              {sdkFailed && Boolean(apiKey) && hasValidCoords && (
                <button
                  type="button"
                  onClick={() => {
                    setSdkReady(false);
                    setSdkFailed(false);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold border border-white/20 transition-colors cursor-pointer"
                >
                  <Icon name="refresh" className="text-[14px]" />
                  <span>إعادة تحميل الخريطة</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Top Overlay Pill */}
        <div className="pointer-events-none absolute top-2.5 right-2.5 left-2.5 flex items-center justify-between gap-2">
          <span className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur shadow-sm text-[11px] font-bold text-dark-slate border border-surface-container">
            <Icon name="location_on" className="text-[13px] text-deep-olive" />
            <span className="truncate max-w-[180px]">
              {activeFacility.city} • {activeFacility.district}
            </span>
          </span>

          {distanceText && (
            <span className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-dark-slate/90 text-electric-volt shadow-sm text-[11px] font-bold shrink-0">
              <Icon name="near_me" className="text-[12px]" />
              <span>يبعد {distanceText}</span>
            </span>
          )}
        </div>
      </div>

      {/* Multi-facility Quick Pin Switcher */}
      {showPinStrip && facilities.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {facilities.map((fac) => {
            const active = activeFacility.id === fac.id;
            const price = fac.pricePackages[0]?.baseMonthlyEgp ?? null;
            const facDist = userCoordinates
              ? formatDistanceAr(getFacilityDistanceKm(fac, userCoordinates))
              : "";
            return (
              <button
                key={fac.id}
                type="button"
                onClick={() => onSelectFacility?.(fac.id)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 border shrink-0 whitespace-nowrap ${
                  active
                    ? "bg-dark-slate text-electric-volt border-dark-slate shadow-sm"
                    : "bg-surface-snow text-dark-slate border-surface-container hover:bg-lime-tint"
                }`}
              >
                <Icon name="location_on" className="text-[12px]" />
                <span>{price != null ? `${price} ج.م` : fac.nameAr}</span>
                <span className="opacity-75">• {fac.city}</span>
                {facDist && <span className="opacity-75">({facDist})</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Direct Google Maps Actions */}
      {(directionsUrl || placeUrl) && (
        <div className="flex flex-wrap items-center gap-2">
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[140px] py-2 px-3 rounded-full bg-deep-olive text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-95 shadow-sm"
            >
              <Icon name="directions" className="text-[15px]" />
              <span>الاتجاهات عبر خرائط Google</span>
            </a>
          )}
          {placeUrl && (
            <a
              href={placeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3.5 rounded-full bg-surface-snow border border-surface-container text-dark-slate text-xs font-bold flex items-center justify-center gap-1 hover:bg-lime-tint"
            >
              <Icon name="explore" className="text-[14px]" />
              <span>عرض الموقع</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
