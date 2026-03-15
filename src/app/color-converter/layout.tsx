import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Color Converter",
  description: "Convert colors between HEX, RGB, HSL, HSB/HSV, and CMYK formats with live preview, Tailwind CSS matching, and color harmony generation.",
};

export default function ColorConverterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
