import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop13 from "@/screens/D13";
import Phone12 from "@/screens/P12";

export default function CoachDashboardPage() {
  return <ResponsiveScreen desktop={<Desktop13 />} phone={<Phone12 />} />;
}
