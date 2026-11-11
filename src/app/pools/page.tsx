import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop4 from "@/screens/D4";
import Phone6 from "@/screens/P6";

export default function PoolsDirectoryPage() {
  return <ResponsiveScreen desktop={<Desktop4 />} phone={<Phone6 />} />;
}
