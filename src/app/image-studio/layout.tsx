import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Studio",
  description:
    "Professional image editor with filters, adjustments, effects, color grading, crop, and transform. 13 adjustment sliders, 12 filter presets, 8 effects. Free tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/image-studio" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
