import type { Metadata } from "next";
import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop17 from "@/screens/D17";
import Phone9 from "@/screens/P9";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "معايير توثيق الكباتن بالشارات الست الرسمية",
  description:
    "تعرّف على منظومة الشارات الست المعتمدة على منصة كابتنلي لتوثيق مدربي السباحة والإنقاذ المائي وحماية المتدربين.",
  path: "/badges",
});

export default function BadgesPage() {
  return <ResponsiveScreen desktop={<Desktop17 />} phone={<Phone9 />} />;
}
