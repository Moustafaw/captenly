import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CachedPhotoEntry {
  url: string | null;
  ts: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 60 * 1000;
const PHOTO_CACHE = new Map<string, CachedPhotoEntry>();

const SOCIAL_ONLY_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "fb.com",
  "instagram.com",
  "www.instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "www.youtube.com",
  "tiktok.com",
  "www.tiktok.com",
]);

function isSafePublicHttpUrl(raw?: string | null): URL | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const host = parsed.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
      return null;
    }
    if (
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host === "::1" ||
      host === "[::1]"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function resolveGooglePlacePhoto(photoName: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_SERVER_API_KEY?.trim();
  if (!apiKey || !/^places\/[^/]+\/photos\/[^/]+$/.test(photoName)) return null;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&skipHttpRedirect=true`,
      {
        headers: { "X-Goog-Api-Key": apiKey },
        signal: AbortSignal.timeout(2500),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { photoUri?: string };
    return isSafePublicHttpUrl(data?.photoUri)?.toString() || null;
  } catch {
    return null;
  }
}

function cleanPlaceTitleForWiki(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const candidates = new Set<string>([trimmed]);

  // Strip common swimming-pool / branch modifiers to find the parent club Wikipedia article
  const strippedAr = trimmed
    .replace(/^حمامات?\s+سباحة\s+/i, "")
    .replace(/^مسبح\s+/i, "")
    .replace(/^أكاديمية\s+سباحة\s+/i, "")
    .replace(/\s*[-–—]\s*(فرع\s+)?(المعادي|مدينة نصر|الزمالك|6 أكتوبر|السادس من أكتوبر|سموحة|الشيخ زايد|التجمع|القاهرة|الجيزة|الإسكندرية).*$/i, "")
    .replace(/\s+الرياضي$/i, "")
    .trim();
  if (strippedAr && strippedAr.length >= 4) candidates.add(strippedAr);

  const strippedEn = trimmed
    .replace(/\b(swimming\s+pool|aquatics?\s+center|club\s+house)\b/gi, "")
    .replace(/\s*[-–—]\s*(Maadi|Nasr City|Zamalek|6th of October|Smouha|Giza|Cairo|Alexandria).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (strippedEn && strippedEn.length >= 4) {
    candidates.add(strippedEn);
    if (/club$/i.test(strippedEn)) {
      candidates.add(strippedEn.replace(/\s+Sporting Club$/i, " SC").replace(/\s+Club$/i, " SC"));
    }
  }

  return Array.from(candidates);
}

async function queryWikipediaPageImages(lang: "ar" | "en", titles: string[]): Promise<string | null> {
  if (titles.length === 0) return null;
  try {
    const joined = titles.slice(0, 4).join("|");
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      joined
    )}&prop=pageimages&piprop=thumbnail|original&pithumbsize=600&pilicense=any&redirects=1&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CaptenlyApp/1.0 (https://captenly.vercel.app)" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source?: string }; original?: { source?: string } }> };
    };
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    for (const page of pages) {
      const candidate = page?.thumbnail?.source || page?.original?.source;
      const safe = isSafePublicHttpUrl(candidate);
      if (safe) return safe.toString();
    }
  } catch {
    // Ignore wiki lookup errors
  }
  return null;
}

async function searchWikipediaClubImage(lang: "ar" | "en", queryTitle: string): Promise<string | null> {
  if (queryTitle.trim().length < 5) return null;
  // Only search Wikipedia for notable clubs / stadiums / academies to avoid false person hits
  if (lang === "ar" && !/(نادي|إستاد|ستاد|القرية الأوليمبية|مركز شباب)/.test(queryTitle)) {
    return null;
  }
  if (lang === "en" && !/(club|stadium|sporting|olympic|aquatic)/i.test(queryTitle)) {
    return null;
  }

  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      queryTitle
    )}&gsrlimit=2&prop=pageimages&piprop=thumbnail|original&pithumbsize=600&pilicense=any&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CaptenlyApp/1.0 (https://captenly.vercel.app)" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; thumbnail?: { source?: string }; original?: { source?: string } }
        >;
      };
    };
    const tokens = queryTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !["نادي", "الرياضي", "club", "sporting", "the"].includes(t));
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    for (const page of pages) {
      const pageTitle = (page.title || "").toLowerCase();
      if (lang === "ar" && !/(نادي|ستاد|إستاد|اوليمبي|أوليمبي|مركز)/.test(pageTitle)) continue;
      if (tokens.length > 0 && !tokens.some((tok) => pageTitle.includes(tok))) continue;
      const candidate = page?.thumbnail?.source || page?.original?.source;
      const safe = isSafePublicHttpUrl(candidate);
      if (safe) return safe.toString();
    }
  } catch {
    // Ignore wiki search failures
  }
  return null;
}

function extractMetaImageFromHtml(html: string, baseUrl: URL): string | null {
  const patterns = [
    /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]*>/i,
    /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/i,
    /<link[^>]+rel=["'](?:shortcut\s+)?icon["'][^>]+href=["']([^"']+)["'][^>]*>/i,
  ];
  for (const regex of patterns) {
    const match = html.match(regex);
    if (match?.[1]) {
      try {
        const resolved = new URL(match[1].trim(), baseUrl.origin);
        const safe = isSafePublicHttpUrl(resolved.toString());
        if (safe) return safe.toString();
      } catch {
        // continue trying other patterns
      }
    }
  }
  return null;
}

async function resolveWebsiteImageOrLogo(websiteRaw: string): Promise<string | null> {
  const parsed = isSafePublicHttpUrl(websiteRaw);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  if (SOCIAL_ONLY_HOSTS.has(host)) return null;

  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CaptenlyBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (res.ok) {
      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      if (ctype.includes("text/html") || ctype.includes("application/xhtml")) {
        const finalUrl = isSafePublicHttpUrl(res.url) || parsed;
        const html = (await res.text()).slice(0, 65000);
        const metaImg = extractMetaImageFromHtml(html, finalUrl);
        if (metaImg) return metaImg;
      }
    }
  } catch {
    // Fall back to domain icon service below
  }

  return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(
    parsed.origin
  )}&size=256`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nameAr = (searchParams.get("name") || "").trim();
  const nameEn = (searchParams.get("en") || "").trim();
  const website = (searchParams.get("website") || "").trim();
  const wikiParam = (searchParams.get("wiki") || "").trim();
  const directImg = (searchParams.get("img") || "").trim();
  const photoName = (searchParams.get("photoName") || "").trim();

  const cacheKey = `${photoName}|${directImg}|${wikiParam}|${website}|${nameAr}|${nameEn}`.toLowerCase();
  const cached = PHOTO_CACHE.get(cacheKey);
  const now = Date.now();
  if (cached) {
    const ttl = cached.url ? CACHE_TTL_MS : NEGATIVE_TTL_MS;
    if (now - cached.ts < ttl) {
      if (cached.url) {
        return NextResponse.redirect(cached.url, {
          status: 302,
          headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
        });
      }
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
      });
    }
  }

  let resolvedUrl: string | null = null;

  // 1. Direct verified OSM image tag
  const safeDirect = isSafePublicHttpUrl(directImg);
  if (safeDirect) {
    resolvedUrl = safeDirect.toString();
  }

  // 2. Google Place Photo resource (if billing / photo SKU is available)
  if (!resolvedUrl && photoName) {
    resolvedUrl = await resolveGooglePlacePhoto(photoName);
  }

  // 3. Explicit OSM wikipedia tag (e.g., "ar:نادي سموحة" or "en:Smouha SC")
  if (!resolvedUrl && wikiParam) {
    const colonIdx = wikiParam.indexOf(":");
    const wikiLang = colonIdx > 0 && wikiParam.slice(0, colonIdx) === "en" ? "en" : "ar";
    const wikiTitle = colonIdx > 0 ? wikiParam.slice(colonIdx + 1).trim() : wikiParam;
    if (wikiTitle) {
      resolvedUrl = await queryWikipediaPageImages(wikiLang, [wikiTitle]);
    }
  }

  // 4. Wikipedia Arabic & English club / stadium lookup (image or club logo via pilicense=any)
  if (!resolvedUrl && nameAr) {
    const arCandidates = cleanPlaceTitleForWiki(nameAr);
    resolvedUrl = await queryWikipediaPageImages("ar", arCandidates);
    if (!resolvedUrl && arCandidates[0]) {
      resolvedUrl = await searchWikipediaClubImage("ar", arCandidates[arCandidates.length - 1]);
    }
  }
  if (!resolvedUrl && nameEn && nameEn !== nameAr) {
    const enCandidates = cleanPlaceTitleForWiki(nameEn);
    resolvedUrl = await queryWikipediaPageImages("en", enCandidates);
    if (!resolvedUrl && enCandidates[0]) {
      resolvedUrl = await searchWikipediaClubImage("en", enCandidates[enCandidates.length - 1]);
    }
  }

  // 5. Official club/academy website og:image / apple-touch-icon / brand logo
  if (!resolvedUrl && website) {
    resolvedUrl = await resolveWebsiteImageOrLogo(website);
  }

  PHOTO_CACHE.set(cacheKey, { url: resolvedUrl, ts: now });

  if (resolvedUrl) {
    return NextResponse.redirect(resolvedUrl, {
      status: 302,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    });
  }

  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
