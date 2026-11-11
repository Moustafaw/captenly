import { ResponsiveScreen } from "@/components/ResponsiveScreen";
import Desktop23 from "@/screens/D23";
import Desktop3 from "@/screens/D3";
import Phone6 from "@/screens/P6";

export default function ExplorePage({
  searchParams,
}: {
  searchParams?: { fallback?: string; q?: string };
}) {
  const isFallback = searchParams?.fallback === "1";
  return (
    <ResponsiveScreen
      desktop={isFallback ? <Desktop3 /> : <Desktop23 />}
      phone={<Phone6 />}
    />
  );
}
