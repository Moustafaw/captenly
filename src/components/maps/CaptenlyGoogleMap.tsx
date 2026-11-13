"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Facility } from "@/types/captenly";
import { Icon } from "@/components/Icon";
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsPlaceUrl,
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

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const activeFacility = useMemo(() => {
    if (facilities.length === 0) return null;
    return facilities.find((f) => f.id === selectedFacilityId) || facilities[0];
  }, [facilities, selectedFacilityId]);

  const useInteractiveJsSdk = Boolean(apiKey) && !sdkFailed;

  // Load Google Maps JavaScript SDK when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured
  useEffect(() => {
    if (!useInteractiveJsSdk || !activeFacility || !mapContainerRef.current) return;

    let cancelled = false;
    const win = window as any;
    const prevAuthFail = win.gm_authFailure;
    win.gm_authFailure = () => {
      if (!cancelled) setSdkFailed(true);
      if (typeof prevAuthFail === "function") prevAuthFail();
    };

    loadGoogleMapsSdk(apiKey)
      .then((maps) => {
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

          const basePrice = fac.pricePackages[0]?.baseMonthlyEgp || 600;
          const marker = new maps.Marker({
            position: pos,
            map: mapInstanceRef.current,
            title: `${fac.nameAr} — ${basePrice} ج.م`,
            label: isSelected
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
        if (!cancelled) setSdkFailed(true);
      });

    return () => {
      cancelled = true;
      win.gm_authFailure = prevAuthFail;
    };
  }, [
    apiKey,
    useInteractiveJsSdk,
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

  const distanceText = userCoordinates
    ? formatDistanceAr(getFacilityDistanceKm(activeFacility, userCoordinates))
    : "";

  const embedUrl = buildGoogleMapsEmbedUrl(
    activeFacility.coordinates.lat,
    activeFacility.coordinates.lng,
    compact ? 15 : 14,
    activeFacility.nameAr
  );

  const directionsUrl = buildGoogleMapsDirectionsUrl(
    activeFacility.coordinates.lat,
    activeFacility.coordinates.lng
  );

  const placeUrl = buildGoogleMapsPlaceUrl(
    activeFacility.coordinates.lat,
    activeFacility.coordinates.lng,
    activeFacility.nameAr
  );

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
          <iframe
            title={`خريطة ${activeFacility.nameAr}`}
            src={embedUrl}
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full border-0"
            allowFullScreen
          />
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
            const price = fac.pricePackages[0]?.baseMonthlyEgp || 600;
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
                <span>{price} ج.م</span>
                <span className="opacity-75">• {fac.city}</span>
                {facDist && <span className="opacity-75">({facDist})</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Direct Google Maps Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[140px] py-2 px-3 rounded-full bg-deep-olive text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-95 shadow-sm"
        >
          <Icon name="directions" className="text-[15px]" />
          <span>الاتجاهات عبر خرائط Google</span>
        </a>
        <a
          href={placeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="py-2 px-3.5 rounded-full bg-surface-snow border border-surface-container text-dark-slate text-xs font-bold flex items-center justify-center gap-1 hover:bg-lime-tint"
        >
          <Icon name="explore" className="text-[14px]" />
          <span>عرض الموقع</span>
        </a>
      </div>
    </div>
  );
}
