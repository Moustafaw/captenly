import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop9 from "@/screens/D9";
import Phone8 from "@/screens/P8";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "تجهيز طلب حجز باقة وربط كود العضوية",
  description: "تواصل مباشرة مع الأكاديمية أو الكابتن بـ 0% عمولة واربط كود عضويتك بدفتر الحصص.",
  path: "/booking",
  noIndex: true,
});

export default function BookingPage() {
  return <ResponsiveScreen desktop={<Desktop9 />} phone={<Phone8 />} />;
}
