import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobTracker",
  description: "Track job applications from saved to offer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
