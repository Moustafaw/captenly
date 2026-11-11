import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop21 from "@/screens/D21";
import Phone23 from "@/screens/P23";

export default function MagazinePage() {
  return <ResponsiveScreen desktop={<Desktop21 />} phone={<Phone23 />} />;
}
