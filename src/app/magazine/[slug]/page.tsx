import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop6 from "@/screens/D6";
import Phone22 from "@/screens/P22";

export default function ArticleDetailPage() {
  return <ResponsiveScreen desktop={<Desktop6 />} phone={<Phone22 />} />;
}
