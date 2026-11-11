import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop22 from "@/screens/D22";
import Phone13 from "@/screens/P13";

export default function AcademyDetailPage() {
  return <ResponsiveScreen desktop={<Desktop22 />} phone={<Phone13 />} />;
}
