"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Clipboard,
  GitCompare,
  SlidersHorizontal,
  TestTube,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DiffLine =
  | { type: "unchanged"; text: string; oldLine: number; newLine: number }
  | { type: "added"; text: string; newLine: number }
  | { type: "removed"; text: string; oldLine: number };

type ViewMode = "split" | "unified" | "inline";

/* ------------------------------------------------------------------ */
/*  LCS-based Diff Algorithm                                           */
/* ------------------------------------------------------------------ */

function computeDiff(original: string, modified: string): DiffLine[] {
  const a = original.split("\n");
  const b = modified.split("\n");
  const m = a.length;
  const n = b.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ type: "unchanged", text: a[i - 1], oldLine: i, newLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", text: b[j - 1], newLine: j });
      j--;
    } else {
      result.push({ type: "removed", text: a[i - 1], oldLine: i });
      i--;
    }
  }

  return result.reverse();
}

function computeDiffWithOptions(
  original: string,
  modified: string,
  ignoreWhitespace: boolean,
  ignoreCase: boolean,
): DiffLine[] {
  let a = original;
  let b = modified;

  if (ignoreWhitespace) {
    // Normalize whitespace for comparison but keep original text for display
    const normalizeWs = (s: string) =>
      s
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .join("\n");
    a = normalizeWs(a);
    b = normalizeWs(b);
  }

  if (ignoreCase) {
    a = a.toLowerCase();
    b = b.toLowerCase();
  }

  // Compute diff on normalized text
  const normalizedDiff = computeDiff(a, b);

  // Map back to original text
  const origLines = original.split("\n");
  const modLines = modified.split("\n");

  return normalizedDiff.map((line) => {
    if (line.type === "unchanged") {
      return { ...line, text: origLines[line.oldLine - 1] ?? line.text };
    } else if (line.type === "removed") {
      return { ...line, text: origLines[line.oldLine - 1] ?? line.text };
    } else {
      return { ...line, text: modLines[line.newLine - 1] ?? line.text };
    }
  });
}

function filterByContext(diff: DiffLine[], contextLines: number): DiffLine[] {
  if (contextLines >= 10) return diff;

  const changeIndices = new Set<number>();
  diff.forEach((line, idx) => {
    if (line.type !== "unchanged") {
      changeIndices.add(idx);
    }
  });

  const visible = new Set<number>();
  changeIndices.forEach((idx) => {
    for (let c = idx - contextLines; c <= idx + contextLines; c++) {
      if (c >= 0 && c < diff.length) visible.add(c);
    }
  });

  return diff.filter((_, idx) => visible.has(idx));
}

/* ------------------------------------------------------------------ */
/*  Sample Data                                                        */
/* ------------------------------------------------------------------ */

const SAMPLE_ORIGINAL = `{
  "name": "my-app",
  "version": "1.0.0",
  "description": "A simple web application",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.17.1",
    "lodash": "^4.17.21"
  },
  "license": "MIT"
}`;

const SAMPLE_MODIFIED = `{
  "name": "my-app",
  "version": "1.1.0",
  "description": "A modern web application with TypeScript",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "test": "jest --coverage",
    "lint": "eslint src/"
  },
  "dependencies": {
    "express": "^4.18.2",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/express": "^4.17.21"
  },
  "license": "MIT"
}`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DiffViewerPage() {
  const [original, setOriginal] = useState("");
  const [modified, setModified] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [contextLines, setContextLines] = useState(10);
  const [showOptions, setShowOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  const diff = useMemo(() => {
    if (!original && !modified) return [];
    return computeDiffWithOptions(original, modified, ignoreWhitespace, ignoreCase);
  }, [original, modified, ignoreWhitespace, ignoreCase]);

  const filteredDiff = useMemo(() => filterByContext(diff, contextLines), [diff, contextLines]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    let unchanged = 0;
    diff.forEach((line) => {
      if (line.type === "added") added++;
      else if (line.type === "removed") removed++;
      else unchanged++;
    });
    return { added, removed, unchanged };
  }, [diff]);

  const loadSample = useCallback(() => {
    setOriginal(SAMPLE_ORIGINAL);
    setModified(SAMPLE_MODIFIED);
  }, []);

  const swapTexts = useCallback(() => {
    setOriginal((prev) => {
      setModified(original);
      return modified;
    });
  }, [original, modified]);

  const copyDiffOutput = useCallback(async () => {
    const output = filteredDiff
      .map((line) => {
        if (line.type === "added") return `+ ${line.text}`;
        if (line.type === "removed") return `- ${line.text}`;
        return `  ${line.text}`;
      })
      .join("\n");
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [filteredDiff]);

  const hasDiff = original.length > 0 || modified.length > 0;

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
          <GitCompare size={14} />
          <span className="text-sm font-semibold">Diff Viewer</span>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 ml-4 bg-[var(--background)] rounded-lg p-0.5 border border-[var(--border)]">
          {(["split", "unified", "inline"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`text-xs px-2.5 py-1 rounded-md capitalize transition-colors ${
                viewMode === mode
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Load sample */}
          <button
            type="button"
            onClick={loadSample}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <TestTube size={12} />
            Load Sample
          </button>

          {/* Swap */}
          <button
            type="button"
            onClick={swapTexts}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <ArrowLeftRight size={12} />
            Swap
          </button>

          {/* Copy diff */}
          {hasDiff && (
            <button
              type="button"
              onClick={copyDiffOutput}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {copied ? <Check size={12} /> : <Clipboard size={12} />}
              {copied ? "Copied" : "Copy Diff"}
            </button>
          )}

          {/* Options toggle */}
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              showOptions
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <SlidersHorizontal size={12} />
            Options
          </button>
        </div>
      </header>

      {/* Options bar */}
      {showOptions && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-[var(--foreground)] cursor-pointer">
            <input
              type="checkbox"
              checked={ignoreWhitespace}
              onChange={(e) => setIgnoreWhitespace(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Ignore whitespace
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[var(--foreground)] cursor-pointer">
            <input
              type="checkbox"
              checked={ignoreCase}
              onChange={(e) => setIgnoreCase(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Ignore case
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[var(--foreground)] cursor-pointer">
            <input
              type="checkbox"
              checked={showLineNumbers}
              onChange={(e) => setShowLineNumbers(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Line numbers
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">Context:</span>
            <input
              type="range"
              min={0}
              max={10}
              value={contextLines}
              onChange={(e) => setContextLines(Number(e.target.value))}
              className="w-24 accent-[var(--accent)]"
            />
            <span className="text-xs text-[var(--foreground)] font-mono w-4 text-center">
              {contextLines === 10 ? "All" : contextLines}
            </span>
          </div>
        </div>
      )}

      {/* Stats bar */}
      {hasDiff && diff.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
          <span className="text-xs text-emerald-600 font-medium">+{stats.added} additions</span>
          <span className="text-xs text-red-600 font-medium">-{stats.removed} deletions</span>
          <span className="text-xs text-[var(--muted)]">{stats.unchanged} unchanged</span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Input textareas */}
        <div className="flex flex-shrink-0 border-b border-[var(--border)]" style={{ height: "40%" }}>
          {/* Original */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--border)]">
            <div className="flex items-center px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
              <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                Original
              </span>
            </div>
            <textarea
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
              placeholder="Paste or type original text..."
              spellCheck={false}
              className="flex-1 w-full resize-none bg-transparent font-mono text-sm text-[var(--foreground)] p-3 outline-none placeholder:text-[var(--muted)]/40"
            />
          </div>

          {/* Modified */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
              <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                Modified
              </span>
            </div>
            <textarea
              value={modified}
              onChange={(e) => setModified(e.target.value)}
              placeholder="Paste or type modified text..."
              spellCheck={false}
              className="flex-1 w-full resize-none bg-transparent font-mono text-sm text-[var(--foreground)] p-3 outline-none placeholder:text-[var(--muted)]/40"
            />
          </div>
        </div>

        {/* Diff output */}
        <div className="flex-1 min-h-0 overflow-auto">
          {!hasDiff ? (
            <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
              Enter text in both panels or load a sample to see the diff
            </div>
          ) : diff.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
              Both texts are identical
            </div>
          ) : viewMode === "split" ? (
            <SplitView diff={filteredDiff} showLineNumbers={showLineNumbers} />
          ) : viewMode === "unified" ? (
            <UnifiedView diff={filteredDiff} showLineNumbers={showLineNumbers} />
          ) : (
            <InlineView diff={filteredDiff} showLineNumbers={showLineNumbers} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Split View                                                         */
/* ------------------------------------------------------------------ */

function SplitView({ diff, showLineNumbers }: { diff: DiffLine[]; showLineNumbers: boolean }) {
  // Build left (original) and right (modified) columns
  const rows: { left: DiffLine | null; right: DiffLine | null }[] = [];
  let i = 0;

  while (i < diff.length) {
    const line = diff[i];
    if (line.type === "unchanged") {
      rows.push({ left: line, right: line });
      i++;
    } else if (line.type === "removed") {
      // Collect consecutive removals and additions to pair them
      const removals: DiffLine[] = [];
      const additions: DiffLine[] = [];

      while (i < diff.length && diff[i].type === "removed") {
        removals.push(diff[i]);
        i++;
      }
      while (i < diff.length && diff[i].type === "added") {
        additions.push(diff[i]);
        i++;
      }

      const maxLen = Math.max(removals.length, additions.length);
      for (let k = 0; k < maxLen; k++) {
        rows.push({
          left: k < removals.length ? removals[k] : null,
          right: k < additions.length ? additions[k] : null,
        });
      }
    } else {
      // added without preceding removal
      rows.push({ left: null, right: line });
      i++;
    }
  }

  return (
    <div className="flex h-full">
      {/* Left (original) */}
      <div className="flex-1 overflow-auto border-r border-[var(--border)]">
        <table className="w-full font-mono text-xs">
          <tbody>
            {rows.map((row, idx) => {
              const line = row.left;
              const bgClass =
                line?.type === "removed"
                  ? "bg-red-50"
                  : line?.type === "unchanged"
                    ? ""
                    : "bg-[var(--background)]";
              const textClass = line?.type === "removed" ? "text-red-800" : "text-[var(--foreground)]";

              return (
                <tr key={idx} className={bgClass}>
                  {showLineNumbers && (
                    <td className="w-10 text-right pr-2 py-0.5 text-[var(--muted)] select-none border-r border-[var(--border)] bg-[var(--surface)]">
                      {line && line.type !== "added" && "oldLine" in line ? line.oldLine : ""}
                    </td>
                  )}
                  <td className={`px-3 py-0.5 whitespace-pre ${textClass}`}>
                    {line ? line.text : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Right (modified) */}
      <div className="flex-1 overflow-auto">
        <table className="w-full font-mono text-xs">
          <tbody>
            {rows.map((row, idx) => {
              const line = row.right;
              const bgClass =
                line?.type === "added"
                  ? "bg-emerald-50"
                  : line?.type === "unchanged"
                    ? ""
                    : "bg-[var(--background)]";
              const textClass = line?.type === "added" ? "text-emerald-800" : "text-[var(--foreground)]";

              return (
                <tr key={idx} className={bgClass}>
                  {showLineNumbers && (
                    <td className="w-10 text-right pr-2 py-0.5 text-[var(--muted)] select-none border-r border-[var(--border)] bg-[var(--surface)]">
                      {line && line.type !== "removed" && "newLine" in line ? line.newLine : ""}
                    </td>
                  )}
                  <td className={`px-3 py-0.5 whitespace-pre ${textClass}`}>
                    {line ? line.text : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Unified View                                                       */
/* ------------------------------------------------------------------ */

function UnifiedView({ diff, showLineNumbers }: { diff: DiffLine[]; showLineNumbers: boolean }) {
  return (
    <table className="w-full font-mono text-xs">
      <tbody>
        {diff.map((line, idx) => {
          let bgClass = "";
          let textClass = "text-[var(--foreground)]";
          let prefix = " ";

          if (line.type === "added") {
            bgClass = "bg-emerald-50";
            textClass = "text-emerald-800";
            prefix = "+";
          } else if (line.type === "removed") {
            bgClass = "bg-red-50";
            textClass = "text-red-800";
            prefix = "-";
          }

          return (
            <tr key={idx} className={bgClass}>
              {showLineNumbers && (
                <>
                  <td className="w-10 text-right pr-1 py-0.5 text-[var(--muted)] select-none border-r border-[var(--border)] bg-[var(--surface)]">
                    {line.type !== "added" && "oldLine" in line ? line.oldLine : ""}
                  </td>
                  <td className="w-10 text-right pr-1 py-0.5 text-[var(--muted)] select-none border-r border-[var(--border)] bg-[var(--surface)]">
                    {line.type !== "removed" && "newLine" in line ? line.newLine : ""}
                  </td>
                </>
              )}
              <td className={`w-5 text-center py-0.5 select-none font-bold ${textClass}`}>{prefix}</td>
              <td className={`px-3 py-0.5 whitespace-pre ${textClass}`}>{line.text}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline View                                                        */
/* ------------------------------------------------------------------ */

function InlineView({ diff, showLineNumbers }: { diff: DiffLine[]; showLineNumbers: boolean }) {
  // Group consecutive changes together for inline rendering
  const segments: React.ReactNode[] = [];
  let lineNum = 0;

  let i = 0;
  while (i < diff.length) {
    const line = diff[i];

    if (line.type === "unchanged") {
      lineNum++;
      segments.push(
        <div key={`u-${i}`} className="flex">
          {showLineNumbers && (
            <span className="w-10 text-right pr-2 py-0.5 text-[var(--muted)] select-none border-r border-[var(--border)] bg-[var(--surface)] flex-shrink-0 font-mono text-xs">
              {lineNum}
            </span>
          )}
          <span className="px-3 py-0.5 whitespace-pre font-mono text-xs text-[var(--foreground)]">
            {line.text}
          </span>
        </div>,
      );
      i++;
    } else {
      // Collect consecutive removals and additions
      const removals: string[] = [];
      const additions: string[] = [];

      while (i < diff.length && diff[i].type === "removed") {
        removals.push(diff[i].text);
        i++;
      }
      while (i < diff.length && diff[i].type === "added") {
        additions.push(diff[i].text);
        i++;
      }

      lineNum++;
      segments.push(
        <div key={`c-${i}`} className="flex">
          {showLineNumbers && (
            <span className="w-10 text-right pr-2 py-0.5 text-[var(--muted)] select-none border-r border-[var(--border)] bg-[var(--surface)] flex-shrink-0 font-mono text-xs">
              {lineNum}
            </span>
          )}
          <span className="px-3 py-0.5 whitespace-pre-wrap font-mono text-xs">
            {removals.length > 0 && (
              <span className="bg-red-50 text-red-800 line-through">{removals.join("\n")}</span>
            )}
            {additions.length > 0 && (
              <span className="bg-emerald-50 text-emerald-800">{additions.join("\n")}</span>
            )}
          </span>
        </div>,
      );
    }
  }

  return <div>{segments}</div>;
}
