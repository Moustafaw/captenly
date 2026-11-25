import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop21 from "@/screens/D21";
import Phone23 from "@/screens/P23";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "مجلة كابتنلي والأدلة الرياضية المتخصصة",
  description:
    "أدلة ومقالات توعوية في السباحة وتأسيس الأطفال ومعايير الأمان المائي واختيار الأكاديمية والكابتن الأنسب.",
  path: "/magazine",
});

export default function MagazinePage() {
  return <ResponsiveScreen desktop={<Desktop21 />} phone={<Phone23 />} />;
}
