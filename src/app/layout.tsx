import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: {
    default: "ToolBox - Ein Tool für alles",
    template: "%s | ToolBox",
  },
  description: "Kostenloses Online-Tool für Bilder, PDFs, JSON, Text und mehr. Drei einfache Schritte: Hochladen → Bearbeiten → Exportieren. Alles läuft in deinem Browser.",
  keywords: ["Online Tools", "Bild Komprimieren", "PDF", "JSON", "Text Tools", "Konverter", "Browser Tools", "Kostenlos"],
  authors: [{ name: "ToolBox" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-512.png",
  },
  openGraph: {
    title: "ToolBox - Ein Tool für alles",
    description: "Kostenloses Online-Tool. Drei einfache Schritte: Hochladen → Bearbeiten → Exportieren.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ToolBox - Ein Tool für alles",
    description: "Kostenloses Online-Tool für Bilder, PDFs, JSON und mehr.",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
