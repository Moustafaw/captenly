import type { Metadata } from "next";
import AdminDashboardClient from "./AdminDashboardClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "لوحة الإدارة والمراجعة", description: "إدارة اعتماد المنشآت، توثيق الشارات، ومراجعة الطلبات في كابتنلي.", path: "/admin", noIndex: true });

export default function Page() {
  return <AdminDashboardClient />;
}
