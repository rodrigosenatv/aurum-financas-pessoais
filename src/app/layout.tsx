import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { MotionProvider } from "@/components/motion-provider";
import { PwaProvider } from "@/components/pwa-provider";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme-script";
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
  // segue o tema do sistema; a escolha manual é aplicada em lib/theme.ts
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
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
      // o script de tema altera data-theme antes da hidratação
      suppressHydrationWarning
      className={`${grotesk.variable} ${iserif.variable} ${inter.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-fg antialiased overscroll-y-none">
        <div aria-hidden className="status-scrim" />
        <MotionProvider>
          {children}
          <PwaProvider />
        </MotionProvider>
      </body>
    </html>
  );
}
