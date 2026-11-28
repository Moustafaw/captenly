import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CachedPhotoEntry {
  url: string | null;
  ts: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CACHED_IMAGE_BYTES = 200_000;
const PHOTO_CACHE = new Map<string, CachedPhotoEntry>();

interface CachedImageBytes {
  bytes: ArrayBuffer;
  contentType: string;
  ts: number;
}

const IMAGE_BYTES_CACHE = new Map<string, CachedImageBytes>();

function setLruCacheEntry<T>(cache: Map<string, T>, key: string, value: T, maxEntries: number): void {
  if (cache.has(key)) {
    cache.delete(key);
  }
  while (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
  cache.set(key, value);
}

function getLruCacheEntry<T>(cache: Map<string, T>, key: string): T | undefined {
  const entry = cache.get(key);
  if (entry === undefined) return undefined;
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

async function readBoundedResponseBytes(res: Response, maxBytes: number): Promise<ArrayBuffer | null> {
  const contentLengthHeader = res.headers.get("content-length");
  if (contentLengthHeader) {
    const declared = Number(contentLengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return null;
    }
  }
  if (!res.body) {
    const buf = await res.arrayBuffer();
    return buf.byteLength > 0 && buf.byteLength <= maxBytes ? buf : null;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  if (total === 0) return null;
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

// 1x1 transparent PNG so missing directory photos return 200 OK instead of 404 console errors;
// FacilityImageOrFallback checks naturalWidth < 24 and renders the branded fallback card.
const TRANSPARENT_1X1_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function emptyTransparentImageResponse(maxAgeSeconds = 3600): NextResponse {
  return new NextResponse(TRANSPARENT_1X1_PNG, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function fetchSafeImageBytes(
  startUrl: string
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const now = Date.now();
  const cachedBytes = getLruCacheEntry(IMAGE_BYTES_CACHE, startUrl);
  if (cachedBytes && now - cachedBytes.ts < CACHE_TTL_MS) {
    return { bytes: cachedBytes.bytes, contentType: cachedBytes.contentType };
  }
  if (cachedBytes) {
    IMAGE_BYTES_CACHE.delete(startUrl);
  }

  let currentUrl = isSafePublicHttpUrl(startUrl);
  if (!currentUrl) return null;

  try {
    let res: Response | null = null;
    for (let hop = 0; hop < 3; hop += 1) {
      res = await fetch(currentUrl.toString(), {
        headers: {
          "User-Agent": "CaptenlyApp/1.0 (https://captenly.vercel.app)",
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(2800),
        cache: "no-store",
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        const nextUrl = isSafePublicHttpUrl(new URL(loc, currentUrl.origin).toString());
        if (!nextUrl) return null;
        currentUrl = nextUrl;
        continue;
      }
      break;
    }

    if (!res || !res.ok) return null;
    const rawContentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(rawContentType)) return null;

    const bytes = await readBoundedResponseBytes(res, MAX_IMAGE_BYTES);
    if (!bytes) return null;

    if (bytes.byteLength <= MAX_CACHED_IMAGE_BYTES) {
      setLruCacheEntry(
        IMAGE_BYTES_CACHE,
        startUrl,
        { bytes, contentType: rawContentType, ts: now },
        MAX_CACHE_ENTRIES
      );
    }
    return { bytes, contentType: rawContentType };
  } catch {
    return null;
  }
}

async function respondWithProxiedImage(resolvedUrl: string): Promise<NextResponse> {
  const payload = await fetchSafeImageBytes(resolvedUrl);
  if (!payload) {
    return emptyTransparentImageResponse(1800);
  }
  return new NextResponse(payload.bytes, {
    status: 200,
    headers: {
      "Content-Type": payload.contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

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

const TRUSTED_IMAGE_EXACT_HOSTS = new Set([
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "places.googleapis.com",
  "maps.gstatic.com",
  "t2.gstatic.com",
]);

function isTrustedImageRedirectHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (TRUSTED_IMAGE_EXACT_HOSTS.has(host)) return true;
  if (/^lh[3-6]\.googleusercontent\.com$/.test(host)) return true;
  return false;
}

function isSafePublicHttpUrl(raw?: string | null): URL | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.username || parsed.password) return null;
    const rawHost = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      !rawHost ||
      rawHost === "localhost" ||
      rawHost.endsWith(".local") ||
      rawHost.endsWith(".internal") ||
      rawHost === "0.0.0.0" ||
      rawHost === "::" ||
      rawHost === "::1" ||
      rawHost === "0:0:0:0:0:0:0:0" ||
      rawHost === "0:0:0:0:0:0:0:1"
    ) {
      return null;
    }
    if (
      /^0\./.test(rawHost) ||
      /^127\./.test(rawHost) ||
      /^10\./.test(rawHost) ||
      /^192\.168\./.test(rawHost) ||
      /^169\.254\./.test(rawHost) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(rawHost) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(rawHost) ||
      /^(::ffff:|fe80|fc00|fd[0-9a-f]{2})/i.test(rawHost) ||
      /^\d+$/.test(rawHost) ||
      /^0x[0-9a-f]+$/i.test(rawHost)
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
      redirect: "manual",
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      const redirectUrl = location ? isSafePublicHttpUrl(new URL(location, parsed.origin).toString()) : null;
      if (!redirectUrl || SOCIAL_ONLY_HOSTS.has(redirectUrl.hostname.toLowerCase())) {
        return null;
      }
      const followed = await fetch(redirectUrl.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CaptenlyBot/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(2000),
        cache: "no-store",
      });
      if (followed.ok) {
        const ctype = (followed.headers.get("content-type") || "").toLowerCase();
        if (ctype.includes("text/html") || ctype.includes("application/xhtml")) {
          const html = (await followed.text()).slice(0, 65000);
          const metaImg = extractMetaImageFromHtml(html, redirectUrl);
          if (metaImg) return metaImg;
        }
      }
    } else if (res.ok) {
      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      if (ctype.includes("text/html") || ctype.includes("application/xhtml")) {
        const html = (await res.text()).slice(0, 65000);
        const metaImg = extractMetaImageFromHtml(html, parsed);
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

  // 1. Direct verified OSM image tag — strict allowlist to prevent Open Redirect (F-009)
  if (directImg) {
    const safeDirect = isSafePublicHttpUrl(directImg);
    if (!safeDirect || !isTrustedImageRedirectHost(safeDirect.hostname)) {
      return NextResponse.json(
        { ok: false, error: "untrusted_image_host" },
        { status: 400 }
      );
    }
    return NextResponse.redirect(safeDirect.toString(), {
      status: 302,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    });
  }

  // Reject unsafe website SSRF targets before proceeding
  if (website && !isSafePublicHttpUrl(website)) {
    return NextResponse.json(
      { ok: false, error: "unsafe_website_url" },
      { status: 400 }
    );
  }

  const cached = getLruCacheEntry(PHOTO_CACHE, cacheKey);
  const now = Date.now();
  if (cached) {
    const ttl = cached.url ? CACHE_TTL_MS : NEGATIVE_TTL_MS;
    if (now - cached.ts < ttl) {
      if (cached.url) {
        return respondWithProxiedImage(cached.url);
      }
      return emptyTransparentImageResponse(3600);
    }
    PHOTO_CACHE.delete(cacheKey);
  }

  let resolvedUrl: string | null = null;

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

  setLruCacheEntry(PHOTO_CACHE, cacheKey, { url: resolvedUrl, ts: now }, MAX_CACHE_ENTRIES);

  if (resolvedUrl) {
    return respondWithProxiedImage(resolvedUrl);
  }

  return emptyTransparentImageResponse(3600);
}
