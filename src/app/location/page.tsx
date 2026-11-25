import type { Metadata } from "next";
import Desktop20 from "@/screens/D20";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "تحديد الموقع الجغرافي ونطاق البحث",
  description: "اختر مدينتك أو نطاق الكيلومترات للبحث عن أقرب المسابح وأكاديميات السباحة.",
  path: "/location",
  noIndex: true,
});

export default function LocationPage() {
  return <Desktop20 />;
}
