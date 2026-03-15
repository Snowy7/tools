import type { Metadata } from "next";
import Link from "next/link";
import { TOOL_DEFINITIONS } from "@/lib/tool-catalog";

export const metadata: Metadata = {
  title: "Tools by Snowy — Free Creative Toolkit",
  description:
    "Free browser-based creative tools by Snowy. Image editing, QR codes, AI background removal, fonts, palettes, sprite sheets, JSON utilities. Everything runs locally.",
  alternates: { canonical: "https://tools.snowydev.xyz" },
};

export default function Home() {
  return (
    <main className="min-h-screen p-6 md:p-12 lg:p-16 bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Tools</h1>
        <p className="text-[var(--muted)] mb-1">
          Free creative tools that run entirely in your browser.
        </p>
        <p className="text-xs text-[var(--muted)] mb-10">
          Made by{" "}
          <a
            href="https://snowydev.xyz"
            className="text-[var(--accent)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Snowy
          </a>{" "}
          — no data leaves your device.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOL_DEFINITIONS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex flex-col gap-3 p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <div className="text-[var(--accent)]">{tool.icon}</div>
              <div>
                <h2 className="font-medium mb-1 group-hover:text-[var(--accent)] transition-colors">
                  {tool.name}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  {tool.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
