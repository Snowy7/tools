import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shadow Generator",
  description:
    "Create beautiful CSS box-shadow and text-shadow properties visually. Multiple layers, presets, live preview, and instant CSS output. Free tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/shadow-generator" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
