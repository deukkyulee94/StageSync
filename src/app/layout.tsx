import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Fraunces, Outfit } from "next/font/google";
import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
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

const themeInitScript = `(function(){try{var k='stage-sync-theme';var p=localStorage.getItem(k)||'system';var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6faf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1412" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${display.variable} ${body.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <ThemeProvider>
          <AppProvider>
            <AppShell>{children}</AppShell>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
