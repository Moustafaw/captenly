import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop1 from "@/screens/D1";
import Phone17 from "@/screens/P17";

export default function OnboardingPage() {
  return <ResponsiveScreen desktop={<Desktop1 />} phone={<Phone17 />} />;
}
