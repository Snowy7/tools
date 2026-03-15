import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UUID & Hash Generator",
  description: "Generate UUIDs (v4, ULID, nanoid-style) and compute cryptographic hashes (SHA-1, SHA-256, SHA-384, SHA-512) for text and files with comparison mode.",
};

export default function UuidHashLayout({ children }: { children: React.ReactNode }) {
  return children;
}
