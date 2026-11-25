import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop16 from "@/screens/D16";
import Phone14 from "@/screens/P14";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "قائمة المفضلة والمحفوظات",
  description: "استعرض المسابح والكباتن والمقالات المحفوظة في حسابك على كابتنلي.",
  path: "/favorites",
  noIndex: true,
});

export default function FavoritesPage() {
  return <ResponsiveScreen desktop={<Desktop16 />} phone={<Phone14 />} />;
}
