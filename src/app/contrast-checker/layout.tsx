import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contrast Checker",
  description: "Check WCAG accessibility color contrast ratios between foreground and background colors. Verify AA and AAA compliance for normal and large text.",
};

export default function ContrastCheckerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
