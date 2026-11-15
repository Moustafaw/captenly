import { NextResponse } from "next/server";
import { Facility } from "@/types/captenly";
import { calculateDistanceKm } from "@/lib/maps";

export const dynamic = "force-dynamic";

interface GooglePlaceItem {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  editorialSummary?: { text?: string };
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    street?: string;
    district?: string;
    countrycode?: string;
  };
}

interface NominatimItem {
  osm_type?: string;
  osm_id?: number;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
}

interface CachedSearchEntry {
  places: Facility[];
  scope?: string;
  source: "google" | "osm";
  fetchedAt: number;
}

const FRESH_TTL_MS = 12 * 60 * 60 * 1000;
const STALE_TTL_MS = 72 * 60 * 60 * 1000;
const OSM_USER_AGENT = "Captenly-Aquatic-Directory/1.0 (https://captenly.vercel.app)";

const placesQueryCache = new Map<string, CachedSearchEntry>();
const placeByIdCache = new Map<string, Facility>();

function indexFacilities(items: Facility[]) {
  if (placeByIdCache.size > 1500) {
    placeByIdCache.clear();
  }
  for (const item of items) {
    if (item.id) {
      placeByIdCache.set(item.id, item);
    }
  }
}

function setQueryCache(key: string, entry: CachedSearchEntry) {
  if (placesQueryCache.size > 200) {
    placesQueryCache.clear();
  }
  placesQueryCache.set(key, entry);
  indexFacilities(entry.places);
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
    "السادس من أكتوبر",
    "الشيخ زايد",
    "الدقي",
    "المهندسين",
    "مدينة نصر",
    "المعادي",
    "القاهرة الجديدة",
    "القطامية",
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
      if (c === "الاسكندرية") return "الإسكندرية";
      if (c === "السادس من أكتوبر") return "6 أكتوبر";
      return c;
    }
  }
  if (address.includes("المحلة")) return "المحلة الكبرى";
  return fallbackCity && fallbackCity !== "الكل" && fallbackCity !== "كل مصر" ? fallbackCity : "مصر";
}

function inferGovernorateFromCity(city: string, address: string): string {
  if (["المحلة الكبرى", "طنطا", "سمنود", "زفتى", "كفر الزيات"].includes(city)) return "الغربية";
  if (city === "المنصورة") return "الدقهلية";
  if (
    ["القاهرة", "مدينة نصر", "المعادي", "القاهرة الجديدة", "القطامية", "التجمع", "مصر الجديدة", "الزمالك"].includes(
      city
    )
  ) {
    return "القاهرة";
  }
  if (["الجيزة", "6 أكتوبر", "الشيخ زايد", "الدقي", "المهندسين"].includes(city)) return "الجيزة";
  if (["الإسكندرية", "سموحة"].includes(city)) return "الإسكندرية";
  if (city === "السويس") return "السويس";
  if (city === "الغردقة") return "البحر الأحمر";
  if (city === "الزقازيق") return "الشرقية";
  if (city === "شبين الكوم") return "المنوفية";
  if (city === "بنها") return "القليوبية";
  if (address.includes("الغربية")) return "الغربية";
  if (address.includes("القاهرة")) return "القاهرة";
  if (address.includes("الجيزة")) return "الجيزة";
  if (address.includes("الإسكندرية") || address.includes("الاسكندرية")) return "الإسكندرية";
  if (address.includes("الدقهلية")) return "الدقهلية";
  if (address.includes("السويس")) return "السويس";
  if (address.includes("البحر الأحمر")) return "البحر الأحمر";
  return city || "مصر";
}

const SWIM_PLACE_IMAGES = [
  "/screens/20b781f698f9.jpg",
  "/screens/c4a35b02a5ab.jpg",
  "/screens/bf4051042977.jpg",
  "/screens/ffcc3e56ffaa.jpg",
  "/screens/a62d511dce31.jpg",
  "/screens/f26e73948f8b.jpg",
  "/screens/7d7f304252a9.jpg",
];

function pickDeterministicPoolImage(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return SWIM_PLACE_IMAGES[hash % SWIM_PLACE_IMAGES.length];
}

function buildPublicDirectoryFacility(input: {
  id: string;
  nameAr: string;
  nameEn?: string;
  city: string;
  governorate: string;
  district?: string;
  addressAr: string;
  lat: number;
  lng: number;
  rating?: number;
  reviewsCount?: number;
  priceLastVerifiedDate: string;
  publicDescriptionAr: string;
  specialtiesAr?: string[];
}): Facility {
  return {
    id: input.id,
    slug: input.id,
    googlePlaceId: input.id.startsWith("gplace-") ? input.id.replace(/^gplace-/, "") : input.id,
    nameAr: input.nameAr,
    nameEn: input.nameEn || input.nameAr,
    facilityType: "swimming_academy",
    sportSector: "swimming",
    governorate: input.governorate,
    city: input.city,
    district: input.district || input.city,
    addressAr: input.addressAr,
    coordinates: {
      lat: input.lat,
      lng: input.lng,
    },
    whatsappNumber: undefined,
    instapayHandle: "",
    vodafoneCashNumber: "",
    supplyStatus: "seeded_unclaimed",
    subscriptionTier: "free_founding",
    isSponsored: false,
    priceLastVerifiedDaysAgo: 0,
    priceLastVerifiedDate: input.priceLastVerifiedDate,
    avgReplyMinutes: 0,
    completenessScore: 60,
    rating: typeof input.rating === "number" ? input.rating : 0,
    reviewsCount: typeof input.reviewsCount === "number" ? input.reviewsCount : 0,
    heroImage: pickDeterministicPoolImage(input.id),
    publicDescriptionAr: input.publicDescriptionAr,
    sourcePublicNoteAr: input.addressAr,
    badges: [],
    specialtiesAr: input.specialtiesAr && input.specialtiesAr.length > 0 ? input.specialtiesAr : ["سباحة عامة"],
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

interface VerifiedOsmSeed {
  id: string;
  nameAr: string;
  nameEn: string;
  governorate: string;
  city: string;
  district: string;
  addressAr: string;
  lat: number;
  lng: number;
}

// Verified OpenStreetMap records across Egyptian governorates (real OSM IDs & coordinates)
const VERIFIED_OSM_EGYPT_SEEDS: VerifiedOsmSeed[] = [
  {
    id: "osm-W-30082371",
    nameAr: "نادي الصيد - الدقي",
    nameEn: "Shooting Club Dokki",
    governorate: "الجيزة",
    city: "الدقي",
    district: "المهندسين",
    addressAr: "شارع نادي الصيد، الدقي، المهندسين، الجيزة",
    lat: 30.0458526,
    lng: 31.2019202,
  },
  {
    id: "osm-W-1414278316",
    nameAr: "نادي الصيد - القطامية",
    nameEn: "Shooting Club Katameya",
    governorate: "القاهرة",
    city: "القاهرة الجديدة",
    district: "القطامية",
    addressAr: "القطامية، القاهرة الجديدة، القاهرة",
    lat: 29.985609,
    lng: 31.3315826,
  },
  {
    id: "osm-W-24763945",
    nameAr: "نادي الجزيرة الرياضي",
    nameEn: "Gezira Sporting Club",
    governorate: "القاهرة",
    city: "الزمالك",
    district: "الزمالك",
    addressAr: "الزمالك، القاهرة",
    lat: 30.0510522,
    lng: 31.2227101,
  },
  {
    id: "osm-N-10114233217",
    nameAr: "نادي الجزيرة الرياضي - فرع أكتوبر",
    nameEn: "Gezira Sporting Club October",
    governorate: "الجيزة",
    city: "الشيخ زايد",
    district: "الشيخ زايد",
    addressAr: "الشيخ زايد، 6 أكتوبر، الجيزة",
    lat: 30.0024248,
    lng: 31.0329537,
  },
  {
    id: "osm-W-24724656",
    nameAr: "نادي هليوبوليس الرياضي",
    nameEn: "Heliopolis Sporting Club",
    governorate: "القاهرة",
    city: "مصر الجديدة",
    district: "مصر الجديدة",
    addressAr: "مصر الجديدة، القاهرة",
    lat: 30.0885231,
    lng: 31.316423,
  },
  {
    id: "osm-W-39657084",
    nameAr: "نادي الزهور",
    nameEn: "Al Zohour Sporting Club",
    governorate: "القاهرة",
    city: "مدينة نصر",
    district: "مدينة نصر",
    addressAr: "مدينة نصر، القاهرة",
    lat: 30.0676364,
    lng: 31.3170465,
  },
  {
    id: "osm-W-455460856",
    nameAr: "حمام سباحة فندق ونادي النصر للقوات المسلحة",
    nameEn: "Al Nasr Armed Forces Swimming Pool",
    governorate: "القاهرة",
    city: "مدينة نصر",
    district: "مدينة نصر",
    addressAr: "مدينة نصر، القاهرة",
    lat: 30.0697921,
    lng: 31.3241382,
  },
  {
    id: "osm-W-210711927",
    nameAr: "نادي وادي دجلة - المعادي",
    nameEn: "Wadi Degla Club Maadi",
    governorate: "القاهرة",
    city: "المعادي",
    district: "زهراء المعادي",
    addressAr: "المعادي، القاهرة",
    lat: 29.9573817,
    lng: 31.314377,
  },
  {
    id: "osm-N-14115531848",
    nameAr: "نادي المعادي لضباط القوات المسلحة",
    nameEn: "Maadi Armed Forces Officers Club",
    governorate: "القاهرة",
    city: "المعادي",
    district: "المعادي",
    addressAr: "كورنيش المعادي، القاهرة",
    lat: 29.9717563,
    lng: 31.2357677,
  },
  {
    id: "osm-W-451332542",
    nameAr: "حمام سباحة كلية الزراعة - جامعة القاهرة",
    nameEn: "Swimming Pool, Faculty of Agriculture, Cairo University",
    governorate: "الجيزة",
    city: "الدقي",
    district: "جامعة القاهرة",
    addressAr: "كلية الزراعة، جامعة القاهرة، الجيزة",
    lat: 30.0155566,
    lng: 31.2094371,
  },
  {
    id: "osm-W-169992735",
    nameAr: "حمام السباحة - السادس من أكتوبر",
    nameEn: "6th of October Swimming Pool",
    governorate: "الجيزة",
    city: "6 أكتوبر",
    district: "الحي الخامس",
    addressAr: "طريق التحرير الجانبي، المجاورة أ3، الحي الخامس، السادس من أكتوبر، الجيزة",
    lat: 29.9444859,
    lng: 30.9168726,
  },
  {
    id: "osm-W-248205599",
    nameAr: "نادي وادي دجلة الرياضي - 6 أكتوبر",
    nameEn: "Wadi Degla Sporting Club 6th of October",
    governorate: "الجيزة",
    city: "6 أكتوبر",
    district: "السادس من أكتوبر",
    addressAr: "السادس من أكتوبر، الجيزة",
    lat: 29.9659336,
    lng: 30.9636688,
  },
  {
    id: "osm-W-28826168",
    nameAr: "نادي سموحة الرياضي",
    nameEn: "Smouha Sporting Club",
    governorate: "الإسكندرية",
    city: "سموحة",
    district: "سموحة",
    addressAr: "سموحة، الإسكندرية",
    lat: 31.2153578,
    lng: 29.9529355,
  },
  {
    id: "osm-W-28806216",
    nameAr: "نادي سبورتنج الإسكندرية",
    nameEn: "Alexandria Sporting Club",
    governorate: "الإسكندرية",
    city: "الإسكندرية",
    district: "سبورتنج",
    addressAr: "سبورتنج، الإسكندرية",
    lat: 31.2151913,
    lng: 29.9329114,
  },
  {
    id: "osm-N-14108499256",
    nameAr: "حمام سباحة نادي يو الرياضي",
    nameEn: "U Sporting Club Swimming Pool",
    governorate: "الإسكندرية",
    city: "الإسكندرية",
    district: "الإسكندرية",
    addressAr: "الإسكندرية، مصر",
    lat: 31.2249387,
    lng: 29.9788769,
  },
  {
    id: "osm-N-14111620628",
    nameAr: "حمام سباحة مجمع ساحات بشاير الخير",
    nameEn: "Bashaer El Kheir Swimming Pool",
    governorate: "الإسكندرية",
    city: "الإسكندرية",
    district: "غيط العنب",
    addressAr: "مجمع ساحات بشاير الخير، الإسكندرية",
    lat: 31.1766293,
    lng: 29.9027276,
  },
  {
    id: "osm-N-4518016489",
    nameAr: "نادي بلدية المحلة الكبرى",
    nameEn: "Baladiyat El Mahalla Club",
    governorate: "الغربية",
    city: "المحلة الكبرى",
    district: "شارع الجلاء",
    addressAr: "شارع الجلاء، المحلة الكبرى، محافظة الغربية",
    lat: 30.9811333,
    lng: 31.1722453,
  },
  {
    id: "osm-N-4517894795",
    nameAr: "نادي غزل المحلة",
    nameEn: "Ghazl El Mahalla Sporting Club",
    governorate: "الغربية",
    city: "المحلة الكبرى",
    district: "المحلة الكبرى",
    addressAr: "المحلة الكبرى، محافظة الغربية",
    lat: 30.9676664,
    lng: 31.1686099,
  },
  {
    id: "osm-W-203400559",
    nameAr: "نادي طنطا الرياضي",
    nameEn: "Tanta Sporting Club",
    governorate: "الغربية",
    city: "طنطا",
    district: "طنطا",
    addressAr: "طنطا، محافظة الغربية",
    lat: 30.7967998,
    lng: 30.9949373,
  },
  {
    id: "osm-N-2134128865",
    nameAr: "حمام سباحة - طنطا",
    nameEn: "Tanta Swimming Pool",
    governorate: "الغربية",
    city: "طنطا",
    district: "شارع الشهيد محمد الجندي",
    addressAr: "شارع الشهيد محمد الجندي، طنطا، محافظة الغربية",
    lat: 30.7970799,
    lng: 30.9966906,
  },
  {
    id: "osm-W-945029381",
    nameAr: "نادي الحوار للألعاب الرياضية",
    nameEn: "Al Hewar Sporting Club",
    governorate: "الدقهلية",
    city: "المنصورة",
    district: "المنصورة",
    addressAr: "المنصورة، محافظة الدقهلية",
    lat: 31.0470152,
    lng: 31.3614138,
  },
  {
    id: "osm-N-1123164865",
    nameAr: "حمام سباحة استاد السويس",
    nameEn: "Suez Stadium Swimming Pool",
    governorate: "السويس",
    city: "السويس",
    district: "السويس",
    addressAr: "استاد السويس، محافظة السويس",
    lat: 29.9615769,
    lng: 32.5381914,
  },
  {
    id: "osm-W-213219623",
    nameAr: "حمام سباحة - السقالة الغردقة",
    nameEn: "Swimming pool Sakkala Hurghada",
    governorate: "البحر الأحمر",
    city: "الغردقة",
    district: "السقالة",
    addressAr: "شارع النصر، السقالة، الهضبة، الغردقة، البحر الأحمر",
    lat: 27.1324632,
    lng: 33.8293366,
  },
];

function mapOsmSeedToFacility(seed: VerifiedOsmSeed): Facility {
  return buildPublicDirectoryFacility({
    id: seed.id,
    nameAr: seed.nameAr,
    nameEn: seed.nameEn,
    city: seed.city,
    governorate: seed.governorate,
    district: seed.district,
    addressAr: seed.addressAr,
    lat: seed.lat,
    lng: seed.lng,
    rating: 0,
    reviewsCount: 0,
    priceLastVerifiedDate: "دليل الخرائط العامة",
    publicDescriptionAr: `مسبح أو نادي رياضي مدرج في دليل OpenStreetMap العام (${seed.addressAr}).`,
  });
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

  return buildPublicDirectoryFacility({
    id: `gplace-${placeId}`,
    nameAr,
    nameEn: nameAr,
    city: cityLabel,
    governorate,
    district: formattedAddress.split("،")[0]?.trim() || cityLabel,
    addressAr: formattedAddress,
    lat: p.location?.latitude || 30.0444,
    lng: p.location?.longitude || 31.2357,
    rating: typeof p.rating === "number" ? p.rating : 0,
    reviewsCount: typeof p.userRatingCount === "number" ? p.userRatingCount : 0,
    priceLastVerifiedDate: "بيانات خرائط Google العامة",
    publicDescriptionAr:
      p.editorialSummary?.text ||
      `مسبح أو نادي سباحة مدرج في دليل خرائط Google (${formattedAddress}).`,
  });
}

const ALLOWED_OSM_KEYS = new Set(["leisure", "club", "sport", "amenity", "building", "landuse", "tourism"]);
const EXCLUDED_OSM_VALUES = new Set(["footway", "services", "bus_stop", "crossing", "traffic_signals", "parking"]);

function normalizePhotonFeatureToFacility(feature: PhotonFeature, rawCity: string): Facility | null {
  const props = feature.properties;
  const coords = feature.geometry?.coordinates;
  if (!props || props.countrycode !== "EG" || !props.name || !coords || coords.length < 2) return null;
  if (props.osm_key && !ALLOWED_OSM_KEYS.has(props.osm_key)) return null;
  if (props.osm_value && EXCLUDED_OSM_VALUES.has(props.osm_value)) return null;

  const osmType = (props.osm_type || "N").toUpperCase();
  const osmId = props.osm_id;
  if (!osmId) return null;

  const id = `osm-${osmType}-${osmId}`;
  const cleanCityInput =
    rawCity === "موقعك الحالي" || rawCity === "كل مصر"
      ? ""
      : rawCity.replace(/\s*\(GPS\)/g, "").trim();
  const rawAddressParts = [props.street, props.district, props.city || props.county, props.state]
    .filter((x): x is string => Boolean(x && x.trim()))
    .map((x) => x.trim());
  const formattedAddress =
    rawAddressParts.length > 0
      ? `${rawAddressParts.join("، ")}، مصر`
      : cleanCityInput && cleanCityInput !== "الكل"
        ? `${cleanCityInput}، مصر`
        : "مصر";
  const cityLabel = inferCityFromAddress(
    `${props.city || ""} ${props.state || ""} ${formattedAddress}`,
    cleanCityInput || "الكل"
  );
  const governorate = inferGovernorateFromCity(cityLabel, formattedAddress);

  return buildPublicDirectoryFacility({
    id,
    nameAr: String(props.name).trim(),
    nameEn: String(props.name).trim(),
    city: cityLabel,
    governorate,
    district: props.district || props.city || cityLabel,
    addressAr: formattedAddress,
    lat: coords[1],
    lng: coords[0],
    rating: 0,
    reviewsCount: 0,
    priceLastVerifiedDate: "دليل الخرائط العامة",
    publicDescriptionAr: `مسبح أو نادي رياضي مدرج في دليل OpenStreetMap العام (${formattedAddress}).`,
  });
}

function normalizeNominatimItemToFacility(item: NominatimItem, fallbackId: string, rawCity: string): Facility | null {
  if (!item.lat || !item.lon) return null;
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const displayName = String(item.display_name || "مصر");
  const nameAr = String(item.name || displayName.split("،")[0] || "مسبح أو نادي سباحة").trim();
  const cleanCityInput =
    rawCity === "موقعك الحالي" || rawCity === "كل مصر"
      ? ""
      : rawCity.replace(/\s*\(GPS\)/g, "").trim();
  const cityLabel = inferCityFromAddress(displayName, cleanCityInput || "الكل");
  const governorate = inferGovernorateFromCity(cityLabel, displayName);
  const osmPrefix =
    item.osm_type === "way" ? "W" : item.osm_type === "relation" ? "R" : item.osm_type === "node" ? "N" : "";
  const resolvedId = osmPrefix && item.osm_id ? `osm-${osmPrefix}-${item.osm_id}` : fallbackId;

  return buildPublicDirectoryFacility({
    id: resolvedId,
    nameAr,
    nameEn: nameAr,
    city: cityLabel,
    governorate,
    district:
      item.address?.suburb ||
      item.address?.neighbourhood ||
      item.address?.city_district ||
      cityLabel,
    addressAr: displayName,
    lat,
    lng,
    rating: 0,
    reviewsCount: 0,
    priceLastVerifiedDate: "دليل الخرائط العامة",
    publicDescriptionAr: `مسبح أو نادي رياضي مدرج في دليل OpenStreetMap العام (${displayName}).`,
  });
}

async function fetchPhotonOsmResults(
  queryText: string,
  rawCity: string,
  biasCoords?: { lat: number; lng: number },
  limit = 12
): Promise<Facility[]> {
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", queryText);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("lang", "default");
    if (biasCoords) {
      url.searchParams.set("lat", String(biasCoords.lat));
      url.searchParams.set("lon", String(biasCoords.lng));
    }

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": OSM_USER_AGENT },
      signal: AbortSignal.timeout(4500),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const features = Array.isArray(data.features) ? data.features : [];
    return features
      .map((f) => normalizePhotonFeatureToFacility(f, rawCity))
      .filter((f): f is Facility => Boolean(f));
  } catch {
    return [];
  }
}

async function fetchNominatimLookup(osmPlaceId: string, rawCity: string): Promise<Facility | null> {
  const match = osmPlaceId.match(/^osm-(N|W|R|node|way|relation)-(\d+)$/i);
  if (!match) return null;
  const prefixRaw = match[1].toUpperCase();
  const prefix =
    prefixRaw === "NODE" ? "N" : prefixRaw === "WAY" ? "W" : prefixRaw === "RELATION" ? "R" : prefixRaw;
  const osmParam = `${prefix}${match[2]}`;

  try {
    const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${encodeURIComponent(
      osmParam
    )}&format=jsonv2&addressdetails=1&accept-language=ar`;
    const res = await fetch(url, {
      headers: { "User-Agent": OSM_USER_AGENT, "Accept-Language": "ar" },
      signal: AbortSignal.timeout(4500),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as NominatimItem[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return normalizeNominatimItemToFacility(rows[0], osmPlaceId, rawCity);
  } catch {
    return null;
  }
}

function getInterleavedEgyptOsmFacilities(): Facility[] {
  const mapped = VERIFIED_OSM_EGYPT_SEEDS.map(mapOsmSeedToFacility);
  const buckets = new Map<string, Facility[]>();
  for (const f of mapped) {
    const key =
      f.governorate === "القاهرة"
        ? "cairo"
        : f.governorate === "الجيزة"
          ? "giza"
          : f.governorate === "الإسكندرية"
            ? "alex"
            : ["الغربية", "الدقهلية"].includes(f.governorate)
              ? "delta"
              : "other";
    const list = buckets.get(key) || [];
    list.push(f);
    buckets.set(key, list);
  }
  const orderedLists = ["cairo", "giza", "delta", "alex", "other"]
    .map((k) => buckets.get(k) || [])
    .filter((l) => l.length > 0);
  const interleaved: Facility[] = [];
  const maxLen = Math.max(0, ...orderedLists.map((l) => l.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (const list of orderedLists) {
      if (list[i]) interleaved.push(list[i]);
    }
  }
  return interleaved;
}

function matchOsmSeeds(options: {
  rawQuery: string;
  cleanCity: string;
  biasCoords?: { lat: number; lng: number };
}): Facility[] {
  const { rawQuery, cleanCity, biasCoords } = options;
  const qLower = rawQuery.trim().toLowerCase();
  const cityLower = cleanCity.trim().toLowerCase();

  let candidates = VERIFIED_OSM_EGYPT_SEEDS.map(mapOsmSeedToFacility);

  if (qLower) {
    candidates = candidates.filter((f) => {
      const hay = `${f.nameAr} ${f.nameEn} ${f.city} ${f.governorate} ${f.district} ${f.addressAr}`.toLowerCase();
      return hay.includes(qLower);
    });
  } else if (cityLower) {
    candidates = candidates.filter((f) => {
      const hay = `${f.city} ${f.governorate} ${f.district} ${f.addressAr}`.toLowerCase();
      const matchesText = hay.includes(cityLower);
      const withinRadius = biasCoords
        ? calculateDistanceKm(biasCoords.lat, biasCoords.lng, f.coordinates.lat, f.coordinates.lng) <= 25
        : false;
      return matchesText || withinRadius;
    });
  } else if (biasCoords) {
    candidates = candidates.filter(
      (f) => calculateDistanceKm(biasCoords.lat, biasCoords.lng, f.coordinates.lat, f.coordinates.lng) <= 25
    );
  }

  if (biasCoords) {
    candidates.sort(
      (a, b) =>
        calculateDistanceKm(biasCoords.lat, biasCoords.lng, a.coordinates.lat, a.coordinates.lng) -
        calculateDistanceKm(biasCoords.lat, biasCoords.lng, b.coordinates.lat, b.coordinates.lng)
    );
  }
  return candidates;
}

function deduplicateFacilities(primary: Facility[], secondary: Facility[]): Facility[] {
  const merged: Facility[] = [];
  const seenIds = new Set<string>();
  for (const item of [...primary, ...secondary]) {
    if (!item.id || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    merged.push(item);
  }
  return merged;
}

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_SERVER_API_KEY?.trim();

  const { searchParams } = new URL(request.url);
  const placeId = (searchParams.get("placeId") || "").trim();
  const rawQuery = (searchParams.get("q") || "").trim();
  const rawCity = (searchParams.get("city") || "الكل").trim();
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const parsedLat = latStr ? Number(latStr) : NaN;
  const parsedLng = lngStr ? Number(lngStr) : NaN;
  const hasCoords = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

  // 1. Single-place lookup for direct /academy/gplace-... or /academy/osm-... page loads
  if (placeId) {
    const cachedSingle = placeByIdCache.get(placeId);
    if (cachedSingle) {
      return NextResponse.json({ ok: true, places: [cachedSingle], source: "cache" });
    }

    if (placeId.startsWith("osm-")) {
      const matchedSeed = VERIFIED_OSM_EGYPT_SEEDS.find((s) => s.id === placeId);
      if (matchedSeed) {
        const mappedSeed = mapOsmSeedToFacility(matchedSeed);
        indexFacilities([mappedSeed]);
        return NextResponse.json({ ok: true, places: [mappedSeed], source: "osm" });
      }
      const nominatimHit = await fetchNominatimLookup(placeId, rawCity);
      if (nominatimHit) {
        indexFacilities([nominatimHit]);
        return NextResponse.json({ ok: true, places: [nominatimHit], source: "osm" });
      }
      return NextResponse.json({ ok: false, places: [], reason: "osm_place_not_found" });
    }

    if (!apiKey) {
      return NextResponse.json({ ok: false, places: [], reason: "no_places_key" });
    }

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
      if (mapped) indexFacilities([mapped]);
      return NextResponse.json({ ok: true, places: mapped ? [mapped] : [], source: "google" });
    } catch {
      return NextResponse.json({ ok: false, places: [], reason: "place_detail_failed" });
    }
  }

  const scopeParam = (searchParams.get("scope") || "").trim();
  const isEgyptWide =
    scopeParam === "egypt" ||
    rawCity === "كل مصر" ||
    (!rawQuery && rawCity === "الكل" && !hasCoords);

  const cleanCityForText =
    scopeParam === "egypt"
      ? ""
      : rawCity !== "الكل" && rawCity !== "كل مصر" && rawCity !== "موقعك الحالي"
        ? rawCity.replace(/\s*\(GPS\)/g, "").trim()
        : "";

  const cacheKey = [
    scopeParam || (isEgyptWide ? "egypt" : "local"),
    cleanCityForText || rawCity,
    rawQuery.toLowerCase(),
    hasCoords ? `${parsedLat.toFixed(2)},${parsedLng.toFixed(2)}` : "",
  ].join("|");

  const now = Date.now();
  const cachedEntry = placesQueryCache.get(cacheKey);
  if (cachedEntry && now - cachedEntry.fetchedAt < FRESH_TTL_MS && cachedEntry.places.length > 0) {
    return NextResponse.json({
      ok: true,
      places: cachedEntry.places,
      scope: cachedEntry.scope,
      source: "cache",
    });
  }

  const fetchGoogleSearchText = async (
    textQuery: string,
    biasCoords?: { lat: number; lng: number },
    limit = 15
  ) => {
    if (!apiKey) return { ok: false, status: 401, items: [] as GooglePlaceItem[] };
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
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.editorialSummary",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, status: res.status, items: [] as GooglePlaceItem[] };
      const data = (await res.json()) as { places?: GooglePlaceItem[] };
      return {
        ok: true,
        status: 200,
        items: Array.isArray(data.places) ? data.places : [],
      };
    } catch {
      return { ok: false, status: 504, items: [] as GooglePlaceItem[] };
    }
  };

  // 2. Primary Provider: Google Places API (when API key + billing active)
  if (apiKey) {
    if (isEgyptWide && !rawQuery) {
      const queries = [
        "حمامات سباحة وأكاديميات سباحة في القاهرة والجيزة",
        "حمامات سباحة وأندية سباحة في الإسكندرية والساحل",
        "أكاديميات سباحة وحمامات سباحة في الدلتا والمنصورة وطنطا والمحلة",
      ];
      const settled = await Promise.all(
        queries.map((qText) => fetchGoogleSearchText(qText, undefined, 8))
      );
      const anyGoogleSuccess = settled.some((s) => s.ok && s.items.length > 0);
      if (anyGoogleSuccess) {
        const lists = settled.map((s) =>
          s.items
            .map((item) => normalizeGooglePlaceToFacility(item, "كل مصر"))
            .filter((f): f is Facility => Boolean(f))
        );
        const interleaved: Facility[] = [];
        const seen = new Set<string>();
        const maxLen = Math.max(0, ...lists.map((l) => l.length));
        for (let i = 0; i < maxLen; i += 1) {
          for (const list of lists) {
            const item = list[i];
            if (item && !seen.has(item.id)) {
              seen.add(item.id);
              interleaved.push(item);
            }
          }
        }
        if (interleaved.length > 0) {
          setQueryCache(cacheKey, {
            places: interleaved,
            scope: "egypt",
            source: "google",
            fetchedAt: now,
          });
          return NextResponse.json({
            ok: true,
            places: interleaved,
            scope: "egypt",
            source: "google",
          });
        }
      }
    } else {
      const textQuery = rawQuery
        ? cleanCityForText
          ? `حمام سباحة ونادي سباحة ${rawQuery} ${cleanCityForText}`.trim()
          : `حمام سباحة ونادي سباحة وأكاديمية سباحة ${rawQuery} مصر`.trim()
        : cleanCityForText
          ? `حمامات سباحة وأكاديميات سباحة ونوادي في ${cleanCityForText}`
          : "حمامات سباحة وأكاديميات سباحة قريبة في مصر";

      const useBiasCoords =
        hasCoords && scopeParam !== "egypt" && !rawQuery
          ? { lat: parsedLat, lng: parsedLng }
          : undefined;

      const result = await fetchGoogleSearchText(textQuery, useBiasCoords, 18);
      if (result.ok && result.items.length > 0) {
        const normalized = result.items
          .map((item) => normalizeGooglePlaceToFacility(item, rawCity))
          .filter((f): f is Facility => Boolean(f));
        if (normalized.length > 0) {
          setQueryCache(cacheKey, {
            places: normalized,
            source: "google",
            fetchedAt: now,
          });
          return NextResponse.json({
            ok: true,
            places: normalized,
            source: "google",
          });
        }
      }
    }
  }

  // 3. Stale Cache Fallback (up to 72 hours) if upstream Google failed
  if (cachedEntry && now - cachedEntry.fetchedAt < STALE_TTL_MS && cachedEntry.places.length > 0) {
    return NextResponse.json({
      ok: true,
      places: cachedEntry.places,
      scope: cachedEntry.scope,
      source: "cache",
    });
  }

  // 4. OpenStreetMap Automatic Fallback (Photon + Verified Egypt OSM Index)
  if (isEgyptWide && !rawQuery) {
    const egyptSeeds = getInterleavedEgyptOsmFacilities();
    const liveOsmPools = await fetchPhotonOsmResults("حمام سباحة", "كل مصر", { lat: 30.0444, lng: 31.2357 }, 12);
    const merged = deduplicateFacilities(egyptSeeds, liveOsmPools);
    setQueryCache(cacheKey, {
      places: merged,
      scope: "egypt",
      source: "osm",
      fetchedAt: now,
    });
    return NextResponse.json({
      ok: true,
      places: merged,
      scope: "egypt",
      source: "osm",
    });
  }

  const useBiasCoords = hasCoords ? { lat: parsedLat, lng: parsedLng } : undefined;
  const seedMatches = matchOsmSeeds({
    rawQuery,
    cleanCity: cleanCityForText,
    biasCoords: useBiasCoords,
  });

  const osmSearchTerms: string[] = [];
  if (rawQuery) {
    osmSearchTerms.push(cleanCityForText ? `${rawQuery} ${cleanCityForText}` : rawQuery);
  } else if (cleanCityForText) {
    osmSearchTerms.push(`حمام سباحة ${cleanCityForText}`);
    osmSearchTerms.push(`نادي رياضي ${cleanCityForText}`);
  } else {
    osmSearchTerms.push("حمام سباحة");
  }

  const photonResultsArrays = await Promise.all(
    osmSearchTerms.map((term) => fetchPhotonOsmResults(term, rawCity, useBiasCoords, 10))
  );
  let liveOsmMatches = deduplicateFacilities([], photonResultsArrays.flat());

  // When searching a city without custom query, constrain live OSM hits to that city or 25km radius if coordinates provided
  if (!rawQuery && (cleanCityForText || useBiasCoords)) {
    const cityNorm = cleanCityForText.toLowerCase();
    liveOsmMatches = liveOsmMatches.filter((f) => {
      const textMatch =
        cityNorm.length > 0 &&
        `${f.nameAr} ${f.city} ${f.governorate} ${f.district} ${f.addressAr}`.toLowerCase().includes(cityNorm);
      const radiusMatch = useBiasCoords
        ? calculateDistanceKm(useBiasCoords.lat, useBiasCoords.lng, f.coordinates.lat, f.coordinates.lng) <= 25
        : false;
      return textMatch || radiusMatch;
    });
  }

  const finalPlaces = deduplicateFacilities(seedMatches, liveOsmMatches);
  if (finalPlaces.length > 0) {
    setQueryCache(cacheKey, {
      places: finalPlaces,
      source: "osm",
      fetchedAt: now,
    });
  }

  return NextResponse.json({
    ok: true,
    places: finalPlaces,
    source: "osm",
  });
}
