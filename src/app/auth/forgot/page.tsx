import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop11 from "@/screens/D11";
import Phone19 from "@/screens/P19";

export default function ForgotPasswordPage() {
  return <ResponsiveScreen desktop={<Desktop11 />} phone={<Phone19 />} />;
}
