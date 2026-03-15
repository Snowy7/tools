"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Binary,
  Check,
  Copy,
  Minimize2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { analyzeJson } from "@/lib/json-tools";

const SAMPLE_JSON = JSON.stringify(
  {
    project: "Snowy Tools",
    categories: ["creator", "developer", "gamedev"],
    flags: { localFirst: true, fast: true },
    stats: { tools: 7, aiEngines: 4 },
  },
  null,
  2,
);

export default function JsonStudioPage() {
  const [value, setValue] = useState(SAMPLE_JSON);
  const [copied, setCopied] = useState<"formatted" | "minified" | null>(null);
  const analysis = useMemo(() => analyzeJson(value), [value]);

  async function copyText(kind: "formatted" | "minified") {
    const text = kind === "formatted" ? analysis.formatted : analysis.minified;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>

        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <Binary size={14} />
          <span className="text-sm font-semibold">JSON Studio</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setValue(analysis.formatted)}
            disabled={!analysis.valid}
            className="inline-flex items-center gap-1.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] text-xs px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Wand2 size={12} />
            Format
          </button>
          <button
            type="button"
            onClick={() => setValue(analysis.minified)}
            disabled={!analysis.valid}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Minimize2 size={12} />
            Minify
          </button>
          <button
            type="button"
            onClick={() => setValue(SAMPLE_JSON)}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
          >
            <Sparkles size={12} />
            Sample
          </button>
          <button
            type="button"
            onClick={() => copyText("formatted")}
            disabled={!analysis.valid}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied === "formatted" ? <Check size={12} /> : <Copy size={12} />}
            {copied === "formatted" ? "Copied" : "Copy Formatted"}
          </button>
          <button
            type="button"
            onClick={() => copyText("minified")}
            disabled={!analysis.valid}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied === "minified" ? <Check size={12} /> : <Copy size={12} />}
            {copied === "minified" ? "Copied" : "Copy Minified"}
          </button>
        </div>
      </header>

      {/* Content: split panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: input */}
        <div className="flex-1 flex flex-col border-r border-[var(--border)]">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            spellCheck={false}
            className="flex-1 w-full resize-none bg-[var(--background)] text-[var(--foreground)] font-mono text-sm leading-6 p-4 outline-none"
            placeholder="Paste JSON here..."
          />
        </div>

        {/* Right panel: outputs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Formatted output */}
          <div className="flex-1 flex flex-col border-b border-[var(--border)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Formatted
              </span>
              <button
                type="button"
                onClick={() => copyText("formatted")}
                disabled={!analysis.valid}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied === "formatted" ? <Check size={11} /> : <Copy size={11} />}
                {copied === "formatted" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs leading-6 font-mono text-[var(--foreground)] bg-[var(--background)]">
              {analysis.formatted}
            </pre>
          </div>

          {/* Minified output */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Minified
              </span>
              <button
                type="button"
                onClick={() => copyText("minified")}
                disabled={!analysis.valid}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied === "minified" ? <Check size={11} /> : <Copy size={11} />}
                {copied === "minified" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs leading-6 font-mono text-[var(--foreground)] bg-[var(--background)] break-all whitespace-pre-wrap">
              {analysis.minified}
            </pre>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <footer className="flex items-center gap-3 px-4 py-1.5 border-t border-[var(--border)] bg-[var(--surface)] flex-shrink-0 text-xs">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
            analysis.valid
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {analysis.valid ? "Valid JSON" : "Invalid JSON"}
        </span>
        <span className="text-[var(--muted)]">{analysis.size} bytes</span>
        {!analysis.valid && analysis.error && (
          <span className="text-red-400 truncate">{analysis.error}</span>
        )}
      </footer>
    </div>
  );
}
