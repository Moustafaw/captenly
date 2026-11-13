import type { Facility } from "@/types/captenly";

export interface GeoCityPreset {
  city: string;
  governorate: string;
  lat: number;
  lng: number;
}

export const EGYPT_CITY_PRESETS: GeoCityPreset[] = [
  { city: "المحلة الكبرى", governorate: "الغربية", lat: 30.9706, lng: 31.1669 },
  { city: "طنطا", governorate: "الغربية", lat: 30.7865, lng: 31.0004 },
  { city: "زفتى", governorate: "الغربية", lat: 30.7124, lng: 31.2423 },
  { city: "سمنود", governorate: "الغربية", lat: 30.9617, lng: 31.2414 },
  { city: "كفر الزيات", governorate: "الغربية", lat: 30.8253, lng: 30.8186 },
  { city: "المنصورة", governorate: "الدقهلية", lat: 31.0409, lng: 31.3785 },
  { city: "القاهرة", governorate: "القاهرة", lat: 30.0444, lng: 31.2357 },
  { city: "مدينة نصر", governorate: "القاهرة", lat: 30.0511, lng: 31.3656 },
  { city: "المعادي", governorate: "القاهرة", lat: 29.9602, lng: 31.2569 },
  { city: "الجيزة", governorate: "الجيزة", lat: 30.0131, lng: 31.2089 },
  { city: "6 أكتوبر", governorate: "الجيزة", lat: 29.9285, lng: 30.9188 },
  { city: "الإسكندرية", governorate: "الإسكندرية", lat: 31.2001, lng: 29.9187 },
];

export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function formatDistanceAr(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return "";
  if (distanceKm < 1) {
    return `${Math.max(50, Math.round(distanceKm * 1000))} م`;
  }
  return `${distanceKm.toFixed(1)} كم`;
}

export function getGoogleMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
}

export function hasGoogleMapsApiKey(): boolean {
  return getGoogleMapsApiKey().length > 0;
}

export function buildGoogleMapsPlaceUrl(
  lat: number,
  lng: number,
  label?: string
): string {
  const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const query = label ? `${label} ${coords}` : coords;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildGoogleMapsDirectionsUrl(lat: number, lng: number): string {
  const dest = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
}

export function buildGoogleMapsEmbedUrl(
  lat: number,
  lng: number,
  zoom = 14,
  queryLabel?: string
): string {
  const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const target = queryLabel ? `${coords}` : coords;
  // Direct /maps/embed avoids the 301 X-Frame-Options: SAMEORIGIN header from maps.google.com/maps
  return `https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s${encodeURIComponent(target)}!6i${zoom}!3m1!1sar!5m1!1sar`;
}

export function getFacilityDistanceKm(
  facility: Pick<Facility, "coordinates">,
  userCoords: { lat: number; lng: number }
): number {
  return calculateDistanceKm(
    userCoords.lat,
    userCoords.lng,
    facility.coordinates.lat,
    facility.coordinates.lng
  );
}

let googleMapsLoaderPromise: Promise<any> | null = null;

export function loadGoogleMapsSdk(apiKey: string): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps SDK requires browser environment"));
  }
  const win = window as any;
  if (win.google?.maps) {
    return Promise.resolve(win.google.maps);
  }
  if (!apiKey) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }
  if (googleMapsLoaderPromise) {
    return googleMapsLoaderPromise;
  }

  googleMapsLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("captenly-google-maps-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).google?.maps));
      existing.addEventListener("error", () => {
        googleMapsLoaderPromise = null;
        reject(new Error("Failed to load Google Maps script"));
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "captenly-google-maps-sdk";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=ar&region=EG`;
    script.onload = () => {
      if ((window as any).google?.maps) {
        resolve((window as any).google.maps);
      } else {
        googleMapsLoaderPromise = null;
        reject(new Error("Google Maps object unavailable after load"));
      }
    };
    script.onerror = () => {
      googleMapsLoaderPromise = null;
      reject(new Error("Google Maps SDK failed to load"));
    };
    document.head.appendChild(script);
  });

  return googleMapsLoaderPromise;
}
