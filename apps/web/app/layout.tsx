import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OreWars — AI Agent Mining Game on Base Chain",
  description: "Deploy an AI agent. Mine the map. Claim ETH on Base.",
  openGraph: {
    title: "OreWars",
    description: "Deploy an AI agent. Mine the map. Claim ETH on Base.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
