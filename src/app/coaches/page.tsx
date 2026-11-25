import type { Metadata } from "next";
import CoachesDirectoryClient from "./CoachesDirectoryClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "دليل الكباتن المعتمدين ومدربي السباحة", description: "تصفح كباتن السباحة الموثقين بالشارات الست الرسمية وقارن الباقات وتواصل مباشرة بـ 0% عمولة.", path: "/coaches" });

export default function Page() {
  return <CoachesDirectoryClient />;
}
