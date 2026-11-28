import { beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { ServerCallerContext } from "@/lib/memberSession";

const mockModule = mock.module.bind(mock) as unknown as (
  specifier: string,
  opts: { exports: Record<string, unknown> }
) => void;

let currentCaller: ServerCallerContext = { authenticated: false, isAdmin: false };
let useSupabaseAdmin = true;
let pgRows: Array<Record<string, unknown>> = [];
let supabaseRows: Array<Record<string, unknown>> = [];

mockModule("@/lib/memberSession", {
  exports: {
    getServerCaller: async () => currentCaller,
  },
});

mockModule("@/lib/supabase/server", {
  exports: {
    getSupabaseAdminClient: () => {
      if (!useSupabaseAdmin) return null;
      return {
        from() {
          return {
            select() {
              return {
                order() {
                  return {
                    async limit() {
                      return { data: supabaseRows, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  },
});

mockModule("@/lib/supabase/pgFallback", {
  exports: {
    withPgClient: async (fn: (client: { query: () => Promise<{ rows: unknown[] }> }) => Promise<unknown>) => {
      const value = await fn({
        query: async () => ({ rows: pgRows }),
      });
      return { ok: true, value };
    },
  },
});

mockModule("@/lib/server/rateLimit", {
  exports: {
    enforceRateLimit: async () => ({
      allowed: true,
      remaining: 20,
      retryAfterSec: 60,
      backend: "unconfigured_fail_open",
    }),
    getClientIp: () => "127.0.0.1",
    rateLimitExceededResponse: () => new Response(null, { status: 429 }),
  },
});

const { GET } = await import("@/app/api/supabase/demand-radar/route");

describe("API integration: GET /api/supabase/demand-radar", () => {
  beforeEach(() => {
    useSupabaseAdmin = true;
    supabaseRows = [
      {
        id: "dr-1",
        full_name_ar: "أحمد سامي",
        phone: "01012345678",
        city: "طنطا",
        governorate: "الغربية",
        target_sport: "swimming",
        target_facility_id: "fac-1",
        target_facility_name_ar: "نادي طنطا",
        created_at: "2026-11-27T10:00:00Z",
      },
    ];
    pgRows = [
      {
        id: "dr-pg-1",
        full_name_ar: "سارة محمود",
        phone: "01198765432",
        city: "المنصورة",
        governorate: "الدقهلية",
        target_sport: "swimming",
        target_facility_id: null,
        target_facility_name_ar: null,
        created_at: "2026-11-27T09:00:00Z",
      },
    ];
  });

  it("returns 401 for unauthenticated caller", async () => {
    currentCaller = { authenticated: false, isAdmin: false };
    const res = await GET();
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, "unauthorized");
  });

  it("returns 403 for authenticated non-admin caller", async () => {
    currentCaller = {
      authenticated: true,
      isAdmin: false,
      memberCode: "CAP-M-2001",
      role: "facility_manager",
    };
    const res = await GET();
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, "forbidden");
  });

  it("returns 200 with mapped rows for admin via Supabase and PG fallback", async () => {
    currentCaller = { authenticated: true, isAdmin: true, role: "super_admin" };
    const supRes = await GET();
    assert.equal(supRes.status, 200);
    const supBody = (await supRes.json()) as {
      ok: boolean;
      source: string;
      totalCount: number;
      items: Array<{ id: string; fullNameAr: string; city: string }>;
    };
    assert.equal(supBody.ok, true);
    assert.equal(supBody.source, "supabase");
    assert.equal(supBody.totalCount, 1);
    assert.equal(supBody.items[0].fullNameAr, "أحمد سامي");

    useSupabaseAdmin = false;
    const pgRes = await GET();
    assert.equal(pgRes.status, 200);
    const pgBody = (await pgRes.json()) as {
      ok: boolean;
      source: string;
      items: Array<{ id: string; city: string }>;
    };
    assert.equal(pgBody.ok, true);
    assert.equal(pgBody.source, "pg");
    assert.equal(pgBody.items[0].city, "المنصورة");
  });
});
