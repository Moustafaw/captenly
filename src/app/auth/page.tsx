import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop14 from "@/screens/D14";
import Phone11 from "@/screens/P11";

export default function AuthRolePage() {
  return <ResponsiveScreen desktop={<Desktop14 />} phone={<Phone11 />} />;
}
