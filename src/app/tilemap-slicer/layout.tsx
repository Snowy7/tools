import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tilemap Slicer",
  description: "Cut tileset images into individual tiles with grid overlay, selection tools, and metadata export for game development.",
};

export default function TilemapSlicerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
