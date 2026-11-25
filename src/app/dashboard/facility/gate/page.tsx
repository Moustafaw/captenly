import type { Metadata } from "next";
import FacilityGateClient from "./FacilityGateClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "كشك بوابة المسبح — مسح QR أوفلاين", description: "تسجيل حضور السبّاحين بمسح QR سريع ويعمل بدون إنترنت ببوابة المسبح.", path: "/dashboard/facility/gate", noIndex: true });

export default function Page() {
  return <FacilityGateClient />;
}
