import type { Metadata } from "next";
import FacilityDashboardClient from "./FacilityDashboardClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "لوحة إدارة المنشأة والمسبح", description: "إدارة المشتركين، الباقات، الكباتن، والعمليات اليومية عبر Pool Desk.", path: "/dashboard/facility", noIndex: true });

export default function Page() {
  return <FacilityDashboardClient />;
}
