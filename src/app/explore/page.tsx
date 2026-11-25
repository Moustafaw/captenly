import type { Metadata } from "next";
import { ExploreScreenClient } from "@/components/screens/ExploreScreenClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "استكشف المسابح والأكاديميات القريبة منك",
  description:
    "ابحث في خريطة ودليل مسابح السباحة والأكاديميات في مدينتك، وصفِّ حسب السعر والمسافة والتدفئة الشتوية ومواعيد السيدات.",
  path: "/explore",
});

export default async function ExplorePage({
  searchParams,
}: {
  searchParams?: Promise<{ fallback?: string; q?: string }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const isFallback = resolved?.fallback === "1";
  return <ExploreScreenClient isFallback={isFallback} />;
}
