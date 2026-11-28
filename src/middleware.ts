import { NextResponse, type NextRequest } from "next/server";

function buildAllowedOrigins(req: NextRequest): Set<string> {
  const allowed = new Set<string>([
    req.nextUrl.origin,
    "https://captenly.vercel.app",
    "https://captenly.com",
    "https://www.captenly.com",
  ]);

  for (const rawUrl of [
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]) {
    if (!rawUrl) continue;
    try {
      allowed.add(new URL(rawUrl).origin);
    } catch {
      // Ignore malformed env origin
    }
  }

  return allowed;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getEffectiveHostname(req: NextRequest): string {
  const raw =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.hostname ||
    "";
  return raw.split(",")[0].trim().replace(/:\d+$/, "").toLowerCase();
}

function getEffectiveOrigin(req: NextRequest): string {
  const rawHost = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""
  )
    .split(",")[0]
    ?.trim();
  const rawProto = (req.headers.get("x-forwarded-proto") || "")
    .split(",")[0]
    ?.trim();
  if (rawHost) {
    const hostOnly = rawHost.replace(/:\d+$/, "").toLowerCase();
    const proto = rawProto || (isLocalHostname(hostOnly) ? "http" : "https");
    return `${proto}://${rawHost}`;
  }
  return req.nextUrl.origin;
}

const STATIC_ASSET_EXT_RE =
  /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|eot|css|js|mjs|map|json|txt|xml|webmanifest)$/i;

function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/screens/") ||
    STATIC_ASSET_EXT_RE.test(pathname)
  );
}

function isAllowedOrigin(originHeader: string, req: NextRequest): boolean {
  if (!originHeader) return true;
  const effectiveHost = getEffectiveHostname(req);
  const allowed = buildAllowedOrigins(req);
  if (allowed.has(originHeader)) return true;

  try {
    const parsed = new URL(originHeader);
    if (
      (process.env.NODE_ENV !== "production" || isLocalHostname(effectiveHost)) &&
      isLocalHostname(parsed.hostname)
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function applyHstsIfProductionHttps(req: NextRequest, res: NextResponse): void {
  const forwardedProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0]?.trim();
  const proto = forwardedProto || req.nextUrl.protocol.replace(":", "");
  const effectiveHost = getEffectiveHostname(req);
  if (
    process.env.NODE_ENV === "production" &&
    proto === "https" &&
    !isLocalHostname(effectiveHost)
  ) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains"
    );
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = (req.headers.get("origin") || "").trim();

  if (pathname.startsWith("/api/")) {
    const isOAuthCallback = pathname.startsWith("/api/auth/callback/");
    if (origin && !isOAuthCallback && !isAllowedOrigin(origin, req)) {
      const blocked = NextResponse.json(
        { ok: false, error: "forbidden_cors_origin" },
        { status: 403 }
      );
      blocked.headers.set("Vary", "Origin");
      applyHstsIfProductionHttps(req, blocked);
      return blocked;
    }

    if (req.method === "OPTIONS") {
      const preflight = new NextResponse(null, { status: 204 });
      if (origin && isAllowedOrigin(origin, req)) {
        preflight.headers.set("Access-Control-Allow-Origin", origin);
        preflight.headers.set("Access-Control-Allow-Credentials", "true");
        preflight.headers.set(
          "Access-Control-Allow-Methods",
          "GET, POST, PATCH, PUT, DELETE, OPTIONS"
        );
        preflight.headers.set(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Requested-With"
        );
      }
      preflight.headers.set("Vary", "Origin");
      applyHstsIfProductionHttps(req, preflight);
      return preflight;
    }

    const res = NextResponse.next();
    if (origin && isAllowedOrigin(origin, req)) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    res.headers.set("Vary", "Origin");
    applyHstsIfProductionHttps(req, res);
    return res;
  }

  const res = NextResponse.next();
  if (!isStaticAssetPath(pathname)) {
    const allowedOrigin =
      origin && isAllowedOrigin(origin, req) ? origin : getEffectiveOrigin(req);
    res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    res.headers.set("Vary", "Origin");
  }
  applyHstsIfProductionHttps(req, res);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.*|captenly-icon.*|apple-touch-icon.*).*)",
  ],
};
