import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gradient Generator",
  description:
    "Create beautiful CSS gradients with a visual editor. Supports linear, radial, and conic gradients with custom color stops, presets, and instant CSS output. Free tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/gradient-generator" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
