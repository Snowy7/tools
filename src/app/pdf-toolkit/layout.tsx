import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF Toolkit",
  description:
    "Merge, split, rotate, reorder, and extract PDF pages entirely in your browser. Free PDF tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/pdf-toolkit" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
