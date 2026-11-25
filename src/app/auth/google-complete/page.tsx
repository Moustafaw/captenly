import type { Metadata } from "next";
import GoogleCompleteClient from "./GoogleCompleteClient";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "إتمام الدخول عبر Google", description: "ربط وتأكيد حساب Google مع عضويتك على كابتنلي.", path: "/auth/google-complete", noIndex: true });

export default function Page() {
  return <GoogleCompleteClient />;
}
