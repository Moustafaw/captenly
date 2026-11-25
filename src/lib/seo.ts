import type { Metadata } from "next";
import { INITIAL_ARTICLES } from "@/data/seedData";
import { withPgClient } from "@/lib/supabase/pgFallback";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const CAPTENLY_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://captenly.vercel.app";

export interface BuildSeoInput {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
}

export function buildPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: BuildSeoInput): Metadata {
  const fullTitle = `${title} | كابتنلي CAPTENLY`;
  const canonicalUrl = path ? `${CAPTENLY_BASE_URL}${path}` : CAPTENLY_BASE_URL;

  return {
    title,
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      type: "website",
      locale: "ar_EG",
      siteName: "كابتنلي | CAPTENLY",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
    ...(noIndex
      ? {
          robots: {
            index: false,
            follow: false,
          },
        }
      : {}),
  };
}

export async function lookupFacilitySeo(slug: string): Promise<{
  nameAr: string;
  city?: string;
  descriptionAr?: string;
} | null> {
  const cleanSlug = decodeURIComponent(slug || "").trim();
  if (!cleanSlug) return null;

  try {
    const admin = getSupabaseAdminClient();
    if (admin) {
      const { data } = await admin
        .from("captenly_facilities")
        .select("name_ar, city, payload")
        .eq("slug", cleanSlug)
        .limit(1);
      if (Array.isArray(data) && data[0]) {
        const row = data[0] as {
          name_ar?: string;
          city?: string;
          payload?: { publicDescriptionAr?: string; scheduleSummaryAr?: string };
        };
        if (row.name_ar) {
          return {
            nameAr: row.name_ar,
            city: row.city,
            descriptionAr: row.payload?.publicDescriptionAr || row.payload?.scheduleSummaryAr,
          };
        }
      }
    }

    const pgRes = await withPgClient(async (client) => {
      const { rows } = await client.query(
        `select name_ar, city, payload from public.captenly_facilities where slug = $1 limit 1`,
        [cleanSlug]
      );
      return rows[0] as
        | { name_ar?: string; city?: string; payload?: { publicDescriptionAr?: string } }
        | undefined;
    });
    if (pgRes.ok && pgRes.value?.name_ar) {
      return {
        nameAr: pgRes.value.name_ar,
        city: pgRes.value.city,
        descriptionAr: pgRes.value.payload?.publicDescriptionAr,
      };
    }
  } catch {
    // Graceful fallback if DB is unreachable during build/SSR
  }
  return null;
}

export async function lookupCoachSeo(slug: string): Promise<{
  fullNameAr: string;
  city?: string;
  bioAr?: string;
} | null> {
  const cleanSlug = decodeURIComponent(slug || "").trim();
  if (!cleanSlug) return null;

  try {
    const admin = getSupabaseAdminClient();
    if (admin) {
      const { data } = await admin
        .from("captenly_coaches")
        .select("full_name_ar, city, payload")
        .eq("slug", cleanSlug)
        .limit(1);
      if (Array.isArray(data) && data[0]) {
        const row = data[0] as {
          full_name_ar?: string;
          city?: string;
          payload?: { bioAr?: string; titleAr?: string };
        };
        if (row.full_name_ar) {
          return {
            fullNameAr: row.full_name_ar,
            city: row.city,
            bioAr: row.payload?.bioAr || row.payload?.titleAr,
          };
        }
      }
    }

    const pgRes = await withPgClient(async (client) => {
      const { rows } = await client.query(
        `select full_name_ar, city, payload from public.captenly_coaches where slug = $1 limit 1`,
        [cleanSlug]
      );
      return rows[0] as
        | { full_name_ar?: string; city?: string; payload?: { bioAr?: string; titleAr?: string } }
        | undefined;
    });
    if (pgRes.ok && pgRes.value?.full_name_ar) {
      return {
        fullNameAr: pgRes.value.full_name_ar,
        city: pgRes.value.city,
        bioAr: pgRes.value.payload?.bioAr || pgRes.value.payload?.titleAr,
      };
    }
  } catch {
    // Graceful fallback
  }
  return null;
}

export async function lookupArticleSeo(slug: string): Promise<{
  titleAr: string;
  excerptAr?: string;
  categoryAr?: string;
} | null> {
  const cleanSlug = decodeURIComponent(slug || "").trim();
  if (!cleanSlug) return null;
  const seeded = INITIAL_ARTICLES.find((a) => a.slug === cleanSlug || a.id === cleanSlug);
  if (seeded) {
    return {
      titleAr: seeded.titleAr,
      excerptAr: seeded.excerptAr,
      categoryAr: seeded.categoryAr,
    };
  }

  try {
    const admin = getSupabaseAdminClient();
    if (admin) {
      const { data } = await admin
        .from("captenly_articles")
        .select("title_ar, category_ar, payload")
        .eq("slug", cleanSlug)
        .limit(1);
      if (Array.isArray(data) && data[0]) {
        const row = data[0] as {
          title_ar?: string;
          category_ar?: string;
          payload?: { excerptAr?: string };
        };
        if (row.title_ar) {
          return {
            titleAr: row.title_ar,
            categoryAr: row.category_ar,
            excerptAr: row.payload?.excerptAr,
          };
        }
      }
    }
  } catch {
    // Graceful fallback
  }
  return null;
}
