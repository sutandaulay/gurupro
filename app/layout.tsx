import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import PWARegister from "./components/PWARegister";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import Providers from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7C3AED",
};

export const metadata: Metadata = {
  title: {
    default: "GuruPRO — AI Nya Guru Indonesia",
    template: "%s | GuruPRO",
  },
  description:
    "Buat soal ujian otomatis berbasis AI dengan Taksonomi Bloom (HOTS/LOTS). Platform all-in-one untuk administrasi guru Indonesia.",
  keywords: [
    "guru",
    "soal otomatis",
    "AI pendidikan",
    "pembuat soal",
    "taksonomi bloom",
    "hots",
    "lots",
    "administrasi guru",
    "GuruPRO",
  ],
  authors: [{ name: "GuruPRO Ecosystem" }],
  creator: "GuruPRO Ecosystem",
  metadataBase: new URL("https://gurupro.id"),
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "GuruPRO AI",
    title: "GuruPRO AI — Guru AI Asisten",
    description:
      "Buat soal ujian otomatis berbasis AI dengan Taksonomi Bloom (HOTS/LOTS).",
  },
  twitter: {
    card: "summary_large_image",
    title: "GuruPRO AI — Guru AI Asisten",
    description:
      "Buat soal ujian otomatis berbasis AI dengan Taksonomi Bloom (HOTS/LOTS).",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${jakartaSans.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        <meta name="application-name" content="GuruPRO AI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="GuruPRO AI" />
      </head>
      <body className="font-sans min-h-full flex flex-col bg-neutral-50 text-neutral-900 selection:bg-primary-600 selection:text-white">
        <PWARegister />
        <PWAInstallPrompt />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
