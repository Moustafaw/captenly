import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop11 from "@/screens/D11";
import Phone19 from "@/screens/P19";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "استعادة كلمة المرور",
  description: "استعد الوصول إلى حسابك في كابتنلي عبر رقم الهاتف أو البريد الإلكتروني.",
  path: "/auth/forgot",
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return <ResponsiveScreen desktop={<Desktop11 />} phone={<Phone19 />} />;
}
