import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QR Code Generator",
  description:
    "Create custom QR codes with colors, logos, styles (dots, rounded, diamond, star). Export PNG, SVG. Supports WiFi, email, phone, SMS. Free tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/qr-generator" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
