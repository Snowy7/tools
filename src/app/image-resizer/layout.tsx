import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Resizer",
  description:
    "Resize, crop, and rotate images with presets for social media. Batch support with dimension, percentage, and file size targeting. Free browser tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/image-resizer" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
