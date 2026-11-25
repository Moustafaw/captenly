import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  backend: "postgres" | "supabase_rest" | "unconfigured_fail_open" | "unmigrated_fail_open";
}

let warnedMissingRateLimitTable = false;

function warnOnceMissingRateLimit(reason: string): void {
  if (warnedMissingRateLimitTable) return;
  warnedMissingRateLimitTable = true;
  console.warn(
    `[captenly:rate-limit] Shared rate limiter unavailable (${reason}). Apply supabase/migrations/20261121000005_captenly_phase3_tables_and_rate_limits.sql to enforce persistent rate limits.`
  );
}

/**
 * Extracts best-effort client IP from standard proxy headers without trusting spoofable host headers.
 */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") || "";
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = (request.headers.get("x-real-ip") || "").trim();
  if (realIp) return realIp.slice(0, 64);
  return "unknown";
}

/**
 * Shared persistent fixed-window rate limiter backed by PostgreSQL (`captenly_rate_limits`)
 * with Supabase PostgREST fallback. Fails open only when no database is configured or
 * before migration 005 is applied (`42P01`/`PGRST205`), never using runtime DDL or
 * non-shared process-local memory counters.
 */
export async function enforceRateLimit(options: {
  bucket: string;
  identifier: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowSec = Math.max(1, Math.floor(options.windowSec));
  const safeBucket = options.bucket.replace(/[^a-z0-9:_-]/gi, "_").slice(0, 60);
  const safeId = options.identifier.replace(/[^a-z0-9.:_-]/gi, "_").slice(0, 120) || "anon";
  const key = `${safeBucket}:${safeId}`;

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const nowMs = Date.now();
      const { data, error } = await admin
        .from("captenly_rate_limits")
        .select("hit_count, reset_at")
        .eq("key", key)
        .limit(1);

      if (!error) {
        const existing = Array.isArray(data)
          ? (data[0] as { hit_count?: number; reset_at?: string } | undefined)
          : undefined;
        const existingResetMs = existing?.reset_at ? Date.parse(existing.reset_at) : 0;
        const windowExpired = !existing || !Number.isFinite(existingResetMs) || existingResetMs <= nowMs;
        const nextCount = windowExpired ? 1 : Number(existing.hit_count || 0) + 1;
        const nextResetMs = windowExpired ? nowMs + windowSec * 1000 : existingResetMs;
        const nextResetIso = new Date(nextResetMs).toISOString();

        const { error: upsertErr } = await admin.from("captenly_rate_limits").upsert(
          {
            key,
            hit_count: nextCount,
            reset_at: nextResetIso,
            updated_at: new Date(nowMs).toISOString(),
          },
          { onConflict: "key" }
        );

        if (!upsertErr) {
          const retryAfterSec = Math.max(1, Math.ceil((nextResetMs - nowMs) / 1000));
          return {
            allowed: nextCount <= limit,
            remaining: Math.max(0, limit - nextCount),
            retryAfterSec,
            backend: "supabase_rest",
          };
        }
        if (upsertErr.code !== "42P01" && upsertErr.code !== "PGRST205") {
          warnOnceMissingRateLimit(upsertErr.code || "supabase_upsert_error");
        }
      } else if (error.code !== "42P01" && error.code !== "PGRST205") {
        warnOnceMissingRateLimit(error.code || "supabase_read_error");
      }
    } catch {
      // Fall through to PostgreSQL atomic query
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const { rows } = await client.query(
      `insert into public.captenly_rate_limits (key, hit_count, reset_at, updated_at)
       values ($1, 1, now() + ($2::text || ' seconds')::interval, now())
       on conflict (key) do update set
         hit_count = case
           when public.captenly_rate_limits.reset_at <= now() then 1
           else public.captenly_rate_limits.hit_count + 1
         end,
         reset_at = case
           when public.captenly_rate_limits.reset_at <= now()
             then now() + ($2::text || ' seconds')::interval
           else public.captenly_rate_limits.reset_at
         end,
         updated_at = now()
       returning hit_count, greatest(1, ceil(extract(epoch from (reset_at - now()))))::int as retry_after_sec`,
      [key, String(windowSec)]
    );
    const row = rows[0] as { hit_count?: number; retry_after_sec?: number } | undefined;
    const hitCount = Number(row?.hit_count ?? 1);
    const retryAfterSec = Math.max(1, Number(row?.retry_after_sec ?? windowSec));
    return { hitCount, retryAfterSec };
  });

  if (pgRes.ok) {
    return {
      allowed: pgRes.value.hitCount <= limit,
      remaining: Math.max(0, limit - pgRes.value.hitCount),
      retryAfterSec: pgRes.value.retryAfterSec,
      backend: "postgres",
    };
  }

  if (pgRes.errorCode === "missing_postgres_url") {
    return {
      allowed: true,
      remaining: limit,
      retryAfterSec: windowSec,
      backend: "unconfigured_fail_open",
    };
  }

  warnOnceMissingRateLimit(pgRes.errorCode);
  return {
    allowed: true,
    remaining: limit,
    retryAfterSec: windowSec,
    backend: "unmigrated_fail_open",
  };
}

export function rateLimitExceededResponse(
  retryAfterSec: number,
  messageAr = "تم تجاوز الحد المسموح للطلبات مؤقتاً. يرجى المحاولة بعد قليل."
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      persisted: false,
      error: "rate_limited",
      retryAfterSec,
      messageAr,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Remaining": "0",
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
