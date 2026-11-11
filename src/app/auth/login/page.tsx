import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop10 from "@/screens/D10";
import Phone18 from "@/screens/P18";

export default function LoginPage() {
  return <ResponsiveScreen desktop={<Desktop10 />} phone={<Phone18 />} />;
}
