import type { Metadata } from "next";
import { Sora, Space_Mono } from "next/font/google";
import "./globals.css";
import { PageTransition } from "@/components/ui/page-transition";
import { Toaster } from "sonner";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Passer | Volleyball Intelligence Platform",
  description:
    "Passer helps volleyball athletes turn raw match footage into polished insights, highlight reels, and recruiting-ready profiles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sora.variable} ${spaceMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <PageTransition>{children}</PageTransition>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.7)",
              boxShadow: "0 18px 45px -34px rgba(0, 37, 92, 0.92)",
            },
          }}
          richColors
        />
      </body>
    </html>
  );
}
