"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileCode2,
  Copy,
  Check,
  Download,
  ArrowRightLeft,
  AlertTriangle,
  SortAsc,
  Trash2,
  MessageSquareOff,
  Group,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface EnvLine {
  raw: string;
  key: string;
  value: string;
  isComment: boolean;
  isEmpty: boolean;
  prefix: string;
  issues: string[];
}

interface Issue {
  line: number;
  message: string;
  severity: "error" | "warning";
}

type OutputFormat = "env" | "json";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseEnvLine(raw: string, lineNum: number): { parsed: EnvLine; issues: Issue[] } {
  const trimmed = raw.trim();
  const issues: Issue[] = [];

  if (!trimmed || trimmed.startsWith("#")) {
    return {
      parsed: { raw, key: "", value: "", isComment: trimmed.startsWith("#"), isEmpty: !trimmed, prefix: "", issues: [] },
      issues: [],
    };
  }

  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) {
    issues.push({ line: lineNum, message: `Missing '=' sign`, severity: "error" });
    return {
      parsed: { raw, key: trimmed, value: "", isComment: false, isEmpty: false, prefix: "", issues: ["Missing '='"] },
      issues,
    };
  }

  const rawKey = trimmed.slice(0, eqIdx);
  const rawValue = trimmed.slice(eqIdx + 1);
  const key = rawKey.trim();
  const value = rawValue.trim();
  const lineIssues: string[] = [];

  // Detect spaces around =
  if (rawKey !== key || rawValue !== rawValue.trimStart()) {
    const msg = "Spaces around '='";
    issues.push({ line: lineNum, message: msg, severity: "warning" });
    lineIssues.push(msg);
  }

  // Values with spaces should be quoted
  if (value.includes(" ") && !value.startsWith('"') && !value.startsWith("'")) {
    const msg = "Value with spaces should be quoted";
    issues.push({ line: lineNum, message: msg, severity: "warning" });
    lineIssues.push(msg);
  }

  // Invalid key characters
  if (key && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    const msg = "Invalid key characters";
    issues.push({ line: lineNum, message: msg, severity: "error" });
    lineIssues.push(msg);
  }

  // Extract prefix (everything before last _)
  const underIdx = key.lastIndexOf("_");
  const prefix = underIdx > 0 ? key.slice(0, key.indexOf("_") + 1) : "";

  return {
    parsed: { raw, key, value, isComment: false, isEmpty: false, prefix: prefix.toUpperCase(), issues: lineIssues },
    issues,
  };
}

function formatAsEnv(lines: EnvLine[], grouped: boolean): string {
  if (!grouped) {
    return lines.map((l) => (l.isComment || l.isEmpty ? l.raw : `${l.key}=${l.value}`)).join("\n");
  }

  // Group by prefix
  const groups = new Map<string, EnvLine[]>();
  const noPrefix: EnvLine[] = [];

  for (const l of lines) {
    if (l.isComment || l.isEmpty) continue;
    if (l.prefix) {
      const arr = groups.get(l.prefix) ?? [];
      arr.push(l);
      groups.set(l.prefix, arr);
    } else {
      noPrefix.push(l);
    }
  }

  const parts: string[] = [];
  const sortedPrefixes = Array.from(groups.keys()).sort();

  for (const prefix of sortedPrefixes) {
    const entries = groups.get(prefix)!;
    parts.push(`# ${prefix.replace(/_$/, "")} Configuration`);
    for (const e of entries) {
      parts.push(`${e.key}=${e.value}`);
    }
    parts.push("");
  }

  if (noPrefix.length > 0) {
    parts.push("# Other");
    for (const e of noPrefix) {
      parts.push(`${e.key}=${e.value}`);
    }
  }

  return parts.join("\n").trim();
}

function envToJson(lines: EnvLine[]): string {
  const obj: Record<string, string> = {};
  for (const l of lines) {
    if (l.isComment || l.isEmpty || !l.key) continue;
    // Remove surrounding quotes from value
    let v = l.value;
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    obj[l.key] = v;
  }
  return JSON.stringify(obj, null, 2);
}

function jsonToEnv(json: string): string {
  try {
    const obj = JSON.parse(json);
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return "# Error: JSON must be a flat object";
    return Object.entries(obj)
      .map(([k, v]) => {
        const val = String(v);
        const needsQuotes = val.includes(" ") || val.includes("=") || val.includes("#");
        return `${k}=${needsQuotes ? `"${val}"` : val}`;
      })
      .join("\n");
  } catch {
    return "# Error: Invalid JSON";
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EnvFormatterPage() {
  const [input, setInput] = useState("");
  const [sortAlpha, setSortAlpha] = useState(false);
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [removeComments, setRemoveComments] = useState(false);
  const [groupByPrefix, setGroupByPrefix] = useState(true);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("env");
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  // ── Parse ──────────────────────────────────────────────────────────────────

  const { parsed, allIssues } = useMemo(() => {
    const rawLines = input.split("\n");
    const allParsed: EnvLine[] = [];
    const allIssues: Issue[] = [];

    rawLines.forEach((raw, i) => {
      const { parsed, issues } = parseEnvLine(raw, i + 1);
      allParsed.push(parsed);
      allIssues.push(...issues);
    });

    return { parsed: allParsed, allIssues };
  }, [input]);

  // ── Process ────────────────────────────────────────────────────────────────

  const output = useMemo(() => {
    let lines = [...parsed];

    // Remove comments
    if (removeComments) {
      lines = lines.filter((l) => !l.isComment);
    }

    // Remove empty lines
    lines = lines.filter((l) => !l.isEmpty || (!removeComments && !l.isComment));

    // Filter to only key-value lines for processing
    const kvLines = lines.filter((l) => !l.isComment && !l.isEmpty && l.key);
    const otherLines = lines.filter((l) => l.isComment || l.isEmpty);

    // Remove duplicates (keep last)
    let processedKv = kvLines;
    if (removeDuplicates) {
      const seen = new Map<string, EnvLine>();
      for (const l of kvLines) {
        seen.set(l.key, l);
      }
      processedKv = Array.from(seen.values());
    }

    // Sort alphabetically
    if (sortAlpha) {
      processedKv.sort((a, b) => a.key.localeCompare(b.key));
    }

    // Rebuild final lines
    const finalLines = removeComments ? processedKv : [...otherLines.filter((l) => l.isComment), ...processedKv];
    if (!removeComments && !groupByPrefix) {
      // Keep original order but with deduplication/sorting applied to kv lines
      const kvSet = new Set(processedKv.map((l) => l.key));
      const result: EnvLine[] = [];
      const seen = new Set<string>();
      for (const l of lines) {
        if (l.isComment || l.isEmpty) {
          if (!removeComments) result.push(l);
          continue;
        }
        if (kvSet.has(l.key) && !seen.has(l.key)) {
          const processed = processedKv.find((p) => p.key === l.key);
          if (processed) result.push(processed);
          seen.add(l.key);
        }
      }
      // If sorting, just use sorted kv lines
      if (sortAlpha) {
        return outputFormat === "json" ? envToJson(processedKv) : formatAsEnv(processedKv, false);
      }
      return outputFormat === "json" ? envToJson(result) : formatAsEnv(result, false);
    }

    if (outputFormat === "json") {
      return envToJson(processedKv);
    }

    return formatAsEnv(processedKv, groupByPrefix);
  }, [parsed, sortAlpha, removeDuplicates, removeComments, groupByPrefix, outputFormat]);

  // ── Diff computation ───────────────────────────────────────────────────────

  const diff = useMemo(() => {
    if (!showDiff) return [];
    const inputLines = input.split("\n");
    const outputLines = output.split("\n");
    const maxLen = Math.max(inputLines.length, outputLines.length);
    const result: { type: "same" | "removed" | "added" | "changed"; before: string; after: string }[] = [];

    // Simple line-by-line diff
    const beforeSet = new Set(inputLines);
    const afterSet = new Set(outputLines);

    for (const line of inputLines) {
      if (afterSet.has(line)) {
        result.push({ type: "same", before: line, after: line });
      } else {
        result.push({ type: "removed", before: line, after: "" });
      }
    }
    for (const line of outputLines) {
      if (!beforeSet.has(line)) {
        result.push({ type: "added", before: "", after: line });
      }
    }

    return result;
  }, [input, output, showDiff]);

  // ── Duplicate count ────────────────────────────────────────────────────────

  const duplicateCount = useMemo(() => {
    const kvLines = parsed.filter((l) => !l.isComment && !l.isEmpty && l.key);
    const counts = new Map<string, number>();
    for (const l of kvLines) {
      counts.set(l.key, (counts.get(l.key) ?? 0) + 1);
    }
    return Array.from(counts.values()).filter((c) => c > 1).reduce((a, b) => a + b - 1, 0);
  }, [parsed]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const copyOutput = useCallback(() => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output]);

  const downloadOutput = useCallback(() => {
    const ext = outputFormat === "json" ? ".json" : ".env";
    const mime = outputFormat === "json" ? "application/json" : "text/plain";
    const blob = new Blob([output], { type: mime });
    const link = document.createElement("a");
    link.download = `formatted${ext}`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [output, outputFormat]);

  const handleConvertFromJson = useCallback(() => {
    // If input looks like JSON, convert to env
    const trimmed = input.trim();
    if (trimmed.startsWith("{")) {
      setInput(jsonToEnv(trimmed));
      setOutputFormat("env");
    }
  }, [input]);

  const kvCount = parsed.filter((l) => !l.isComment && !l.isEmpty && l.key).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <Link href="/" className="p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors" aria-label="Back to home">
          <ArrowLeft size={20} />
        </Link>
        <FileCode2 size={20} className="text-[var(--accent)]" />
        <h1 className="text-base font-semibold">Env File Formatter</h1>
        <div className="ml-auto flex items-center gap-2 text-xs text-[var(--muted)]">
          {kvCount > 0 && (
            <span>
              {kvCount} vars{duplicateCount > 0 && <span className="text-amber-400 ml-1">({duplicateCount} dupes)</span>}
              {allIssues.length > 0 && <span className="text-red-400 ml-1">({allIssues.length} issues)</span>}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Controls sidebar ─────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto p-4 space-y-5">
          {/* Options */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">Options</h2>
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={sortAlpha}
                  onChange={(e) => setSortAlpha(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <SortAsc size={14} />
                Sort alphabetically
              </label>
              <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupByPrefix}
                  onChange={(e) => setGroupByPrefix(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <Group size={14} />
                Group by prefix
              </label>
              <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeDuplicates}
                  onChange={(e) => setRemoveDuplicates(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <Trash2 size={14} />
                Remove duplicates
              </label>
              <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeComments}
                  onChange={(e) => setRemoveComments(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <MessageSquareOff size={14} />
                Remove comments
              </label>
            </div>
          </section>

          {/* Output format */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Output Format</h2>
            <div className="flex gap-1.5">
              <button
                onClick={() => setOutputFormat("env")}
                className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                  outputFormat === "env"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                .env
              </button>
              <button
                onClick={() => setOutputFormat("json")}
                className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                  outputFormat === "json"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                JSON
              </button>
            </div>
            {input.trim().startsWith("{") && (
              <button
                onClick={handleConvertFromJson}
                className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <ArrowRightLeft size={12} />
                Convert JSON to .env
              </button>
            )}
          </section>

          {/* Actions */}
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Actions</h2>
            <button
              onClick={() => setShowDiff((v) => !v)}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                showDiff ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              Show Diff
            </button>
            <button
              onClick={copyOutput}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy Output"}
            </button>
            <button
              onClick={downloadOutput}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Download size={14} />
              Download
            </button>
          </section>

          {/* Issues */}
          {allIssues.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-400" />
                Issues ({allIssues.length})
              </h2>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {allIssues.map((issue, i) => (
                  <div
                    key={i}
                    className={`px-2 py-1.5 text-xs rounded-lg border ${
                      issue.severity === "error"
                        ? "border-red-500/30 bg-red-500/10 text-red-400"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    <span className="font-mono">L{issue.line}:</span> {issue.message}
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* ── Main panels ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">
          {showDiff ? (
            /* Diff view */
            <div className="flex-1 overflow-auto p-4">
              <div className="font-mono text-xs space-y-0.5">
                {diff.map((d, i) => (
                  <div
                    key={i}
                    className={`px-3 py-0.5 rounded-sm ${
                      d.type === "removed"
                        ? "bg-red-500/15 text-red-400"
                        : d.type === "added"
                        ? "bg-green-500/15 text-green-400"
                        : "text-[var(--foreground)]/60"
                    }`}
                  >
                    <span className="inline-block w-4 text-[var(--muted)] select-none">
                      {d.type === "removed" ? "-" : d.type === "added" ? "+" : " "}
                    </span>
                    {d.type === "removed" ? d.before : d.after || d.before}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Input / Output panels */
            <>
              {/* Input */}
              <div className="flex-1 flex flex-col border-r border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Input</span>
                </div>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`# Paste your .env file here\nDB_HOST=localhost\nDB_PORT=5432\nAPI_KEY=your-key-here\nAPI_SECRET=your-secret\nAWS_REGION=us-east-1\nAWS_BUCKET=my-bucket`}
                  className="flex-1 p-4 font-mono text-sm bg-[var(--background)] resize-none focus:outline-none placeholder:text-[var(--muted)]/40"
                  spellCheck={false}
                />
              </div>

              {/* Output */}
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Output ({outputFormat === "json" ? "JSON" : ".env"})
                  </span>
                </div>
                <pre className="flex-1 p-4 font-mono text-sm overflow-auto whitespace-pre-wrap text-[var(--foreground)]">
                  {output || <span className="text-[var(--muted)]/40">Formatted output will appear here...</span>}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
