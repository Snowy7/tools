"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Replace,
  Terminal,
  X,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MatchResult {
  index: number;
  text: string;
  start: number;
  end: number;
  groups: { index: number; text: string }[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FLAG_LIST = [
  { key: "g", label: "Global", title: "Match all occurrences" },
  { key: "i", label: "Case", title: "Case-insensitive" },
  { key: "m", label: "Multi", title: "Multiline (^ and $ match line boundaries)" },
  { key: "s", label: "DotAll", title: "Dot matches newlines" },
] as const;

const MATCH_COLORS = [
  "rgba(59,130,246,0.25)",
  "rgba(16,185,129,0.25)",
  "rgba(245,158,11,0.25)",
  "rgba(239,68,68,0.25)",
  "rgba(139,92,246,0.25)",
  "rgba(236,72,153,0.25)",
];

const CHEAT_SHEET: { title: string; items: { pattern: string; desc: string }[] }[] = [
  {
    title: "Characters",
    items: [
      { pattern: ".", desc: "Any character" },
      { pattern: "\\d", desc: "Digit [0-9]" },
      { pattern: "\\D", desc: "Non-digit" },
      { pattern: "\\w", desc: "Word char [a-zA-Z0-9_]" },
      { pattern: "\\W", desc: "Non-word" },
      { pattern: "\\s", desc: "Whitespace" },
      { pattern: "\\S", desc: "Non-whitespace" },
    ],
  },
  {
    title: "Anchors",
    items: [
      { pattern: "^", desc: "Start of string" },
      { pattern: "$", desc: "End of string" },
      { pattern: "\\b", desc: "Word boundary" },
    ],
  },
  {
    title: "Quantifiers",
    items: [
      { pattern: "*", desc: "0 or more" },
      { pattern: "+", desc: "1 or more" },
      { pattern: "?", desc: "0 or 1" },
      { pattern: "{n}", desc: "Exactly n" },
      { pattern: "{n,m}", desc: "Between n and m" },
    ],
  },
  {
    title: "Groups & Logic",
    items: [
      { pattern: "[abc]", desc: "Character class" },
      { pattern: "[^abc]", desc: "Negated class" },
      { pattern: "(...)", desc: "Capture group" },
      { pattern: "(?:...)", desc: "Non-capturing" },
      { pattern: "(?=...)", desc: "Positive lookahead" },
      { pattern: "(?!...)", desc: "Negative lookahead" },
      { pattern: "|", desc: "Alternation" },
    ],
  },
];

const COMMON_PATTERNS = [
  { label: "Email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
  { label: "URL", pattern: "https?://[^\\s]+" },
  { label: "Phone", pattern: "\\+?[\\d\\s-()]{7,}" },
  { label: "IP Address", pattern: "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}" },
  { label: "Date", pattern: "\\d{4}-\\d{2}-\\d{2}" },
  { label: "Hex Color", pattern: "#[0-9a-fA-F]{3,8}" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildRegex(pattern: string, flags: Record<string, boolean>): RegExp | null {
  if (!pattern) return null;
  const flagStr = Object.entries(flags)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join("");
  try {
    return new RegExp(pattern, flagStr);
  } catch {
    return null;
  }
}

function getRegexError(pattern: string, flags: Record<string, boolean>): string | null {
  if (!pattern) return null;
  const flagStr = Object.entries(flags)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join("");
  try {
    new RegExp(pattern, flagStr);
    return null;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : "Invalid pattern";
  }
}

function collectMatches(regex: RegExp, text: string): MatchResult[] {
  const results: MatchResult[] = [];
  if (!regex.global) {
    const m = regex.exec(text);
    if (m) {
      const groups: { index: number; text: string }[] = [];
      for (let i = 1; i < m.length; i++) {
        if (m[i] !== undefined) groups.push({ index: i, text: m[i] });
      }
      results.push({
        index: 0,
        text: m[0],
        start: m.index,
        end: m.index + m[0].length,
        groups,
      });
    }
    return results;
  }
  let m: RegExpExecArray | null;
  let safety = 0;
  while ((m = regex.exec(text)) !== null && safety < 10000) {
    const groups: { index: number; text: string }[] = [];
    for (let i = 1; i < m.length; i++) {
      if (m[i] !== undefined) groups.push({ index: i, text: m[i] });
    }
    results.push({
      index: results.length,
      text: m[0],
      start: m.index,
      end: m.index + m[0].length,
      groups,
    });
    if (m[0].length === 0) regex.lastIndex++;
    safety++;
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RegexLabPage() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState<Record<string, boolean>>({ g: true, i: false, m: false, s: false });
  const [testString, setTestString] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [replaceValue, setReplaceValue] = useState("");
  const [copied, setCopied] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const error = useMemo(() => getRegexError(pattern, flags), [pattern, flags]);

  const regex = useMemo(() => {
    if (error) return null;
    return buildRegex(pattern, flags);
  }, [pattern, flags, error]);

  const matches = useMemo(() => {
    if (!regex || !testString) return [];
    return collectMatches(regex, testString);
  }, [regex, testString]);

  const replacedText = useMemo(() => {
    if (!regex || !testString || !replaceMode) return "";
    try {
      return testString.replace(regex, replaceValue);
    } catch {
      return "";
    }
  }, [regex, testString, replaceMode, replaceValue]);

  const flagStr = useMemo(
    () =>
      Object.entries(flags)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(""),
    [flags],
  );

  const toggleFlag = useCallback((key: string) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const copyResult = useCallback(async () => {
    await navigator.clipboard.writeText(replacedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [replacedText]);

  const insertPattern = useCallback((p: string) => {
    setPattern(p);
  }, []);

  /* Sync textarea scroll with highlight overlay */
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  /* Scroll to match in highlight area */
  const scrollToMatch = useCallback(
    (matchIndex: number) => {
      setSelectedMatch(matchIndex);
      const el = document.getElementById(`match-hl-${matchIndex}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [],
  );

  /* Build highlighted segments */
  const highlightedContent = useMemo(() => {
    if (!testString) return null;
    if (matches.length === 0) return <span>{testString}</span>;

    const segments: React.ReactNode[] = [];
    let lastEnd = 0;

    matches.forEach((m, i) => {
      if (m.start > lastEnd) {
        segments.push(<span key={`t-${i}`}>{testString.slice(lastEnd, m.start)}</span>);
      }
      segments.push(
        <mark
          key={`m-${i}`}
          id={`match-hl-${i}`}
          style={{
            backgroundColor: selectedMatch === i ? "rgba(59,130,246,0.5)" : MATCH_COLORS[i % MATCH_COLORS.length],
            borderRadius: "2px",
            color: "inherit",
          }}
        >
          {testString.slice(m.start, m.end)}
        </mark>,
      );
      lastEnd = m.end;
    });

    if (lastEnd < testString.length) {
      segments.push(<span key="t-end">{testString.slice(lastEnd)}</span>);
    }

    return segments;
  }, [testString, matches, selectedMatch]);

  /* Keyboard shortcut */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* ---- Header ---- */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>

        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <Terminal size={14} />
          <span className="text-sm font-semibold">Regex Lab</span>
        </div>

        {/* Flags */}
        <div className="flex items-center gap-1 ml-4">
          {FLAG_LIST.map((f) => (
            <button
              key={f.key}
              type="button"
              title={f.title}
              onClick={() => toggleFlag(f.key)}
              className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
                flags[f.key]
                  ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {f.key}
            </button>
          ))}
        </div>

        {/* Replace toggle */}
        <button
          type="button"
          onClick={() => setReplaceMode(!replaceMode)}
          className={`ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
            replaceMode
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          <Replace size={12} />
          Replace
        </button>
      </header>

      {/* ---- Pattern Input ---- */}
      <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[var(--muted)] font-mono text-sm select-none">/</span>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Enter regex pattern..."
            spellCheck={false}
            className="flex-1 bg-transparent font-mono text-lg text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]/40"
          />
          <span className="text-[var(--muted)] font-mono text-sm select-none">/{flagStr}</span>
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-500 font-mono flex items-center gap-1">
            <X size={12} />
            {error}
          </p>
        )}
      </div>

      {/* ---- Main Content ---- */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: test string + matches */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Test string area */}
          <div className="flex-1 min-h-0 flex flex-col border-b border-[var(--border)]">
            <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
              <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Test String</span>
              {matches.length > 0 && (
                <span className="text-xs bg-[var(--accent)] text-white px-1.5 py-0.5 rounded-full font-medium">
                  {matches.length} match{matches.length !== 1 ? "es" : ""}
                </span>
              )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Input textarea */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={testString}
                  onChange={(e) => setTestString(e.target.value)}
                  onScroll={handleScroll}
                  placeholder="Paste or type your test string here..."
                  spellCheck={false}
                  className="w-full h-full resize-none bg-transparent font-mono text-sm text-[var(--foreground)] p-4 outline-none placeholder:text-[var(--muted)]/40"
                />
              </div>

              {/* Highlighted preview */}
              {testString && matches.length > 0 && (
                <div className="border-t border-[var(--border)]">
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--surface)]">
                    <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                      Highlighted Matches
                    </span>
                  </div>
                  <div
                    ref={highlightRef}
                    className="p-4 font-mono text-sm whitespace-pre-wrap break-words overflow-auto max-h-48 text-[var(--foreground)]"
                  >
                    {highlightedContent}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Replace section */}
          {replaceMode && (
            <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)]">
                <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Replace</span>
              </div>
              <div className="p-3">
                <input
                  type="text"
                  value={replaceValue}
                  onChange={(e) => setReplaceValue(e.target.value)}
                  placeholder="Replacement string ($1, $2, etc.)"
                  spellCheck={false}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/40"
                />
                {regex && testString && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[var(--muted)]">Result</span>
                      <button
                        type="button"
                        onClick={copyResult}
                        className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 font-mono text-sm text-[var(--foreground)] whitespace-pre-wrap break-words max-h-32 overflow-auto">
                      {replacedText}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Match Results */}
          <div className="flex-shrink-0 max-h-64 overflow-auto">
            <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0">
              <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Match Results</span>
            </div>
            {matches.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-[var(--muted)]">
                {pattern ? "No matches found" : "Enter a pattern and test string to see matches"}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {matches.map((m) => (
                  <button
                    key={m.index}
                    type="button"
                    onClick={() => scrollToMatch(m.index)}
                    className={`w-full text-left px-4 py-2 hover:bg-[var(--surface-hover)] transition-colors ${
                      selectedMatch === m.index ? "bg-[var(--surface-hover)]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded text-[10px] font-mono flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: MATCH_COLORS[m.index % MATCH_COLORS.length] }}
                      >
                        {m.index}
                      </span>
                      <span className="font-mono text-xs text-[var(--foreground)] truncate">
                        &quot;{m.text}&quot;
                      </span>
                      <span className="ml-auto text-[10px] text-[var(--muted)] flex-shrink-0 font-mono">
                        {m.start}-{m.end}
                      </span>
                    </div>
                    {m.groups.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.groups.map((g) => (
                          <span
                            key={g.index}
                            className="text-[10px] font-mono bg-[var(--background)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--muted)]"
                          >
                            ${g.index}: &quot;{g.text}&quot;
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cheat Sheet Sidebar */}
        <div
          className={`flex-shrink-0 border-l border-[var(--border)] bg-[var(--surface)] overflow-y-auto transition-all ${
            cheatOpen ? "w-72" : "w-10"
          }`}
        >
          <button
            type="button"
            onClick={() => setCheatOpen(!cheatOpen)}
            className="sticky top-0 z-10 w-full flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            {cheatOpen ? <ChevronRight size={12} /> : <BookOpen size={12} />}
            {cheatOpen && <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Cheat Sheet</span>}
          </button>

          {cheatOpen && (
            <div className="p-3">
              {CHEAT_SHEET.map((section) => (
                <div key={section.title} className="mb-3">
                  <h3 className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    {section.title}
                  </h3>
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <div key={item.pattern} className="flex items-center gap-2 py-0.5">
                        <code className="text-xs font-mono text-[var(--accent)] w-16 flex-shrink-0">
                          {item.pattern}
                        </code>
                        <span className="text-[11px] text-[var(--muted)]">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Common patterns */}
              <div className="mt-4 pt-3 border-t border-[var(--border)]">
                <h3 className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Zap size={10} />
                  Common Patterns
                </h3>
                <div className="space-y-1">
                  {COMMON_PATTERNS.map((cp) => (
                    <button
                      key={cp.label}
                      type="button"
                      onClick={() => insertPattern(cp.pattern)}
                      className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-[var(--surface-hover)] transition-colors group"
                    >
                      <span className="text-[var(--foreground)] font-medium">{cp.label}</span>
                      <span className="block font-mono text-[10px] text-[var(--muted)] truncate group-hover:text-[var(--accent)] transition-colors">
                        {cp.pattern}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
