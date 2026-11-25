import type { Metadata } from "next";
import AthleteNotificationsSettingsClient from "./AthleteNotificationsSettingsClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "تفضيلات الإشعارات والتنبيهات", description: "تخصيص تنبيهات الحصص والتجديد ودعوات العمل على كابتنلي.", path: "/dashboard/athlete/settings/notifications", noIndex: true });

export default function Page() {
  return <AthleteNotificationsSettingsClient />;
}
