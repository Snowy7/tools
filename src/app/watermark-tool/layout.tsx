import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watermark Tool",
  description:
    "Add text or image watermarks to your photos with batch support. Control opacity, rotation, position, and tiled repeat patterns. Export with watermarks baked in.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
