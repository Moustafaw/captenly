import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop7 from "@/screens/D7";
import Phone1 from "@/screens/P1";

export default function NotificationsPage() {
  return <ResponsiveScreen desktop={<Desktop7 />} phone={<Phone1 />} />;
}
