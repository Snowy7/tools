"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  Image as ImageIcon,
  Palette,
  Gamepad2,
  Code,
  Type,
  QrCode,
  Search,
} from "lucide-react";
import { TOOL_DEFINITIONS } from "@/lib/tool-catalog";
import type { ReactNode } from "react";

// export const metadata is not supported in client components;
// move metadata to a layout.tsx or use generateMetadata in a parent if needed.

/* ------------------------------------------------------------------ */
/*  Group definitions                                                  */
/* ------------------------------------------------------------------ */

interface Group {
  key: string;
  label: string;
  icon: ReactNode;
}

const GROUPS: Group[] = [
  { key: "content", label: "Image & Media", icon: <ImageIcon size={18} /> },
  { key: "design", label: "Design", icon: <Palette size={18} /> },
  { key: "gamedev", label: "Game Dev", icon: <Gamepad2 size={18} /> },
  { key: "developer", label: "Developer", icon: <Code size={18} /> },
  { key: "branding", label: "Branding", icon: <Type size={18} /> },
  { key: "marketing", label: "Marketing", icon: <QrCode size={18} /> },
];

const GROUP_MAP = new Map(GROUPS.map((g) => [g.key, g]));

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const isSearching = query.trim().length > 0;

  /* Filtered tool list */
  const filtered = useMemo(() => {
    let tools = TOOL_DEFINITIONS;

    if (activeGroup) {
      tools = tools.filter((t) => t.audience === activeGroup);
    }

    if (isSearching) {
      const q = query.toLowerCase();
      tools = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }

    return tools;
  }, [query, activeGroup, isSearching]);

  /* Tools grouped by audience */
  const grouped = useMemo(() => {
    const map = new Map<string, typeof TOOL_DEFINITIONS>();
    for (const tool of filtered) {
      const list = map.get(tool.audience) ?? [];
      list.push(tool);
      map.set(tool.audience, list);
    }
    return GROUPS.filter((g) => map.has(g.key)).map((g) => ({
      ...g,
      tools: map.get(g.key)!,
    }));
  }, [filtered]);

  return (
    <main className="min-h-screen p-6 md:p-12 lg:p-16 bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-5xl mx-auto">
        {/* ── Header ── */}
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Tools by Snowy
        </h1>
        <p className="text-[var(--muted)] mb-1">
          Free browser-based tools for creators, developers, and game makers.
        </p>
        <p className="text-xs text-[var(--muted)] mb-8">
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

        {/* ── Search ── */}
        <div className="relative mb-4">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${TOOL_DEFINITIONS.length} tools...`}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-shadow"
          />
        </div>

        {/* ── Category pills ── */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveGroup(null)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              activeGroup === null
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)]"
            }`}
          >
            All
            <span className="opacity-70">{TOOL_DEFINITIONS.length}</span>
          </button>

          {GROUPS.map((g) => {
            const count = TOOL_DEFINITIONS.filter(
              (t) => t.audience === g.key,
            ).length;
            const isActive = activeGroup === g.key;
            return (
              <button
                key={g.key}
                onClick={() => setActiveGroup(isActive ? null : g.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  isActive
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)]"
                }`}
              >
                {g.icon}
                {g.label}
                <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Results ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[var(--muted)]">
            <p className="text-sm">No tools match your search.</p>
          </div>
        ) : isSearching ? (
          /* Flat search results */
          <section>
            <p className="text-xs text-[var(--muted)] mb-3">
              {filtered.length} result{filtered.length !== 1 && "s"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((tool) => (
                <ToolCard key={tool.href} tool={tool} />
              ))}
            </div>
          </section>
        ) : (
          /* Grouped sections */
          <div className="space-y-10">
            {grouped.map((group) => (
              <section key={group.key}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[var(--accent)]">{group.icon}</span>
                  <h2 className="text-sm font-semibold">{group.label}</h2>
                  <span className="text-xs text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] rounded-full px-2 py-0.5">
                    {group.tools.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.tools.map((tool) => (
                    <ToolCard key={tool.href} tool={tool} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── Footer stat ── */}
        <div className="mt-16 pt-6 border-t border-[var(--border)] text-center">
          <p className="text-xs text-[var(--muted)]">
            {TOOL_DEFINITIONS.length} tools — all free, all private, all
            in-browser.
          </p>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Tool card                                                          */
/* ------------------------------------------------------------------ */

function ToolCard({ tool }: { tool: (typeof TOOL_DEFINITIONS)[number] }) {
  const group = GROUP_MAP.get(tool.audience);

  return (
    <Link
      href={tool.href}
      className="group flex items-start gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors"
    >
      <div className="text-[var(--accent)] mt-0.5 flex-shrink-0">
        {tool.icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-medium group-hover:text-[var(--accent)] transition-colors">
          {tool.name}
        </h3>
        <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">
          {tool.description}
        </p>
      </div>
    </Link>
  );
}
