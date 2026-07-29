import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://stage-sync-mu.vercel.app"),
  title: {
    default: "Stage Sync",
    template: "%s · Stage Sync",
  },
  description:
    "극단 연습 일정을 한곳에서. 장면별 가능일을 모아 연습 날짜를 확정하세요.",
  applicationName: "Stage Sync",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "Stage Sync",
    title: "Stage Sync",
    description:
      "극단 연습 일정을 한곳에서. 장면별 가능일을 모아 연습 날짜를 확정하세요.",
    url: "https://stage-sync-mu.vercel.app",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Stage Sync",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stage Sync",
    description:
      "극단 연습 일정을 한곳에서. 장면별 가능일을 모아 연습 날짜를 확정하세요.",
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Stage Sync",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f3f1ec",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
