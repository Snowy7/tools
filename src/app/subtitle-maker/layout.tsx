import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subtitle Maker",
  description: "Create and edit SRT subtitle files with a timeline view, video preview, and precise timing controls.",
};

export default function SubtitleMakerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
