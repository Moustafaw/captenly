import type { Metadata } from "next";
import CoachProfileClient from "./CoachProfileClient";
import { buildPageMetadata, lookupCoachSeo } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const coach = await lookupCoachSeo(slug);
  if (coach) {
    const cityLabel = coach.city ? ` — ${coach.city}` : "";
    return buildPageMetadata({
      title: `كابتن ${coach.fullNameAr}${cityLabel}`,
      description:
        coach.bioAr ||
        `الملف الرياضي وباقات التدريب للكابتن ${coach.fullNameAr}${cityLabel} عبر كابتنلي.`,
      path: `/c/${encodeURIComponent(slug)}`,
    });
  }
  return buildPageMetadata({
    title: "ملف الكابتن والمدرب",
    description: "استعرض السيرة المهنية، شارات التوثيق، وباقات التدريب على كابتنلي.",
    path: `/c/${encodeURIComponent(slug)}`,
  });
}

export default function CoachProfilePage() {
  return <CoachProfileClient />;
}
