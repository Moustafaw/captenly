import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop8 from "@/screens/D8";
import Phone5 from "@/screens/P5";

export default function LedgerPassportPage() {
  return <ResponsiveScreen desktop={<Desktop8 />} phone={<Phone5 />} />;
}
