import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CaptenlyProvider } from "@/context/CaptenlyContext";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { MobileHeader } from "@/components/chrome/MobileHeader";
import { SiteDock } from "@/components/chrome/SiteDock";
import { LocationModal } from "@/components/LocationModal";
import { FilterModal } from "@/components/FilterModal";
import { AuthSessionWrapper } from "@/components/auth/AuthSessionWrapper";
import { GoogleSessionBridge } from "@/components/auth/GoogleSessionBridge";

export const metadata: Metadata = {
  title: "كابتنلي CAPTENLY — مجتمعك الرياضي الموثق في مصر",
  description:
    "المنظومة الرقمية لاكتشاف أكاديميات السباحة وصالات الجيم، توثيق الكباتن بـ 6 شارات مستقلة، جواز السفر الرياضي، ودفتر الحصص الأوفلاين.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#2C3437",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-canvas-alabaster text-on-surface antialiased font-cairo">
        <AuthSessionWrapper>
          <CaptenlyProvider>
            <GoogleSessionBridge />
            <SiteHeader />
            <MobileHeader />
            <div className="flex-1 w-full">{children}</div>
            <SiteFooter />
            <SiteDock />
            <LocationModal />
            <FilterModal />
          </CaptenlyProvider>
        </AuthSessionWrapper>
      </body>
    </html>
  );
}
