import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop9 from "@/screens/D9";
import Phone8 from "@/screens/P8";

export default function BookingPage() {
  return <ResponsiveScreen desktop={<Desktop9 />} phone={<Phone8 />} />;
}
