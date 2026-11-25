import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop10 from "@/screens/D10";
import Phone18 from "@/screens/P18";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "إنشاء حساب جديد على كابتنلي",
  description: "أنشئ حسابك المجاني في 30 ثانية واحصل على كود عضوية فريد ودفتر حصص QR أوفلاين.",
  path: "/auth/register",
  noIndex: true,
});

export default function RegisterPage() {
  return <ResponsiveScreen desktop={<Desktop10 />} phone={<Phone18 />} />;
}
