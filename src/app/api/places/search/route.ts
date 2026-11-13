import { NextResponse } from "next/server";
import { Facility } from "@/types/captenly";

interface GooglePlaceItem {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  editorialSummary?: { text?: string };
}

function inferCityFromAddress(address: string, fallbackCity: string): string {
  if (
    fallbackCity &&
    fallbackCity !== "الكل" &&
    fallbackCity !== "كل مصر" &&
    fallbackCity !== "موقعك الحالي"
  ) {
    return fallbackCity;
  }
  const knownCities = [
    "المحلة الكبرى",
    "طنطا",
    "سمنود",
    "زفتى",
    "كفر الزيات",
    "المنصورة",
    "الإسكندرية",
    "الاسكندرية",
    "سموحة",
    "الجيزة",
    "6 أكتوبر",
    "الشيخ زايد",
    "الدقي",
    "المهندسين",
    "مدينة نصر",
    "المعادي",
    "القاهرة الجديدة",
    "التجمع",
    "مصر الجديدة",
    "الزمالك",
    "القاهرة",
    "الزقازيق",
    "شبين الكوم",
    "بنها",
    "دمياط",
    "بورسعيد",
    "الإسماعيلية",
    "السويس",
    "كفر الشيخ",
    "دمنهور",
    "الفيوم",
    "المنيا",
    "أسيوط",
    "الأقصر",
    "أسوان",
    "الغردقة",
  ];
  for (const c of knownCities) {
    if (address.includes(c)) {
      return c === "الاسكندرية" ? "الإسكندرية" : c;
    }
  }
  if (address.includes("المحلة")) return "المحلة الكبرى";
  return fallbackCity && fallbackCity !== "الكل" && fallbackCity !== "كل مصر" ? fallbackCity : "مصر";
}

function inferGovernorateFromCity(city: string, address: string): string {
  if (["المحلة الكبرى", "طنطا", "سمنود", "زفتى", "كفر الزيات"].includes(city)) return "الغربية";
  if (city === "المنصورة") return "الدقهلية";
  if (["القاهرة", "مدينة نصر", "المعادي", "القاهرة الجديدة", "التجمع", "مصر الجديدة", "الزمالك"].includes(city))
    return "القاهرة";
  if (["الجيزة", "6 أكتوبر", "الشيخ زايد", "الدقي", "المهندسين"].includes(city)) return "الجيزة";
  if (["الإسكندرية", "سموحة"].includes(city)) return "الإسكندرية";
  if (city === "الزقازيق") return "الشرقية";
  if (city === "شبين الكوم") return "المنوفية";
  if (city === "بنها") return "القليوبية";
  if (address.includes("الغربية")) return "الغربية";
  if (address.includes("القاهرة")) return "القاهرة";
  if (address.includes("الجيزة")) return "الجيزة";
  if (address.includes("الإسكندرية") || address.includes("الاسكندرية")) return "الإسكندرية";
  return city || "مصر";
}

function normalizeGooglePlaceToFacility(p: GooglePlaceItem, rawCity: string): Facility | null {
  if (!p.id || !p.displayName?.text) return null;
  const placeId = String(p.id);
  const nameAr = String(p.displayName?.text || "مسبح على خرائط Google");
  const cleanCityInput =
    rawCity === "موقعك الحالي" || rawCity === "كل مصر"
      ? ""
      : rawCity.replace(/\s*\(GPS\)/g, "").trim();
  const formattedAddress = String(
    p.formattedAddress ||
      (cleanCityInput && cleanCityInput !== "الكل" ? `${cleanCityInput}، مصر` : "مصر")
  );
  const cityLabel = inferCityFromAddress(formattedAddress, cleanCityInput || "الكل");
  const governorate = inferGovernorateFromCity(cityLabel, formattedAddress);

  return {
    id: `gplace-${placeId}`,
    slug: `gplace-${placeId}`,
    googlePlaceId: placeId,
    nameAr,
    nameEn: nameAr,
    facilityType: "swimming_academy",
    sportSector: "swimming",
    governorate,
    city: cityLabel,
    district: formattedAddress.split("،")[0]?.trim() || cityLabel,
    addressAr: formattedAddress,
    coordinates: {
      lat: p.location?.latitude || 30.0444,
      lng: p.location?.longitude || 31.2357,
    },
    whatsappNumber: undefined,
    instapayHandle: "",
    vodafoneCashNumber: "",
    supplyStatus: "seeded_unclaimed",
    subscriptionTier: "free_founding",
    isSponsored: false,
    priceLastVerifiedDaysAgo: 0,
    priceLastVerifiedDate: "بيانات خرائط Google العامة",
    avgReplyMinutes: 0,
    completenessScore: 60,
    rating: typeof p.rating === "number" ? p.rating : 4.4,
    reviewsCount: typeof p.userRatingCount === "number" ? p.userRatingCount : 0,
    heroImage: "/screens/20b781f698f9.jpg",
    publicDescriptionAr:
      p.editorialSummary?.text ||
      `مسبح أو نادي سباحة مدرج في دليل خرائط Google (${formattedAddress}).`,
    sourcePublicNoteAr: formattedAddress,
    badges: [],
    specialtiesAr: ["سباحة عامة"],
    pricePackages: [],
    affiliatedCoachIds: [],
    monthlyMetrics: {
      profileViews: 0,
      comparisonAppearances: 0,
      verifiedWhatsappLeads: 0,
      activeSessionLedgers: 0,
    },
  };
}

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_SERVER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: true, places: [], reason: "no_places_key" });
  }

  const { searchParams } = new URL(request.url);
  const placeId = (searchParams.get("placeId") || "").trim();
  const rawQuery = (searchParams.get("q") || "").trim();
  const rawCity = (searchParams.get("city") || "الكل").trim();
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const parsedLat = latStr ? Number(latStr) : NaN;
  const parsedLng = lngStr ? Number(lngStr) : NaN;
  const hasCoords = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

  // Single-place lookup for direct /academy/gplace-... page loads
  if (placeId) {
    const cleanPlaceId = placeId.replace(/^gplace-/, "");
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(cleanPlaceId)}?languageCode=ar`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "id,displayName,formattedAddress,location,rating,userRatingCount,editorialSummary",
          },
          cache: "no-store",
        }
      );
      if (!res.ok) {
        return NextResponse.json({ ok: false, places: [], reason: `google_http_${res.status}` });
      }
      const item = (await res.json()) as GooglePlaceItem;
      const mapped = normalizeGooglePlaceToFacility(item, rawCity);
      return NextResponse.json({ ok: true, places: mapped ? [mapped] : [] });
    } catch {
      return NextResponse.json({ ok: false, places: [], reason: "place_detail_failed" });
    }
  }

  const scopeParam = (searchParams.get("scope") || "").trim();
  const isEgyptWide =
    scopeParam === "egypt" ||
    rawCity === "كل مصر" ||
    (!rawQuery && rawCity === "الكل" && !hasCoords);

  const fetchGoogleSearchText = async (textQuery: string, biasCoords?: { lat: number; lng: number }, limit = 15) => {
    const body: Record<string, unknown> = {
      textQuery,
      languageCode: "ar",
      regionCode: "EG",
      maxResultCount: limit,
    };
    if (biasCoords) {
      body.locationBias = {
        circle: {
          center: { latitude: biasCoords.lat, longitude: biasCoords.lng },
          radius: 18000.0,
        },
      };
    }
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.editorialSummary",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: res.status, items: [] as GooglePlaceItem[] };
    const data = (await res.json()) as { places?: GooglePlaceItem[] };
    return {
      ok: true,
      status: 200,
      items: Array.isArray(data.places) ? data.places : [],
    };
  };

  try {
    if (isEgyptWide && !rawQuery) {
      const queries = [
        "حمامات سباحة وأكاديميات سباحة في القاهرة والجيزة",
        "حمامات سباحة وأندية سباحة في الإسكندرية والساحل",
        "أكاديميات سباحة وحمامات سباحة في الدلتا والمنصورة وطنطا والمحلة",
      ];
      const settled = await Promise.all(
        queries.map((qText) => fetchGoogleSearchText(qText, undefined, 8))
      );
      const lists = settled.map((s) =>
        s.items
          .map((item) => normalizeGooglePlaceToFacility(item, "كل مصر"))
          .filter((f): f is Facility => Boolean(f))
      );
      // Interleave across Egypt regions so home/explore show diversified nationwide academies
      const interleaved: Facility[] = [];
      const seen = new Set<string>();
      const maxLen = Math.max(0, ...lists.map((l) => l.length));
      for (let i = 0; i < maxLen; i++) {
        for (const list of lists) {
          const item = list[i];
          if (item && !seen.has(item.id)) {
            seen.add(item.id);
            interleaved.push(item);
          }
        }
      }
      return NextResponse.json({ ok: true, places: interleaved, scope: "egypt" });
    }

    const cleanCityForText =
      rawCity !== "الكل" && rawCity !== "كل مصر" && rawCity !== "موقعك الحالي"
        ? rawCity.replace(/\s*\(GPS\)/g, "").trim()
        : "";

    const textQuery = rawQuery
      ? `حمام سباحة ونادي سباحة ${rawQuery} ${cleanCityForText}`.trim()
      : cleanCityForText
      ? `حمامات سباحة وأكاديميات سباحة ونوادي في ${cleanCityForText}`
      : "حمامات سباحة وأكاديميات سباحة قريبة في مصر";

    const result = await fetchGoogleSearchText(
      textQuery,
      hasCoords ? { lat: parsedLat, lng: parsedLng } : undefined,
      15
    );
    if (!result.ok) {
      return NextResponse.json({ ok: false, places: [], reason: `google_http_${result.status}` });
    }
    const normalized: Facility[] = result.items
      .map((item) => normalizeGooglePlaceToFacility(item, rawCity))
      .filter((f): f is Facility => Boolean(f));

    return NextResponse.json({ ok: true, places: normalized });
  } catch {
    return NextResponse.json({ ok: false, places: [], reason: "places_fetch_failed" });
  }
}
