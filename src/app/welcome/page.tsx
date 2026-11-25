import type { Metadata } from "next";
import Desktop5 from "@/screens/D5";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "أهلاً بك في كابتنلي — حسابك جاهز",
  description: "تأكيد تفعيل حسابك وكود العضوية والوصول السريع لدفتر الحصص الـ QR.",
  path: "/welcome",
  noIndex: true,
});

export default function WelcomePage() {
  return <Desktop5 />;
}
