import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop2 from "@/screens/D2";
import Phone20 from "@/screens/P20";

export default function ResetPasswordPage() {
  return <ResponsiveScreen desktop={<Desktop2 />} phone={<Phone20 />} />;
}
