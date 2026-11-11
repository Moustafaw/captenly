import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop15 from "@/screens/D15";
import Phone2 from "@/screens/P2";

export default function AthleteDashboardPage() {
  return <ResponsiveScreen desktop={<Desktop15 />} phone={<Phone2 />} />;
}
