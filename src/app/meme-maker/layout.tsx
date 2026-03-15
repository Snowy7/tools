import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meme Maker",
  description:
    "Create memes with text overlays, stickers, and custom images. Classic meme-style text with outlines, draggable text boxes, and canvas stickers. Free tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/meme-maker" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
