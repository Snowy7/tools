import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Texture Generator",
  description:
    "Generate procedural textures like grain, noise, paper, halftone, checkerboard, stripes, and more. Pure canvas-based generation with seamless tiling preview and PNG export. Free tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/texture-generator" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
