import type { Metadata } from "next";
import { ClaimAndVerifyClient } from "@/components/editorial/ClaimAndVerifyClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "طالب بصفحتك ووثّق منشأتك أو ملفك ككابتن",
  description:
    "فعّل صفحة أكاديميتك أو مسبحك أو وثّق ملفك التدريبي مجاناً بـ 0% عمولة على منصة كابتنلي.",
  path: "/claim",
});

export default async function ClaimIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; slug?: string }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const mode = resolved?.mode === "coach" ? "coach" : "facility";
  return <ClaimAndVerifyClient initialMode={mode} initialSlug={resolved?.slug} />;
}
