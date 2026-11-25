import type { Metadata } from "next";
import Desktop14 from "@/screens/D14";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "اختيار نوع الحساب والدخول",
  description: "سجّل الدخول أو أنشئ حسابك على كابتنلي كسبّاح أو ولي أمر أو كابتن أو إدارة منشأة.",
  path: "/auth",
  noIndex: true,
});

export default function AuthRolePage() {
  return <Desktop14 />;
}
