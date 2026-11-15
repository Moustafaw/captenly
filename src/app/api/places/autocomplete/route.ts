import { NextResponse } from "next/server";
import { EGYPT_CITY_PRESETS, calculateDistanceKm } from "@/lib/maps";

export const dynamic = "force-dynamic";

const OSM_USER_AGENT = "Captenly-Location-Picker/1.0 (https://captenly.vercel.app)";

interface AutocompleteSuggestionRaw {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

export interface UnifiedAutocompletePrediction {
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

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  street?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city_district?: string;
  district?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
}

interface NominatimResult {
  osm_type?: string;
  osm_id?: number;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: NominatimAddress;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
}

function cleanEgyptCity(raw: string): string {
  return raw
    .replace(/^مركز\s+/, "")
    .replace(/^مدينة\s+/, "")
    .replace(/^قسم\s+(أول|ثان|ثالث)\s+/, "")
    .trim();
}

function cleanEgyptGov(raw: string): string {
  return raw.replace(/^محافظة\s+/, "").trim();
}

function nearestPresetForCoords(lat: number, lng: number) {
  let best = EGYPT_CITY_PRESETS[0];
  let bestDist = Infinity;
  for (const preset of EGYPT_CITY_PRESETS) {
    const d = calculateDistanceKm(lat, lng, preset.lat, preset.lng);
    if (d < bestDist) {
      bestDist = d;
      best = preset;
    }
  }
  return best;
}

function parseNominatimAddress(
  addr: NominatimAddress | undefined,
  lat: number,
  lng: number,
  displayName?: string
) {
  const nearest = nearestPresetForCoords(lat, lng);
  const rawCity =
    addr?.city ||
    addr?.town ||
    addr?.village ||
    addr?.county ||
    nearest.city;
  const rawGov = addr?.state || nearest.governorate || "مصر";
  const district =
    addr?.neighbourhood ||
    addr?.quarter ||
    addr?.suburb ||
    addr?.city_district ||
    addr?.district ||
    "";
  const streetAr = addr?.road || addr?.pedestrian || addr?.street || "";
  const city = cleanEgyptCity(rawCity) || nearest.city;
  const governorate = cleanEgyptGov(rawGov) || nearest.governorate;

  const parts = [streetAr, district, city, governorate].filter((v, idx, arr) => {
    const t = v.trim();
    return t.length > 0 && arr.indexOf(v) === idx;
  });

  const addressLabel =
    parts.length > 0
      ? parts.join("، ")
      : (displayName || `${city}، ${governorate}`).split("،").slice(0, 3).join("،");

  return {
    city,
    governorate,
    district,
    streetAr,
    addressLabel,
  };
}

async function fetchOsmPredictions(
  input: string,
  biasLat?: number,
  biasLng?: number
): Promise<UnifiedAutocompletePrediction[]> {
  const results: UnifiedAutocompletePrediction[] = [];
  const seenKeys = new Set<string>();

  const pushUnique = (item: UnifiedAutocompletePrediction) => {
    const key = `${item.mainText.toLowerCase()}|${item.city || ""}|${(item.lat ?? 0).toFixed(3)}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    results.push(item);
  };

  try {
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("format", "jsonv2");
    nominatimUrl.searchParams.set("q", input);
    nominatimUrl.searchParams.set("countrycodes", "eg");
    nominatimUrl.searchParams.set("accept-language", "ar");
    nominatimUrl.searchParams.set("addressdetails", "1");
    nominatimUrl.searchParams.set("limit", "6");
    if (typeof biasLat === "number" && typeof biasLng === "number") {
      const delta = 0.35;
      nominatimUrl.searchParams.set(
        "viewbox",
        `${biasLng - delta},${biasLat + delta},${biasLng + delta},${biasLat - delta}`
      );
    }

    const res = await fetch(nominatimUrl.toString(), {
      headers: { "User-Agent": OSM_USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const rows = (await res.json()) as NominatimResult[];
      for (const row of Array.isArray(rows) ? rows : []) {
        const lat = Number(row.lat);
        const lng = Number(row.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const parsed = parseNominatimAddress(row.address, lat, lng, row.display_name);
        const mainText =
          row.name?.trim() ||
          parsed.streetAr ||
          parsed.district ||
          parsed.city;
        const secondaryParts = [
          parsed.streetAr && parsed.streetAr !== mainText ? parsed.streetAr : "",
          parsed.district && parsed.district !== mainText ? parsed.district : "",
          parsed.city,
          parsed.governorate,
        ].filter(Boolean);
        const secondaryText =
          Array.from(new Set(secondaryParts)).join("، ") || "مصر";

        pushUnique({
          placeId: `osm-${row.osm_type || "n"}-${row.osm_id || `${lat.toFixed(4)}-${lng.toFixed(4)}`}`,
          source: "osm",
          mainText,
          secondaryText,
          fullText: `${mainText} — ${secondaryText}`,
          lat,
          lng,
          city: parsed.city,
          governorate: parsed.governorate,
          district: parsed.district,
          streetAr: parsed.streetAr,
          addressLabel: parsed.addressLabel,
        });
      }
    }
  } catch {
    // fallback to Photon below
  }

  if (results.length < 4) {
    try {
      const photonUrl = new URL("https://photon.komoot.io/api/");
      photonUrl.searchParams.set("q", `${input} مصر`);
      photonUrl.searchParams.set("limit", "6");
      if (typeof biasLat === "number" && typeof biasLng === "number") {
        photonUrl.searchParams.set("lat", String(biasLat));
        photonUrl.searchParams.set("lon", String(biasLng));
      }
      const res = await fetch(photonUrl.toString(), {
        headers: { "User-Agent": OSM_USER_AGENT },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = (await res.json()) as { features?: PhotonFeature[] };
        for (const f of Array.isArray(data?.features) ? data.features : []) {
          const coords = f.geometry?.coordinates;
          if (!coords || coords.length < 2) continue;
          const [lng, lat] = coords;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const p = f.properties || {};
          if (p.countrycode && p.countrycode.toUpperCase() !== "EG") continue;
          const nearest = nearestPresetForCoords(lat, lng);
          const city = cleanEgyptCity(p.city || p.county || p.locality || nearest.city);
          const governorate = cleanEgyptGov(p.state || nearest.governorate);
          const district = p.district || "";
          const streetAr = p.street || "";
          const mainText = (p.name || streetAr || district || city).trim();
          const secondaryParts = [streetAr !== mainText ? streetAr : "", district, city, governorate].filter(Boolean);
          const secondaryText = Array.from(new Set(secondaryParts)).join("، ") || "مصر";
          const addressLabel =
            Array.from(new Set([mainText, streetAr, district, city, governorate].filter(Boolean))).join("، ");

          pushUnique({
            placeId: `osm-ph-${p.osm_type || "n"}-${p.osm_id || `${lat.toFixed(4)}-${lng.toFixed(4)}`}`,
            source: "osm",
            mainText,
            secondaryText,
            fullText: `${mainText} — ${secondaryText}`,
            lat,
            lng,
            city,
            governorate,
            district,
            streetAr,
            addressLabel,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return results.slice(0, 7);
}

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_SERVER_API_KEY?.trim();
  const { searchParams } = new URL(request.url);
  const placeId = (searchParams.get("placeId") || "").trim();
  const input = (searchParams.get("input") || "").trim();
  const reverseLatRaw = searchParams.get("reverseLat");
  const reverseLngRaw = searchParams.get("reverseLng");
  const biasLatRaw = searchParams.get("lat");
  const biasLngRaw = searchParams.get("lng");

  const biasLat = biasLatRaw ? Number(biasLatRaw) : undefined;
  const biasLng = biasLngRaw ? Number(biasLngRaw) : undefined;

  // 1. Reverse geocode coordinates into Arabic governorate / city / district / street
  if (reverseLatRaw !== null && reverseLngRaw !== null) {
    const lat = Number(reverseLatRaw);
    const lng = Number(reverseLngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ ok: false, reason: "invalid_coordinates" }, { status: 400 });
    }

    const nearest = nearestPresetForCoords(lat, lng);
    try {
      const revUrl = new URL("https://nominatim.openstreetmap.org/reverse");
      revUrl.searchParams.set("format", "jsonv2");
      revUrl.searchParams.set("lat", String(lat));
      revUrl.searchParams.set("lon", String(lng));
      revUrl.searchParams.set("accept-language", "ar");
      revUrl.searchParams.set("addressdetails", "1");
      revUrl.searchParams.set("zoom", "18");

      const res = await fetch(revUrl.toString(), {
        headers: { "User-Agent": OSM_USER_AGENT },
        cache: "no-store",
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const data = (await res.json()) as NominatimResult;
        const parsed = parseNominatimAddress(data?.address, lat, lng, data?.display_name);
        return NextResponse.json({
          ok: true,
          location: {
            ...parsed,
            lat,
            lng,
            placeName: data?.name || undefined,
          },
        });
      }
    } catch {
      // fall back to nearest Egyptian city preset
    }

    return NextResponse.json({
      ok: true,
      location: {
        city: nearest.city,
        governorate: nearest.governorate,
        district: "",
        streetAr: "",
        addressLabel: `${nearest.city}، ${nearest.governorate} (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        lat,
        lng,
      },
    });
  }

  // 2. Resolve exact coordinates + Arabic city/governorate/district/street for a chosen Google placeId
  if (placeId) {
    if (!apiKey) {
      return NextResponse.json({ ok: false, reason: "no_places_key" }, { status: 400 });
    }
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=ar`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,location,addressComponents",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        }
      );
      if (!res.ok) {
        return NextResponse.json({ ok: false, reason: `google_http_${res.status}` }, { status: 502 });
      }
      const place = await res.json();
      const lat = place?.location?.latitude;
      const lng = place?.location?.longitude;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return NextResponse.json({ ok: false, reason: "no_coordinates" }, { status: 404 });
      }

      const components: AddressComponent[] = Array.isArray(place?.addressComponents)
        ? place.addressComponents
        : [];
      const findComp = (t: string) =>
        components.find((c) => Array.isArray(c.types) && c.types.includes(t))?.longText || "";

      const nearest = nearestPresetForCoords(lat, lng);
      const rawCity =
        findComp("locality") ||
        findComp("administrative_area_level_2") ||
        nearest.city;
      const rawGov = findComp("administrative_area_level_1") || nearest.governorate || "مصر";
      const district =
        findComp("sublocality_level_1") ||
        findComp("sublocality") ||
        findComp("neighborhood") ||
        "";
      const streetAr = findComp("route") || "";
      const cleanCity = cleanEgyptCity(rawCity) || nearest.city;
      const cleanGov = cleanEgyptGov(rawGov) || nearest.governorate;

      return NextResponse.json({
        ok: true,
        location: {
          placeId,
          placeName: place?.displayName?.text || "",
          city: cleanCity,
          governorate: cleanGov,
          district,
          streetAr,
          lat,
          lng,
          addressLabel: place?.formattedAddress || `${district ? `${district}، ` : ""}${cleanCity}`,
        },
      });
    } catch {
      return NextResponse.json({ ok: false, reason: "place_resolve_failed" }, { status: 500 });
    }
  }

  // 3. Hybrid Search Autocomplete (Google Places + OpenStreetMap streets/landmarks)
  if (input.length < 2) {
    return NextResponse.json({ ok: true, predictions: [] });
  }

  const googlePredictions: UnifiedAutocompletePrediction[] = [];
  if (apiKey) {
    try {
      const bodyPayload: Record<string, unknown> = {
        input,
        languageCode: "ar",
        includedRegionCodes: ["eg"],
      };
      if (typeof biasLat === "number" && Number.isFinite(biasLat) && typeof biasLng === "number" && Number.isFinite(biasLng)) {
        bodyPayload.locationBias = {
          circle: {
            center: { latitude: biasLat, longitude: biasLng },
            radius: 30000,
          },
        };
      }
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify(bodyPayload),
        cache: "no-store",
        signal: AbortSignal.timeout(4500),
      });

      if (res.ok) {
        const data = (await res.json()) as { suggestions?: AutocompleteSuggestionRaw[] };
        const items = (Array.isArray(data.suggestions) ? data.suggestions : [])
          .map((s) => s.placePrediction)
          .filter((p): p is NonNullable<AutocompleteSuggestionRaw["placePrediction"]> =>
            Boolean(p?.placeId && (p?.structuredFormat?.mainText?.text || p?.text?.text))
          )
          .slice(0, 5)
          .map((p) => ({
            placeId: String(p.placeId),
            source: "google" as const,
            mainText: String(p.structuredFormat?.mainText?.text || p.text?.text || ""),
            secondaryText: String(p.structuredFormat?.secondaryText?.text || "مصر"),
            fullText: String(p.text?.text || p.structuredFormat?.mainText?.text || ""),
          }));
        googlePredictions.push(...items);
      }
    } catch {
      // Fall through cleanly to OSM
    }
  }

  const osmPredictions =
    googlePredictions.length < 4
      ? await fetchOsmPredictions(
          input,
          Number.isFinite(biasLat) ? biasLat : undefined,
          Number.isFinite(biasLng) ? biasLng : undefined
        )
      : [];

  // Merge keeping Google results first, then non-overlapping OSM streets/shops/landmarks
  const merged: UnifiedAutocompletePrediction[] = [...googlePredictions];
  const seenNames = new Set(googlePredictions.map((p) => p.mainText.trim().toLowerCase()));
  for (const item of osmPredictions) {
    if (merged.length >= 8) break;
    const key = item.mainText.trim().toLowerCase();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      merged.push(item);
    }
  }

  return NextResponse.json({
    ok: true,
    predictions: merged,
    providers: {
      google: googlePredictions.length > 0,
      osm: osmPredictions.length > 0,
    },
  });
}
