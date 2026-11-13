"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  buildGoogleMapsEmbedUrl,
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

  const useJsSdk = Boolean(apiKey) && !sdkFailed;

  useEffect(() => {
    if (!useJsSdk || !containerRef.current) return;

    let cancelled = false;
    const win = window as any;
    const prevAuthFail = win.gm_authFailure;
    win.gm_authFailure = () => {
      if (!cancelled) setSdkFailed(true);
      if (typeof prevAuthFail === "function") prevAuthFail();
    };

    loadGoogleMapsSdk(apiKey)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        setSdkReady(true);

        const center = { lat, lng };
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
        if (!cancelled) setSdkFailed(true);
      });

    return () => {
      cancelled = true;
      win.gm_authFailure = prevAuthFail;
    };
  }, [apiKey, useJsSdk, lat, lng, cityLabel]);

  const embedUrl = buildGoogleMapsEmbedUrl(lat, lng, 13, cityLabel);

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
          <iframe
            title={`خريطة ${cityLabel}`}
            src={embedUrl}
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full border-0"
            allowFullScreen
          />
        )}

        <div className="pointer-events-none absolute top-2 right-2 left-2 flex items-center justify-between gap-2">
          <span className="px-2.5 py-1 rounded-full bg-dark-slate/90 text-electric-volt text-[10px] font-bold flex items-center gap-1 shadow">
            <Icon name="pin_drop" className="text-[13px]" />
            <span>{useJsSdk ? "انقر على الخريطة أو اسحب الدبوس لتحديد موقعك" : cityLabel}</span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-surface-card/90 text-dark-slate text-[10px] font-mono shadow">
            {lat.toFixed(3)}, {lng.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  );
}
