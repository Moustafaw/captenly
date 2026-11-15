import { redirect } from "next/navigation";

export default function FacilityPage({ params }: { params: { slug: string } }) {
  redirect(`/academy/${params.slug}`);
}
