import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Font Creator",
  description:
    "Draw custom fonts, import existing ones, or extract glyphs from images. Export to OTF, TTF, WOFF, SVG. Free browser-based tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/font-creator" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
