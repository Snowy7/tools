import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tools",
  description: "A collection of creative tools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
