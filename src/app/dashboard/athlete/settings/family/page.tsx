import type { Metadata } from "next";
import AthleteFamilySettingsClient from "./AthleteFamilySettingsClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "إدارة ملفات الأبناء والأسرة", description: "إدارة حسابات الأبناء القُصّر وخصوصيتهم وفق القانون 151 لسنة 2020.", path: "/dashboard/athlete/settings/family", noIndex: true });

export default function Page() {
  return <AthleteFamilySettingsClient />;
}
