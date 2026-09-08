import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: {
    default: "Site Docs | Enterprise Document & Accounting Management Portal",
    template: "%s | Site Docs",
  },
  description:
    "Enterprise document management, multi-site accounting reconciliation, automated invoice OCR extraction, and multi-format bulk export.",
  applicationName: "Site Docs Portal",
  authors: [{ name: "Site Docs Engineering" }],
  keywords: [
    "document management",
    "invoice OCR",
    "construction accounting",
    "challan",
    "credit note",
    "ledger statement",
    "site reconciliation",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Site Docs Portal",
    title: "Site Docs | Enterprise Document Management Portal",
    description:
      "Enterprise document management, multi-site accounting reconciliation, automated invoice OCR extraction, and bulk export.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Site Docs | Enterprise Document Management Portal",
    description:
      "Enterprise document management, multi-site accounting reconciliation, automated invoice OCR extraction, and bulk export.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-primary-foreground">
        {children}
      </body>
    </html>
  );
}
