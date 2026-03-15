import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CSS Layout Builder",
  description: "Visual CSS Grid and Flexbox builder with live preview, area naming, presets, and instant CSS output.",
};

export default function CSSLayoutBuilderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
