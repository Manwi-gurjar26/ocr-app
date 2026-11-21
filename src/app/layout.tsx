import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AmbientBackground, LiquidGlassFilter } from "@/components/ambient";
import { Nav } from "@/components/nav";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "DocScan — OCR for invoices, receipts & IDs", template: "%s · DocScan" },
  description: "Scan documents, extract structured data, store it in PostgreSQL and export PDF reports.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1f7" },
    { media: "(prefers-color-scheme: dark)", color: "#05060a" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <head>
        {/* sets data-theme before first paint (no flash) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-[100dvh]">
        <AmbientBackground />
        <LiquidGlassFilter />
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-36 pt-20 md:px-8 md:pb-24 md:pt-32">{children}</main>
      </body>
    </html>
  );
}
