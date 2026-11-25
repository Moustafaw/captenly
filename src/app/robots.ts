import type { MetadataRoute } from "next";
import { CAPTENLY_BASE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/dashboard/",
          "/auth/",
          "/welcome",
          "/booking",
          "/notifications",
        ],
      },
    ],
    sitemap: `${CAPTENLY_BASE_URL}/sitemap.xml`,
    host: CAPTENLY_BASE_URL,
  };
}
