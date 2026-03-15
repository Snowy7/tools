import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Number Base Converter",
  description: "Convert numbers between binary, octal, decimal, hexadecimal, and custom bases (2-36). Bit visualization, bitwise operations, and two's complement support.",
};

export default function BaseConverterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
