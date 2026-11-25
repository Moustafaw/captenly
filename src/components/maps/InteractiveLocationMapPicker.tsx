"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  EGYPT_CITY_PRESETS,
  getGoogleMapsApiKey,
  loadGoogleMapsSdk,
} from "@/lib/maps";

interface InteractiveLocationMapPickerProps {
  lat: number;
  lng: number;
  cityLabel?: string;
  onPickCoordinates: (lat: number, lng: number) => void;
  heightClass?: string;
}

export function InteractiveLocationMapPicker({
  lat,
  lng,
  cityLabel = "موقع البحث المختار",
  onPickCoordinates,
  heightClass = "h-48",
}: InteractiveLocationMapPickerProps) {
  const apiKey = getGoogleMapsApiKey();
  const [sdkFailed, setSdkFailed] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onPickRef = useRef(onPickCoordinates);
  onPickRef.current = onPickCoordinates;

  const hasValidCoords =
    Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  const anchorLat = hasValidCoords ? lat : 30.0444;
  const anchorLng = hasValidCoords ? lng : 31.2357;

  const useJsSdk = Boolean(apiKey) && !sdkFailed;
  const externalMapUrl = hasValidCoords
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
    : "";

  useEffect(() => {
    if (!sdkFailed || !apiKey) return;
    const onOnline = () => {
      setSdkReady(false);
      setSdkFailed(false);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sdkFailed, apiKey]);

  const handleFallbackCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
    const normY = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
    const nextLat = Number((anchorLat - normY * 0.08).toFixed(6));
    const nextLng = Number((anchorLng + normX * 0.1).toFixed(6));
    onPickCoordinates(nextLat, nextLng);
  };

  useEffect(() => {
    if (!useJsSdk || !containerRef.current) return;

    let cancelled = false;
    const win = window as any;
    const prevAuthFail = win.gm_authFailure;
    win.gm_authFailure = () => {
      if (!cancelled) setSdkFailed(true);
      if (typeof prevAuthFail === "function") prevAuthFail();
    };
    const fallbackTimer = setTimeout(() => {
      if (!cancelled && !mapRef.current) setSdkFailed(true);
    }, 4500);

    loadGoogleMapsSdk(apiKey)
      .then((maps) => {
        clearTimeout(fallbackTimer);
        if (cancelled || !containerRef.current) return;
        setSdkReady(true);

        const center = { lat: anchorLat, lng: anchorLng };
        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            center,
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });

          markerRef.current = new maps.Marker({
            position: center,
            map: mapRef.current,
            draggable: true,
            title: cityLabel,
          });

          mapRef.current.addListener("click", (ev: any) => {
            const nextLat = ev?.latLng?.lat?.();
            const nextLng = ev?.latLng?.lng?.();
            if (typeof nextLat !== "number" || typeof nextLng !== "number") return;
            markerRef.current?.setPosition({ lat: nextLat, lng: nextLng });
            mapRef.current?.panTo({ lat: nextLat, lng: nextLng });
            onPickRef.current(nextLat, nextLng);
          });

          markerRef.current.addListener("dragend", (ev: any) => {
            const nextLat = ev?.latLng?.lat?.();
            const nextLng = ev?.latLng?.lng?.();
            if (typeof nextLat !== "number" || typeof nextLng !== "number") return;
            mapRef.current?.panTo({ lat: nextLat, lng: nextLng });
            onPickRef.current(nextLat, nextLng);
          });
        } else {
          markerRef.current?.setPosition(center);
          mapRef.current.panTo(center);
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
  }, [apiKey, useJsSdk, lat, lng, cityLabel]);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`relative ${heightClass} w-full rounded-2xl overflow-hidden border border-border-hairline bg-surface-snow`}
      >
        {useJsSdk ? (
          <>
            <div ref={containerRef} className="w-full h-full" />
            {!sdkReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-snow/85 text-xs font-bold text-dark-slate">
                جاري تحميل خريطة تحديد الموقع...
              </div>
            )}
          </>
        ) : (
          <div
            data-testid="interactive-map-fallback"
            className="relative w-full h-full bg-gradient-to-br from-[#0F2438] via-[#17354D] to-[#1D4E63] text-white flex flex-col justify-between p-3 select-none"
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="خريطة تفاعلية بديلة لتحديد الموقع — انقر لنقل الدبوس"
              onClick={handleFallbackCanvasClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onPickCoordinates(anchorLat, anchorLng);
                }
              }}
              className="absolute inset-0 cursor-crosshair z-0"
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="w-9 h-9 rounded-full bg-[#A3FF00] text-[#0B1C2E] flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.4)] border-2 border-white">
                  <Icon name="pin_drop" className="text-[20px]" />
                </div>
                <span className="mt-1 px-2 py-0.5 rounded-full bg-black/55 text-[10px] font-bold text-white backdrop-blur-sm">
                  انقر في أي نقطة لضبط الدبوس
                </span>
              </div>
            </div>
            <div className="relative z-10 mt-auto flex items-center justify-between gap-2 pt-2 pointer-events-none">
              <div className="flex flex-wrap gap-1 pointer-events-auto">
                {EGYPT_CITY_PRESETS.slice(0, 4).map((preset) => (
                  <button
                    key={preset.city}
                    type="button"
                    onClick={() => onPickCoordinates(preset.lat, preset.lng)}
                    className="px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-[10px] font-bold text-white backdrop-blur-sm border border-white/15 transition"
                  >
                    {preset.city}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
                {sdkFailed && Boolean(apiKey) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSdkReady(false);
                      setSdkFailed(false);
                    }}
                    className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold border border-white/20 transition cursor-pointer"
                  >
                    إعادة تحميل الخريطة
                  </button>
                )}
                {externalMapUrl && (
                  <a
                    href={externalMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-full bg-white text-[#0B1C2E] text-[10px] font-extrabold hover:bg-[#A3FF00] transition shrink-0"
                  >
                    فتح الخريطة ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute top-2 right-2 left-2 flex items-center justify-between gap-2">
          <span className="px-2.5 py-1 rounded-full bg-dark-slate/90 text-electric-volt text-[10px] font-bold flex items-center gap-1 shadow">
            <Icon name="pin_drop" className="text-[13px]" />
            <span>{useJsSdk ? "انقر على الخريطة أو اسحب الدبوس لتحديد موقعك" : cityLabel}</span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-surface-card/90 text-dark-slate text-[10px] font-mono shadow">
            {hasValidCoords ? `${lat.toFixed(3)}, ${lng.toFixed(3)}` : "إحداثيات غير محددة"}
          </span>
        </div>
      </div>
    </div>
  );
}
