import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { withPgClient } from "@/lib/supabase/pgFallback";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
]);

function parseDataUrlImage(dataUrl: unknown): { mime: string; bytes: Buffer } | null {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const rawMime = match[1].toLowerCase();
  const mime = rawMime === "image/jpg" ? "image/jpeg" : rawMime;
  if (!ALLOWED_IMAGE_MIME.has(mime)) return null;
  const cleaned = match[2].replace(/\s+/g, "");
  const bytes = Buffer.from(cleaned, "base64");
  if (bytes.length === 0 || bytes.length > 6 * 1024 * 1024) return null;
  return { mime, bytes };
}

function extractSlotUrl(
  payload: Record<string, unknown> | null | undefined,
  slot: string,
  index: number
): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (slot === "hero") return typeof payload.heroImage === "string" ? payload.heroImage : null;
  if (slot === "avatar") return typeof payload.avatarUrl === "string" ? payload.avatarUrl : null;
  if (slot === "image") return typeof payload.imageUrl === "string" ? payload.imageUrl : null;
  if (slot === "gallery" && Array.isArray(payload.gallery)) {
    const val = payload.gallery[index];
    return typeof val === "string" ? val : null;
  }
  return null;
}

async function loadRecordPayload(
  kind: "facility" | "coach" | "article",
  id: string
): Promise<Record<string, unknown> | null> {
  const table =
    kind === "facility"
      ? "captenly_facilities"
      : kind === "coach"
      ? "captenly_coaches"
      : "captenly_articles";

  const admin = getSupabaseAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin.from(table).select("payload").eq("id", id).limit(1);
      if (!error && Array.isArray(data) && data[0]) {
        return (data[0] as { payload?: Record<string, unknown> }).payload || null;
      }
    } catch {
      // Fall through to PG
    }
  }

  const pgRes = await withPgClient(async (client) => {
    const { rows } = await client.query(`select payload from public.${table} where id = $1 limit 1`, [id]);
    return (rows[0] as { payload?: Record<string, unknown> } | undefined)?.payload || null;
  });
  return pgRes.ok ? pgRes.value : null;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const kind = sp.get("kind");
  const id = (sp.get("id") || "").trim();
  const slot = (sp.get("slot") || "hero").trim();
  const index = Math.max(0, Number(sp.get("index") || "0") || 0);

  if (
    (kind !== "facility" && kind !== "coach" && kind !== "article") ||
    !id ||
    id.length > 160
  ) {
    return NextResponse.json({ error: "invalid_media_query" }, { status: 400 });
  }

  const payload = await loadRecordPayload(kind, id);
  const rawUrl = extractSlotUrl(payload, slot, index);
  const parsed = parseDataUrlImage(rawUrl);

  if (!parsed) {
    return NextResponse.json({ error: "media_not_found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(parsed.bytes), {
    status: 200,
    headers: {
      "Content-Type": parsed.mime,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
