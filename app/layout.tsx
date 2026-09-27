import type { Metadata } from "next";
import { Nunito, Bree_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });
const bree = Bree_Serif({ subsets: ["latin"], weight: "400", variable: "--font-bree" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "ConQuest",
  description: "Go further. Get closer. Small real-life quests with friends, planned by AI.",
  icons: { icon: "/logo-anchor.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${nunito.variable} ${bree.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
