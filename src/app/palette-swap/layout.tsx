import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Palette Swap",
  description: "Upload a sprite image, auto-detect its color palette, and remap colors to create palette variants for game development. Supports presets, hue/saturation/lightness shifts, and tolerance for anti-aliased sprites.",
};

export default function PaletteSwapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
