import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: "Unternehmen — Target Intelligence",
  description: "Private Zielmarkt-Intelligence für den deutschen Mittelstand.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Unternehmen",
    description: "Zielmarkt-Intelligence für den deutschen Mittelstand.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Unternehmen — Zielmarkt-Intelligence für den deutschen Mittelstand",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Unternehmen",
    description: "Zielmarkt-Intelligence für den deutschen Mittelstand.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
