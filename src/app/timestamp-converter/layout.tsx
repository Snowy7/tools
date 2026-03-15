import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Timestamp Converter",
};

export default function TimestampConverterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
