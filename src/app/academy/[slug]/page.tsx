import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop22 from "@/screens/D22";
import Phone13 from "@/screens/P13";
import { buildPageMetadata, lookupFacilitySeo } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const fac = await lookupFacilitySeo(slug);
  if (fac) {
    const cityLabel = fac.city ? ` — ${fac.city}` : "";
    return buildPageMetadata({
      title: `${fac.nameAr}${cityLabel}`,
      description:
        fac.descriptionAr ||
        `تفاصيل ${fac.nameAr}${cityLabel}: الباقات والمواعيد ومواصفات المسبح ودفتر الحصص الـ QR على كابتنلي.`,
      path: `/academy/${encodeURIComponent(slug)}`,
    });
  }
  return buildPageMetadata({
    title: "ملف الأكاديمية أو المسبح",
    description:
      "استعرض مواعيد التدريب، الباقات، مواصفات المسبح، والتواصل المباشر عبر منصة كابتنلي بـ 0% عمولة.",
    path: `/academy/${encodeURIComponent(slug)}`,
  });
}

export default function AcademyDetailPage() {
  return <ResponsiveScreen desktop={<Desktop22 />} phone={<Phone13 />} />;
}
