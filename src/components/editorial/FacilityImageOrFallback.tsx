"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Facility } from "@/types/captenly";
import { Icon } from "@/components/Icon";
import { CaptenlyImage } from "@/components/CaptenlyImage";

export function resolveFacilityImage(heroImage?: string): string {
  const trimmed = (heroImage || "").trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed;
  }
  return "";
}

export interface FacilityImageOrFallbackProps {
  facility: Pick<Facility, "nameAr" | "heroImage"> &
    Partial<Pick<Facility, "city" | "governorate" | "sportSector">>;
  className?: string;
  imgClassName?: string;
  compact?: boolean;
}

/**
 * Displays a facility's uploaded photo (Priority 1), external public-directory
 * photo or club logo cleanly fitted (Priority 2), or an architectural pool
 * placeholder card when no valid image exists (Priority 3).
 */
export function FacilityImageOrFallback({
  facility,
  className = "w-full h-full",
  imgClassName = "w-full h-full object-cover",
  compact = false,
}: FacilityImageOrFallbackProps) {
  const src = resolveFacilityImage(facility.heroImage);
  const isProxyPhoto = src.startsWith("/api/places/photo");
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [renderAsLogo, setRenderAsLogo] = useState(false);

  const evaluateLoadedImage = (naturalWidth: number, naturalHeight: number) => {
    if (naturalWidth < 24 || naturalHeight < 24) {
      setFailed(true);
      return;
    }
    const aspect = naturalWidth / Math.max(1, naturalHeight);
    const looksLikeLogo =
      (isProxyPhoto && (aspect <= 1.32 || aspect >= 2.8 || Math.max(naturalWidth, naturalHeight) <= 380)) ||
      (Math.max(naturalWidth, naturalHeight) <= 220 && aspect <= 1.2);
    if (looksLikeLogo) {
      setRenderAsLogo(true);
    }
  };

  useEffect(() => {
    setFailed(false);
    setRenderAsLogo(false);
    const el = imgRef.current;
    if (el && el.complete) {
      evaluateLoadedImage(el.naturalWidth, el.naturalHeight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (!src || failed) {
    const locationLabel = [facility.city, facility.governorate].filter(Boolean).join(" • ");
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#0B1726] via-[#12293D] to-[#173B4F] flex flex-col items-center justify-center text-center select-none ${className}`}
        aria-label={facility.nameAr}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, transparent 0px, transparent 14px, rgba(163, 255, 0, 0.22) 14px, rgba(163, 255, 0, 0.22) 15px)",
          }}
        />
        {compact ? (
          <div className="relative z-10 flex flex-col items-center justify-center gap-0.5 px-1.5 text-white/85">
            <Icon name="pool" className="text-lg text-[#a3ff00]" />
            <span className="text-[9px] font-bold leading-tight text-white/75 line-clamp-1">
              دليل عام
            </span>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 px-4 max-w-xs">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-center text-[#a3ff00]">
              <Icon name="pool" className="text-[20px]" />
            </div>
            <span className="text-[11px] font-extrabold text-white tracking-tight">
              مدرج من الدليل العام
            </span>
            <span className="text-[10px] font-medium text-white/65">
              بدون صور مرفوعة بعد{locationLabel ? ` • ${locationLabel}` : ""}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (renderAsLogo) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#0B1726] via-[#132B3E] to-[#193A4E] flex items-center justify-center ${
          compact ? "p-1.5" : "p-4"
        } ${className}`}
      >
        <div
          className={`w-full h-full flex items-center justify-center bg-white/95 shadow-sm border border-white/25 ${
            compact ? "rounded-lg p-1" : "rounded-2xl max-w-[140px] max-h-[120px] p-2.5"
          }`}
        >
          <img
            ref={imgRef}
            src={src}
            alt={facility.nameAr}
            loading="lazy"
            onLoad={(e) =>
              evaluateLoadedImage(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
            }
            onError={() => setFailed(true)}
            className="max-w-full max-h-full object-contain"
          />
        </div>
        {!compact && (
          <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/55 text-white/90 text-[9px] font-bold backdrop-blur-sm">
            شعار المكان
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-surface-container ${className}`}>
      <CaptenlyImage
        ref={imgRef}
        src={src}
        alt={facility.nameAr}
        fill
        sizes="(max-width: 768px) 100vw, 420px"
        loading="lazy"
        onLoad={(e) =>
          evaluateLoadedImage(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
        }
        onError={() => setFailed(true)}
        className={imgClassName}
      />
    </div>
  );
}
