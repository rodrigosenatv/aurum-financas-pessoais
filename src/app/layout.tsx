import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { MotionProvider } from "@/components/motion-provider";
import { PwaProvider } from "@/components/pwa-provider";
import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

const iserif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-iserif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060807",
};

export const metadata: Metadata = {
  title: "aurum · finanças pessoais",
  description:
    "Tracker de finanças pessoais: visão geral do seu dinheiro, fluxo de caixa, orçamentos e metas.",
  applicationName: "Aurum",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aurum",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon-192.png",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${grotesk.variable} ${iserif.variable} ${inter.variable}`}
    >
      <body className="min-h-dvh bg-ink font-sans text-cream antialiased overscroll-y-none">
        <MotionProvider>
          {children}
          <PwaProvider />
        </MotionProvider>
      </body>
    </html>
  );
}

