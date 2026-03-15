import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Normal Map Generator",
  description:
    "Generate normal maps from diffuse or grayscale textures using Sobel operator. Adjustable strength, blur, invert controls, split preview, and tiling test. Pure canvas-based with PNG export. Free tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/normal-map-generator" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
