import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thumbnail Maker",
  description:
    "Create eye-catching thumbnails for YouTube, Instagram, Twitter, Facebook, Pinterest, and TikTok with text overlays, safe zone guides, and background controls.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
