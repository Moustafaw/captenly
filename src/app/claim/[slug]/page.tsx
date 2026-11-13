import { ClaimAndVerifyClient } from "@/components/editorial/ClaimAndVerifyClient";

export default function ClaimSlugPage({ params }: { params: { slug: string } }) {
  return <ClaimAndVerifyClient initialSlug={params.slug} initialMode="facility" />;
}
