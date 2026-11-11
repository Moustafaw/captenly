import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import DesktopOtp from "@/screens/Dotp";
import PhoneOtp from "@/screens/Potp";

export default function OtpPage() {
  return <ResponsiveScreen desktop={<DesktopOtp />} phone={<PhoneOtp />} />;
}
