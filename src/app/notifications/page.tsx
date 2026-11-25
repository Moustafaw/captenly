import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop7 from "@/screens/D7";
import Phone1 from "@/screens/P1";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "الإشعارات والتنبيهات",
  description: "متابعة إشعارات الحصص ودعوات العمل وطلبات التوثيق في كابتنلي.",
  path: "/notifications",
  noIndex: true,
});

export default function NotificationsPage() {
  return <ResponsiveScreen desktop={<Desktop7 />} phone={<Phone1 />} />;
}
