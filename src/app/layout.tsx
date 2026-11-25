import type { Metadata, Viewport } from "next";
import { Cairo, Inter } from "next/font/google";
import "./globals.css";
import { CaptenlyProvider } from "@/context/CaptenlyContext";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { MobileHeader } from "@/components/chrome/MobileHeader";
import { SiteDock } from "@/components/chrome/SiteDock";
import { AuthSessionWrapper } from "@/components/auth/AuthSessionWrapper";
import { RootModalsPortal } from "@/components/RootModalsPortal";
import { CAPTENLY_BASE_URL } from "@/lib/seo";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(CAPTENLY_BASE_URL),
  title: {
    default: "كابتنلي | CAPTENLY",
    template: "%s | كابتنلي CAPTENLY",
  },
  description:
    "المنظومة الرقمية لاكتشاف المسابح وأكاديميات ومدارس السباحة، توثيق الكباتن بـ 6 شارات مستقلة، جواز السفر الرياضي، ودفتر الحصص الأوفلاين.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/captenly-icon-v2.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon-v2.png?v=2", sizes: "64x64", type: "image/png" },
    ],
    shortcut: "/favicon-v2.png?v=2",
    apple: "/apple-touch-icon-v2.png?v=2",
  },
  openGraph: {
    type: "website",
    locale: "ar_EG",
    siteName: "كابتنلي | CAPTENLY",
    title: "كابتنلي | CAPTENLY",
    description:
      "المنظومة الرقمية لاكتشاف المسابح وأكاديميات ومدارس السباحة في مصر مع دفتر حصص QR أوفلاين و0% عمولة وساطة.",
  },
  twitter: {
    card: "summary_large_image",
    title: "كابتنلي | CAPTENLY",
    description:
      "المنظومة الرقمية لاكتشاف المسابح وأكاديميات ومدارس السباحة في مصر مع دفتر حصص QR أوفلاين.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1D6E7D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col bg-canvas-alabaster text-on-surface antialiased font-cairo">
        <AuthSessionWrapper>
          <CaptenlyProvider>
            <SiteHeader />
            <MobileHeader />
            <main id="main-content" className="flex-1 w-full">
              {children}
            </main>
            <SiteFooter />
            <SiteDock />
            <RootModalsPortal />
          </CaptenlyProvider>
        </AuthSessionWrapper>
      </body>
    </html>
  );
}
