import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Compressor",
  description:
    "Compress and convert images between PNG, JPEG, WebP, and AVIF with quality control. Batch support. Free browser tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/image-compressor" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
