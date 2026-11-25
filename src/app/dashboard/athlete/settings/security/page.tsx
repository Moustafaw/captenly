import type { Metadata } from "next";
import AthleteSecuritySettingsClient from "./AthleteSecuritySettingsClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "الأمان وكلمة المرور والربط", description: "تحديث كلمة المرور وإعدادات الأمان وحماية الحساب.", path: "/dashboard/athlete/settings/security", noIndex: true });

export default function Page() {
  return <AthleteSecuritySettingsClient />;
}
