import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop17 from "@/screens/D17";
import Phone9 from "@/screens/P9";

export default function BadgesPage() {
  return <ResponsiveScreen desktop={<Desktop17 />} phone={<Phone9 />} />;
}
