import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop2 from "@/screens/D2";
import Phone20 from "@/screens/P20";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "إعادة تعيين كلمة المرور",
  description: "عيّن كلمة مرور جديدة وآمنة لحسابك على منصة كابتنلي.",
  path: "/auth/reset",
  noIndex: true,
});

export default function ResetPasswordPage() {
  return <ResponsiveScreen desktop={<Desktop2 />} phone={<Phone20 />} />;
}
