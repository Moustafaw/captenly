import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop1 from "@/screens/D1";
import Phone17 from "@/screens/P17";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "استكمال إعداد الحساب والملف الرياضي",
  description: "أكمل بيانات ملفك على كابتنلي لتفعيل التوثيق وربط المنشآت والباقات.",
  path: "/auth/onboarding",
  noIndex: true,
});

export default function OnboardingPage() {
  return <ResponsiveScreen desktop={<Desktop1 />} phone={<Phone17 />} />;
}
