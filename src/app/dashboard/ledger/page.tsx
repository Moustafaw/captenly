import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop8 from "@/screens/D8";
import Phone5 from "@/screens/P5";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "دفتر الحصص الـ QR وكود العضوية",
  description: "عرض كود الاشتراك، تتبع الحصص المكتملة، ومسح الـ QR أوفلاين بدون إنترنت.",
  path: "/dashboard/ledger",
  noIndex: true,
});

export default function LedgerPassportPage() {
  return <ResponsiveScreen desktop={<Desktop8 />} phone={<Phone5 />} />;
}
