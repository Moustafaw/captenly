import type { Metadata } from "next";
import AthleteSettingsClient from "./AthleteSettingsClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "إعدادات الحساب والملف الرياضي", description: "تعديل البيانات الشخصية وصورة الحساب وإعدادات الخصوصية.", path: "/dashboard/athlete/settings", noIndex: true });

export default function Page() {
  return <AthleteSettingsClient />;
}
