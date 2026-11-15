import type { Facility, FacilityLocation } from "@/types/captenly";

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
  { city: "مصر الجديدة", governorate: "القاهرة", lat: 30.0885, lng: 31.3164 },
  { city: "الزمالك", governorate: "القاهرة", lat: 30.0511, lng: 31.2227 },
  { city: "القاهرة الجديدة", governorate: "القاهرة", lat: 30.0074, lng: 31.4913 },
  { city: "الجيزة", governorate: "الجيزة", lat: 30.0131, lng: 31.2089 },
  { city: "الدقي", governorate: "الجيزة", lat: 30.0394, lng: 31.2091 },
  { city: "المهندسين", governorate: "الجيزة", lat: 30.0561, lng: 31.2001 },
  { city: "6 أكتوبر", governorate: "الجيزة", lat: 29.9285, lng: 30.9188 },
  { city: "الشيخ زايد", governorate: "الجيزة", lat: 30.0258, lng: 30.9746 },
  { city: "الإسكندرية", governorate: "الإسكندرية", lat: 31.2001, lng: 29.9187 },
  { city: "سموحة", governorate: "الإسكندرية", lat: 31.2154, lng: 29.9529 },
  { city: "الزقازيق", governorate: "الشرقية", lat: 30.5877, lng: 31.502 },
  { city: "شبين الكوم", governorate: "المنوفية", lat: 30.5526, lng: 31.009 },
  { city: "دمياط", governorate: "دمياط", lat: 31.4175, lng: 31.8144 },
  { city: "بنها", governorate: "القليوبية", lat: 30.466, lng: 31.1848 },
  { city: "كفر الشيخ", governorate: "كفر الشيخ", lat: 31.1107, lng: 30.9388 },
  { city: "دمنهور", governorate: "البحيرة", lat: 31.0341, lng: 30.4682 },
  { city: "بورسعيد", governorate: "بورسعيد", lat: 31.2653, lng: 32.3019 },
  { city: "الإسماعيلية", governorate: "الإسماعيلية", lat: 30.5965, lng: 32.2715 },
  { city: "السويس", governorate: "السويس", lat: 29.9668, lng: 32.5498 },
  { city: "الغردقة", governorate: "البحر الأحمر", lat: 27.2579, lng: 33.8116 },
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

export function getFacilityAllLocations(
  facility: Partial<
    Pick<
      Facility,
      "id" | "nameAr" | "city" | "governorate" | "district" | "addressAr" | "coordinates" | "locations" | "googlePlaceId"
    >
  >
): FacilityLocation[] {
  if (Array.isArray(facility.locations) && facility.locations.length > 0) {
    return facility.locations;
  }
  return [
    {
      id: `${facility.id || "loc"}-primary`,
      labelAr: facility.nameAr,
      governorate: facility.governorate || "مصر",
      city: facility.city || "مصر",
      district: facility.district || "",
      addressAr: facility.addressAr || "",
      coordinates: facility.coordinates || { lat: 30.0444, lng: 31.2357 },
      googlePlaceId: facility.googlePlaceId,
    },
  ];
}

export function getNearestFacilityLocation(
  facility: Parameters<typeof getFacilityAllLocations>[0],
  userCoords: { lat: number; lng: number }
): { location: FacilityLocation; distanceKm: number } {
  const locs = getFacilityAllLocations(facility);
  let bestLoc = locs[0];
  let bestDist = calculateDistanceKm(
    userCoords.lat,
    userCoords.lng,
    bestLoc.coordinates.lat,
    bestLoc.coordinates.lng
  );
  for (let i = 1; i < locs.length; i++) {
    const d = calculateDistanceKm(
      userCoords.lat,
      userCoords.lng,
      locs[i].coordinates.lat,
      locs[i].coordinates.lng
    );
    if (d < bestDist) {
      bestDist = d;
      bestLoc = locs[i];
    }
  }
  return { location: bestLoc, distanceKm: bestDist };
}

export function getFacilityDistanceKm(
  facility: Parameters<typeof getFacilityAllLocations>[0],
  userCoords: { lat: number; lng: number }
): number {
  return getNearestFacilityLocation(facility, userCoords).distanceKm;
}

export function facilityMatchesCity(
  facility: Parameters<typeof getFacilityAllLocations>[0],
  cityQuery: string
): boolean {
  const norm = cityQuery.trim();
  if (!norm || norm === "الكل" || norm === "كل مصر") return true;
  const hayTop = `${facility.city || ""} ${facility.governorate || ""} ${facility.district || ""} ${facility.addressAr || ""}`;
  if (hayTop.includes(norm)) return true;
  return getFacilityAllLocations(facility).some((loc) =>
    `${loc.labelAr || ""} ${loc.city || ""} ${loc.governorate || ""} ${loc.district || ""} ${loc.streetAr || ""} ${loc.addressAr || ""}`.includes(
      norm
    )
  );
}

export function facilityMatchesSearch(
  facility: Pick<
    Facility,
    "id" | "nameAr" | "nameEn" | "city" | "governorate" | "district" | "addressAr" | "coordinates" | "locations" | "googlePlaceId" | "specialtiesAr"
  >,
  queryLower: string
): boolean {
  const q = queryLower.trim().toLowerCase();
  if (!q) return true;
  const locText = getFacilityAllLocations(facility)
    .map(
      (loc) =>
        `${loc.labelAr || ""} ${loc.city} ${loc.governorate} ${loc.district} ${loc.streetAr || ""} ${loc.addressAr}`
    )
    .join(" ");
  const hay = `${facility.nameAr} ${facility.nameEn} ${facility.city} ${facility.governorate} ${facility.district} ${facility.addressAr || ""} ${locText} ${(facility.specialtiesAr || []).join(" ")}`.toLowerCase();
  return hay.includes(q);
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
