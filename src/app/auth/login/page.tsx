import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop10 from "@/screens/D10";
import Phone18 from "@/screens/P18";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "تسجيل الدخول إلى كابتنلي",
  description: "سجّل دخولك عبر Google أو كود العضوية للوصول إلى لوحتك ودفتر الحصص الـ QR.",
  path: "/auth/login",
  noIndex: true,
});

export default function LoginPage() {
  return <ResponsiveScreen desktop={<Desktop10 />} phone={<Phone18 />} />;
}
