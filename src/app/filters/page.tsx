import type { Metadata } from "next";
import Desktop18 from "@/screens/D18";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "الفلاتر الذكية للبحث عن المسابح",
  description: "خصص بحثك حسب الميزانية والمدينة والتدفئة الشتوية ومواعيد السيدات.",
  path: "/filters",
  noIndex: true,
});

export default function FiltersPage() {
  return <Desktop18 />;
}
