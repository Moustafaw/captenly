import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop15 from "@/screens/D15";
import Phone2 from "@/screens/P2";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "لوحة الرياضي وجواز السفر الرياضي",
  description: "تابع أرقامك القياسية (PB)، التقييم المهاري ذي الـ 5 محاور، ودفتر الحصص والأسرة.",
  path: "/dashboard/athlete",
  noIndex: true,
});

export default function AthleteDashboardPage() {
  return <ResponsiveScreen desktop={<Desktop15 />} phone={<Phone2 />} />;
}
