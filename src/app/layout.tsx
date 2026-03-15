import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tools by Snowy — Free Creative Toolkit",
    template: "%s | Tools by Snowy",
  },
  description:
    "Free browser-based creative tools — font creator, QR generator, AI background remover, and image studio. No uploads to servers, everything runs locally.",
  keywords: [
    "font creator",
    "QR code generator",
    "background remover",
    "image editor",
    "image effects",
    "free tools",
    "browser tools",
    "online tools",
    "Snowy",
    "snowydev",
  ],
  authors: [{ name: "Snowy (Islam)", url: "https://snowydev.xyz" }],
  creator: "Snowy",
  publisher: "Snowy",
  metadataBase: new URL("https://tools.snowydev.xyz"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://tools.snowydev.xyz",
    siteName: "Tools by Snowy",
    title: "Tools by Snowy — Free Creative Toolkit",
    description:
      "Free browser-based creative tools. Font creator, QR generator, AI background remover, and image studio — all running locally in your browser.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tools by Snowy — Free Creative Toolkit",
    description:
      "Free browser-based creative tools. Everything runs locally, no server uploads.",
    creator: "@snowydev",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://tools.snowydev.xyz",
  },
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
