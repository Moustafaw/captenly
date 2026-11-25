import type { Metadata } from "next";
import AboutPageClient from "./AboutPageClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "عن منصة كابتنلي ورسالتنا للسباحة في مصر", description: "منصة كابتنلي الرقمية للربط الشفاف بين السباحين والأكاديميات والكباتن الموثقين بـ 0% عمولة وساطة.", path: "/about" });

export default function Page() {
  return <AboutPageClient />;
}
