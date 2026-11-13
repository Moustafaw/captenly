import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_SERVER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, predictions: [], reason: "no_places_key" });
  }

  const { searchParams } = new URL(request.url);
  const placeId = (searchParams.get("placeId") || "").trim();
  const input = (searchParams.get("input") || "").trim();

  // Resolve exact coordinates + Arabic city/governorate for a chosen placeId
  if (placeId) {
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=ar`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,location,addressComponents",
          },
          cache: "no-store",
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

      const rawCity =
        findComp("locality") ||
        findComp("administrative_area_level_2") ||
        place?.displayName?.text ||
        "موقع مختار";
      const rawGov = findComp("administrative_area_level_1") || "مصر";
      const cleanCity = rawCity
        .replace(/^مركز\s+/, "")
        .replace(/^قسم\s+(أول|ثان|ثالث)\s+/, "")
        .trim();
      const cleanGov = rawGov.replace(/^محافظة\s+/, "").trim();

      return NextResponse.json({
        ok: true,
        location: {
          city: cleanCity,
          governorate: cleanGov,
          lat,
          lng,
          addressLabel: place?.formattedAddress || cleanCity,
        },
      });
    } catch {
      return NextResponse.json({ ok: false, reason: "place_resolve_failed" }, { status: 500 });
    }
  }

  if (input.length < 2) {
    return NextResponse.json({ ok: true, predictions: [] });
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input,
        languageCode: "ar",
        includedRegionCodes: ["eg"],
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, predictions: [], reason: `google_http_${res.status}` });
    }

    const data = (await res.json()) as { suggestions?: AutocompleteSuggestionRaw[] };
    const predictions = (Array.isArray(data.suggestions) ? data.suggestions : [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<AutocompleteSuggestionRaw["placePrediction"]> =>
        Boolean(p?.placeId && (p?.structuredFormat?.mainText?.text || p?.text?.text))
      )
      .slice(0, 6)
      .map((p) => ({
        placeId: String(p.placeId),
        mainText: String(p.structuredFormat?.mainText?.text || p.text?.text || ""),
        secondaryText: String(p.structuredFormat?.secondaryText?.text || "مصر"),
        fullText: String(p.text?.text || p.structuredFormat?.mainText?.text || ""),
      }));

    return NextResponse.json({ ok: true, predictions });
  } catch {
    return NextResponse.json({ ok: false, predictions: [], reason: "autocomplete_failed" });
  }
}
