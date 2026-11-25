import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop13 from "@/screens/D13";
import Phone12 from "@/screens/P12";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "لوحة تحكم الكابتن الموثق",
  description: "إدارة المتدربين والباقات، تسجيل الأرقام القياسية والتقييمات، ومتابعة شارات التوثيق الست.",
  path: "/dashboard/coach",
  noIndex: true,
});

export default function CoachDashboardPage() {
  return <ResponsiveScreen desktop={<Desktop13 />} phone={<Phone12 />} />;
}
