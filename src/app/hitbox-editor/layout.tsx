import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hitbox Editor",
  description:
    "Draw collision boxes and hitbox regions over sprite images for game development. Supports rectangles, circles, and polygons with JSON export for game engines.",
};

export default function HitboxEditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
