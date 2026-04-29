import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const sidebarMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-sidebar-mono",
});

export const metadata: Metadata = {
  title: "DebateRoom | The Global Discourse Platform",
  description: "High-stakes 1v1 debate moderated by forensic AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.className} ${sidebarMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
