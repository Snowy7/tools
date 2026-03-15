import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Icon Browser",
  description: "Browse, search, and customize 1400+ Lucide icons. Copy as SVG, JSX, or React import with adjustable size, color, and stroke width.",
};

export default function IconBrowserLayout({ children }: { children: React.ReactNode }) {
  return children;
}
