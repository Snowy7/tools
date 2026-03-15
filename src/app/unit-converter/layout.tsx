import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unit Converter",
  description: "Universal unit converter for length, weight, temperature, area, volume, speed, time, data, CSS/web units, and pressure. Bidirectional conversion with formula display and history.",
};

export default function UnitConverterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
