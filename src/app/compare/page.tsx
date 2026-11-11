import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop12 from "@/screens/D12";
import Phone4 from "@/screens/P4";

export default function ComparePage() {
  return <ResponsiveScreen desktop={<Desktop12 />} phone={<Phone4 />} />;
}
