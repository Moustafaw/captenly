import type { MetadataRoute } from "next";
import { INITIAL_ARTICLES } from "@/data/seedData";
import { CAPTENLY_BASE_URL } from "@/lib/seo";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPublicPaths = [
    { path: "/", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/explore", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/pools", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/coaches", priority: 0.85, changeFrequency: "daily" as const },
    { path: "/compare", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/magazine", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/badges", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/claim", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.4, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.4, changeFrequency: "yearly" as const },
  ];

  const entries: MetadataRoute.Sitemap = staticPublicPaths.map((item) => ({
    url: `${CAPTENLY_BASE_URL}${item.path}`,
    lastModified: now,
    changeFrequency: item.changeFrequency,
    priority: item.priority,
  }));

  const seenUrls = new Set(entries.map((e) => e.url));
  for (const art of INITIAL_ARTICLES) {
    const url = `${CAPTENLY_BASE_URL}/magazine/${encodeURIComponent(art.slug)}`;
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      entries.push({
        url,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.65,
      });
    }
  }

  try {
    const admin = getSupabaseAdminClient();
    if (admin) {
      const [facRes, coachRes, artRes] = await Promise.all([
        admin.from("captenly_facilities").select("slug, updated_at").limit(200),
        admin.from("captenly_coaches").select("slug, updated_at").limit(200),
        admin.from("captenly_articles").select("slug, updated_at").limit(100),
      ]);

      for (const r of facRes.data || []) {
        const slug = (r as { slug?: string }).slug;
        if (!slug) continue;
        const url = `${CAPTENLY_BASE_URL}/academy/${encodeURIComponent(slug)}`;
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          entries.push({
            url,
            lastModified: (r as { updated_at?: string }).updated_at
              ? new Date((r as { updated_at: string }).updated_at)
              : now,
            changeFrequency: "weekly",
            priority: 0.8,
          });
        }
      }

      for (const r of coachRes.data || []) {
        const slug = (r as { slug?: string }).slug;
        if (!slug) continue;
        const url = `${CAPTENLY_BASE_URL}/c/${encodeURIComponent(slug)}`;
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          entries.push({
            url,
            lastModified: (r as { updated_at?: string }).updated_at
              ? new Date((r as { updated_at: string }).updated_at)
              : now,
            changeFrequency: "weekly",
            priority: 0.75,
          });
        }
      }

      for (const r of artRes.data || []) {
        const slug = (r as { slug?: string }).slug;
        if (!slug) continue;
        const url = `${CAPTENLY_BASE_URL}/magazine/${encodeURIComponent(slug)}`;
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          entries.push({
            url,
            lastModified: (r as { updated_at?: string }).updated_at
              ? new Date((r as { updated_at: string }).updated_at)
              : now,
            changeFrequency: "monthly",
            priority: 0.65,
          });
        }
      }
    }
  } catch {
    // Static build without Supabase credentials uses static + seeded articles cleanly
  }

  return entries;
}
