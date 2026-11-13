import { ClaimAndVerifyClient } from "@/components/editorial/ClaimAndVerifyClient";

export default function ClaimIndexPage({
  searchParams,
}: {
  searchParams?: { mode?: string; slug?: string };
}) {
  const mode = searchParams?.mode === "coach" ? "coach" : "facility";
  return <ClaimAndVerifyClient initialMode={mode} initialSlug={searchParams?.slug} />;
}
