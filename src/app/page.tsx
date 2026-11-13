import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop24 from "@/screens/D24";
import Phone21 from "@/screens/P21";

export default function HomePage() {
  return <ResponsiveScreen desktop={<Desktop24 />} phone={<Phone21 />} />;
}
