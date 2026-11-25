import type { Metadata } from "next";
import AthleteHistorySettingsClient from "./AthleteHistorySettingsClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "سجل الحصص والاستعلامات", description: "عرض السجل التاريخي لحضور الحصص وطلبات التواصل.", path: "/dashboard/athlete/settings/history", noIndex: true });

export default function Page() {
  return <AthleteHistorySettingsClient />;
}
