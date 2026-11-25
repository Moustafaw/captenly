import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop12 from "@/screens/D12";
import Phone4 from "@/screens/P4";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "مقارنة المسابح والأكاديميات جنباً إلى جنب",
  description:
    "قارن حتى 4 مسابح أو أكاديميات سباحة من حيث الأسعار، المسافة، التدفئة الشتوية، ومواعيد السيدات بشفافية تامة.",
  path: "/compare",
});

export default function ComparePage() {
  return <ResponsiveScreen desktop={<Desktop12 />} phone={<Phone4 />} />;
}
