import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop6 from "@/screens/D6";
import Phone22 from "@/screens/P22";
import { buildPageMetadata, lookupArticleSeo } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const art = await lookupArticleSeo(slug);
  if (art) {
    return buildPageMetadata({
      title: art.titleAr,
      description:
        art.excerptAr ||
        `اقرأ مقال «${art.titleAr}» ضمن مجلة كابتنلي المتخصصة في السباحة والأكاديميات في مصر.`,
      path: `/magazine/${encodeURIComponent(slug)}`,
    });
  }
  return buildPageMetadata({
    title: "دليل من مجلة كابتنلي",
    description: "اقرأ أدلة ومقالات السباحة المعتمدة في مجلة كابتنلي.",
    path: `/magazine/${encodeURIComponent(slug)}`,
  });
}

export default function ArticleDetailPage() {
  return <ResponsiveScreen desktop={<Desktop6 />} phone={<Phone22 />} />;
}
