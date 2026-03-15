import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pixel Font Builder",
  description:
    "Build bitmap pixel fonts for retro games. Draw characters on a pixel grid and export as a font atlas PNG with metadata JSON. Free browser-based tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/pixel-font-builder" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
