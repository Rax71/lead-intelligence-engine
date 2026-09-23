import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Intelligence Engine",
  description: "Captação e qualificação inteligente de leads",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
