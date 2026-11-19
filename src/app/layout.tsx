import type { Metadata } from "next";
import localFont from "next/font/local";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// Archivo, SIL OFL 1.1: see fonts/Archivo-OFL.txt
const archivo = localFont({
  src: "./fonts/archivo-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-archivo",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "JobTracker",
  description: "Track job applications from saved to offer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
