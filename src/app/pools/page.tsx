import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop4 from "@/screens/D4";
import Phone6 from "@/screens/P6";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "دليل المسابح المدفأة ومدارس السباحة",
  description:
    "تصفح المسابح المدفأة شتاءً ومدارس تعليم السباحة للأطفال والكبار ومواعيد السيدات المستقلة عبر محافظات مصر.",
  path: "/pools",
});

export default function PoolsDirectoryPage() {
  return <ResponsiveScreen desktop={<Desktop4 />} phone={<Phone6 />} />;
}
