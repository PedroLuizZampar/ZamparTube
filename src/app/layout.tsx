import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "ZamparTube",
  description: "Seus canais, sem distrações.",
};

export const viewport: Viewport = {
  themeColor: "#1B1C20",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions (e.g. BRy Web, ColorZilla) add attributes to <html>/<body> before React loads;
    // ignore attribute differences on these two tags only (it does not reach their children).
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-bg font-sans text-text" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
