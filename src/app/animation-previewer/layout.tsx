import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Animation Previewer",
  description: "Preview sprite frame animations with playback controls, timing adjustments, and onion skinning for smooth motion review.",
};

export default function AnimationPreviewerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
