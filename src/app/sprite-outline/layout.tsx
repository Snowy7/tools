import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sprite Outline & Glow",
  description:
    "Add outline, glow, drop shadow, and color flash effects to sprites for 2D games. Pure canvas-based with batch mode, zoom levels, and PNG export. Free tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/sprite-outline" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
