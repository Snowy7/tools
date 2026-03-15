import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lorem Ipsum Generator",
  description: "Generate placeholder text in multiple fun styles — classic, hipster, corporate, pirate, space, and cat ipsum.",
};

export default function LoremGeneratorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
