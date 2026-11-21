import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AmbientBackground, LiquidGlassFilter } from "@/components/ambient";
import { Nav } from "@/components/nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "DocScan — OCR for invoices, receipts & IDs", template: "%s · DocScan" },
  description: "Scan documents, extract structured data, store it in PostgreSQL and export PDF reports.",
};

export const viewport: Viewport = { themeColor: "#05060a", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-[100dvh]">
        <AmbientBackground />
        <LiquidGlassFilter />
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-36 pt-10 md:px-8 md:pb-24 md:pt-32">{children}</main>
      </body>
    </html>
  );
}
