import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import DesktopOtp from "@/screens/Dotp";
import PhoneOtp from "@/screens/Potp";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "التحقق من الرمز الأمني (OTP)",
  description: "أدخل رمز التحقق المرسل لإتمام تأمين وتأكيد حسابك على كابتنلي.",
  path: "/auth/otp",
  noIndex: true,
});

export default function OtpPage() {
  return <ResponsiveScreen desktop={<DesktopOtp />} phone={<PhoneOtp />} />;
}
