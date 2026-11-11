import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop16 from "@/screens/D16";
import Phone14 from "@/screens/P14";

export default function FavoritesPage() {
  return <ResponsiveScreen desktop={<Desktop16 />} phone={<Phone14 />} />;
}
