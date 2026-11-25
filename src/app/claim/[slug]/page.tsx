import type { Metadata } from "next";
import { ClaimAndVerifyClient } from "@/components/editorial/ClaimAndVerifyClient";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildPageMetadata({
    title: "طلب اعتماد وتوثيق صفحة المنشأة",
    description: "أكمل خطوات توثيق ملكية أو إدارة صفحتك على منصة كابتنلي.",
    path: `/claim/${encodeURIComponent(slug)}`,
    noIndex: true,
  });
}

export default async function ClaimSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ClaimAndVerifyClient initialSlug={slug} initialMode="facility" />;
}
