import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildPageMetadata({
    title: "ملف المنشأة الرياضية",
    description: "تحويل إلى الصفحة الرسمية للمنشأة على كابتنلي.",
    path: `/academy/${encodeURIComponent(slug)}`,
  });
}

export default async function FacilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/academy/${slug}`);
}
