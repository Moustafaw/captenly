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

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_SERVER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: true, places: [], reason: "no_places_key" });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = (searchParams.get("q") || "").trim();
  const rawCity = (searchParams.get("city") || "الكل").trim();

  if (!rawQuery && rawCity === "الكل") {
    return NextResponse.json({ ok: true, places: [] });
  }

  const locationHint = rawCity !== "الكل" ? rawCity : "مصر";
  const textQuery = rawQuery
    ? `مسبح سباحة ${rawQuery} ${locationHint}`
    : `حمام سباحة وأكاديمية سباحة في ${locationHint}`;

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.editorialSummary",
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "ar",
        regionCode: "EG",
        maxResultCount: 8,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, places: [], reason: `google_http_${res.status}` });
    }

    const data = (await res.json()) as { places?: GooglePlaceItem[] };
    const items = Array.isArray(data.places) ? data.places : [];

    const normalized: Facility[] = items
      .filter((p) => p.id && p.displayName?.text)
      .map((p) => {
        const placeId = String(p.id);
        const nameAr = String(p.displayName?.text || "مسبح على خرائط Google");
        const formattedAddress = String(p.formattedAddress || `${locationHint}، مصر`);
        const cityLabel =
          rawCity !== "الكل"
            ? rawCity
            : formattedAddress.includes("القاهرة")
            ? "القاهرة"
            : formattedAddress.includes("الإسكندرية") || formattedAddress.includes("الاسكندرية")
            ? "الإسكندرية"
            : formattedAddress.includes("طنطا")
            ? "طنطا"
            : formattedAddress.includes("المحلة")
            ? "المحلة الكبرى"
            : "مصر";

        return {
          id: `gplace-${placeId}`,
          slug: `gplace-${placeId}`,
          googlePlaceId: placeId,
          nameAr,
          nameEn: nameAr,
          facilityType: "swimming_academy",
          sportSector: "swimming",
          governorate: cityLabel === "طنطا" || cityLabel === "المحلة الكبرى" ? "الغربية" : cityLabel,
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
            `موقع سباحة مسجل على خرائط Google (${formattedAddress}).`,
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
      });

    return NextResponse.json({ ok: true, places: normalized });
  } catch {
    return NextResponse.json({ ok: false, places: [], reason: "places_fetch_failed" });
  }
}
