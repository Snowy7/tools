import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Base64 Tool",
  description: "Encode and decode text and files between Base64, URL encoding, HTML entities, and hexadecimal formats with live conversion and smart detection.",
};

export default function Base64ToolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
