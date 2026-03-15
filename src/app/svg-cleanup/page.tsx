"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  Download,
  FileCode2,
  Paintbrush,
  RotateCcw,
  Sparkles,
  Upload,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CleanupOptions {
  removeComments: boolean;
  removeMetadata: boolean;
  removeEmptyGroups: boolean;
  removeHiddenElements: boolean;
  removeTitleDesc: boolean;
  collapseGroups: boolean;
  roundDecimals: boolean;
  decimalPlaces: number;
  removeDefaults: boolean;
  minify: boolean;
  prettyPrint: boolean;
}

interface SvgStats {
  bytes: number;
  nodes: number;
  paths: number;
}

/* ------------------------------------------------------------------ */
/*  Default options                                                     */
/* ------------------------------------------------------------------ */

const DEFAULT_OPTIONS: CleanupOptions = {
  removeComments: true,
  removeMetadata: true,
  removeEmptyGroups: true,
  removeHiddenElements: true,
  removeTitleDesc: false,
  collapseGroups: false,
  roundDecimals: false,
  decimalPlaces: 2,
  removeDefaults: false,
  minify: false,
  prettyPrint: false,
};

/* ------------------------------------------------------------------ */
/*  Sample SVG                                                         */
/* ------------------------------------------------------------------ */

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <!-- A simple sample icon -->
  <metadata>Created with Sample Editor</metadata>
  <title>Sample Icon</title>
  <desc>A sample SVG for cleanup</desc>
  <defs/>
  <g id="layer1">
    <g>
      <circle cx="100" cy="100" r="80" fill="#6366f1" fill-opacity="1" stroke="#4f46e5" stroke-width="4"/>
      <path d="M60.00000 80.00000 L90.00000 120.00000 L140.00000 70.00000" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
  <g style="display:none">
    <rect width="10" height="10"/>
  </g>
</svg>`;

/* ------------------------------------------------------------------ */
/*  SVG cleanup engine                                                 */
/* ------------------------------------------------------------------ */

const METADATA_TAGS = [
  "metadata",
  "sodipodi:namedview",
  "inkscape:grid",
  "illustrator:pgfref",
  "pgf",
  "i:pgf",
];

const METADATA_NS_PREFIXES = [
  "inkscape:",
  "sodipodi:",
  "illustrator:",
  "i:",
  "xmlns:inkscape",
  "xmlns:sodipodi",
  "xmlns:illustrator",
  "xmlns:i",
  "xmlns:dc",
  "xmlns:cc",
  "xmlns:rdf",
];

const DEFAULT_ATTRS: Record<string, string> = {
  "fill-opacity": "1",
  "stroke-opacity": "1",
  opacity: "1",
  "fill-rule": "nonzero",
  "clip-rule": "nonzero",
  "stroke-dashoffset": "0",
  "stroke-miterlimit": "4",
  display: "inline",
};

function cleanupSvg(input: string, options: CleanupOptions): string {
  let svg = input;

  // Remove comments
  if (options.removeComments) {
    svg = svg.replace(/<!--[\s\S]*?-->/g, "");
  }

  // Remove metadata and editor-specific tags
  if (options.removeMetadata) {
    for (const tag of METADATA_TAGS) {
      const re = new RegExp(
        `<${tag}[^>]*(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`,
        "gi",
      );
      svg = svg.replace(re, "");
    }
    // Remove editor-namespaced attributes
    for (const prefix of METADATA_NS_PREFIXES) {
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\s+${escaped}[a-zA-Z:_-]*="[^"]*"`, "g");
      svg = svg.replace(re, "");
    }
    // Remove empty defs
    svg = svg.replace(/<defs\s*\/>/gi, "");
    svg = svg.replace(/<defs>\s*<\/defs>/gi, "");
  }

  // Remove <title> and <desc>
  if (options.removeTitleDesc) {
    svg = svg.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "");
    svg = svg.replace(/<desc[^>]*>[\s\S]*?<\/desc>/gi, "");
  }

  // Remove hidden elements (display:none, visibility:hidden)
  if (options.removeHiddenElements) {
    svg = svg.replace(
      /<[a-z][^>]*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^>]*(?:\/>|>[\s\S]*?<\/[a-z]+>)/gi,
      "",
    );
    svg = svg.replace(
      /<[a-z][^>]*(?:display="none"|visibility="hidden")[^>]*(?:\/>|>[\s\S]*?<\/[a-z]+>)/gi,
      "",
    );
  }

  // Remove empty groups
  if (options.removeEmptyGroups) {
    let prev = "";
    while (prev !== svg) {
      prev = svg;
      svg = svg.replace(/<g[^>]*>\s*<\/g>/gi, "");
    }
  }

  // Collapse unnecessary groups (groups with no attributes wrapping single children)
  if (options.collapseGroups) {
    let prev = "";
    while (prev !== svg) {
      prev = svg;
      svg = svg.replace(/<g>\s*([\s\S]*?)\s*<\/g>/gi, (_match, inner) => {
        const trimmed = inner.trim();
        // Only collapse if there is exactly one top-level element inside
        const openTags = trimmed.match(/<[a-z][^/]*?(?<!\/)\s*>/gi);
        const selfClose = trimmed.match(/<[a-z][^>]*\/>/gi);
        const totalRoots = (openTags?.length ?? 0) + (selfClose?.length ?? 0);
        const closeTags = trimmed.match(/<\/[a-z][^>]*>/gi);
        if (
          totalRoots - (closeTags?.length ?? 0) + (selfClose?.length ?? 0) <=
          1
        ) {
          return trimmed;
        }
        return `<g>${inner}</g>`;
      });
    }
  }

  // Round numeric values
  if (options.roundDecimals) {
    const dp = options.decimalPlaces;
    // Round numbers in attribute values
    svg = svg.replace(
      /([=":,\s])(-?\d+\.\d{2,})/g,
      (_match, prefix, num) => {
        return prefix + parseFloat(num).toFixed(dp);
      },
    );
    // Round numbers in path data
    svg = svg.replace(/\b(\d+\.\d{2,})\b/g, (num) => {
      return parseFloat(num).toFixed(dp);
    });
  }

  // Remove default attribute values
  if (options.removeDefaults) {
    for (const [attr, val] of Object.entries(DEFAULT_ATTRS)) {
      const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const valEscaped = val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\s+${escaped}="${valEscaped}"`, "g");
      svg = svg.replace(re, "");
    }
  }

  // Minify: remove whitespace between tags
  if (options.minify) {
    svg = svg.replace(/>\s+</g, "><");
    svg = svg.replace(/\n\s*/g, "");
    svg = svg.trim();
  }

  // Pretty-print
  if (options.prettyPrint && !options.minify) {
    svg = prettyPrintSvg(svg);
  }

  // Clean up blank lines
  if (!options.minify) {
    svg = svg.replace(/\n{3,}/g, "\n\n");
    svg = svg.trim();
  }

  return svg;
}

function prettyPrintSvg(input: string): string {
  // Normalize to single line then re-indent
  let svg = input.replace(/>\s+</g, ">\n<");
  svg = svg.replace(/\n{2,}/g, "\n");
  const lines = svg.split("\n");
  const result: string[] = [];
  let indent = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const isClosing = /^<\//.test(line);
    const isSelfClosing = /\/>$/.test(line);
    const isOpening = /^<[a-zA-Z]/.test(line) && !isSelfClosing && !isClosing;

    if (isClosing) indent = Math.max(0, indent - 1);
    result.push("  ".repeat(indent) + line);
    if (isOpening) indent += 1;
  }

  return result.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Recolor                                                            */
/* ------------------------------------------------------------------ */

function recolorSvg(svg: string, color: string): string {
  let result = svg;
  // Replace fill values (not "none" or "url(...)")
  result = result.replace(
    /fill="(?!none|url)([^"]*)"/g,
    `fill="${color}"`,
  );
  // Replace stroke values (not "none" or "url(...)")
  result = result.replace(
    /stroke="(?!none|url)([^"]*)"/g,
    `stroke="${color}"`,
  );
  return result;
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

function computeStats(svg: string): SvgStats {
  const bytes = new Blob([svg]).size;
  const nodes = (svg.match(/<[a-zA-Z][^/!>]*/g) || []).length;
  const paths = (svg.match(/<path[\s>]/gi) || []).length;
  return { bytes, nodes, paths };
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  return `${(b / 1024).toFixed(1)} KB`;
}

/* ------------------------------------------------------------------ */
/*  Toggle component                                                   */
/* ------------------------------------------------------------------ */

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[var(--foreground)]">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0 ${
          checked
            ? "bg-[var(--accent)]"
            : "bg-[var(--border)]"
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
            checked ? "translate-x-[14px]" : "translate-x-0"
          }`}
        />
      </button>
      {label}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export default function SvgCleanupPage() {
  const [rawSvg, setRawSvg] = useState(SAMPLE_SVG);
  const [options, setOptions] = useState<CleanupOptions>(DEFAULT_OPTIONS);
  const [recolorEnabled, setRecolorEnabled] = useState(false);
  const [recolorValue, setRecolorValue] = useState("#6366f1");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateOption = useCallback(
    <K extends keyof CleanupOptions>(key: K, value: CleanupOptions[K]) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Derived cleaned SVG
  const cleanedSvg = useMemo(() => {
    let result = cleanupSvg(rawSvg, options);
    if (recolorEnabled) {
      result = recolorSvg(result, recolorValue);
    }
    return result;
  }, [rawSvg, options, recolorEnabled, recolorValue]);

  const beforeStats = useMemo(() => computeStats(rawSvg), [rawSvg]);
  const afterStats = useMemo(() => computeStats(cleanedSvg), [cleanedSvg]);

  const savings = useMemo(() => {
    if (beforeStats.bytes === 0) return 0;
    return Math.round(
      ((beforeStats.bytes - afterStats.bytes) / beforeStats.bytes) * 100,
    );
  }, [beforeStats.bytes, afterStats.bytes]);

  // Preview data URI
  const previewSrc = useMemo(() => {
    try {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanedSvg)}`;
    } catch {
      return "";
    }
  }, [cleanedSvg]);

  // File upload
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setRawSvg(reader.result);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [],
  );

  // Copy
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(cleanedSvg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [cleanedSvg]);

  // Download
  const handleDownload = useCallback(() => {
    const blob = new Blob([cleanedSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cleaned.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, [cleanedSvg]);

  // Reset
  const handleReset = useCallback(() => {
    setOptions(DEFAULT_OPTIONS);
    setRecolorEnabled(false);
    setRecolorValue("#6366f1");
  }, []);

  // Drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".svg")) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setRawSvg(reader.result);
        }
      };
      reader.readAsText(file);
    }
  }, []);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden bg-[var(--background)]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>

        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <FileCode2 size={14} />
          <span className="text-sm font-semibold">SVG Cleanup Studio</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[var(--surface-hover)] text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
          >
            <Upload size={12} />
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg"
            className="hidden"
            onChange={handleFileUpload}
          />

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[var(--surface-hover)] text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            {copied ? <Check size={12} /> : <ClipboardCopy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Download size={12} />
            Download
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Code editor */}
        <div className="flex flex-col w-1/2 border-r border-[var(--border)]">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              SVG Source
            </span>
            <span className="text-[10px] text-[var(--muted)]">
              {formatBytes(beforeStats.bytes)}
            </span>
          </div>
          <textarea
            value={rawSvg}
            onChange={(e) => setRawSvg(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full resize-none bg-[var(--background)] text-[var(--foreground)] text-xs font-mono p-3 outline-none placeholder:text-[var(--muted)]"
            placeholder="Paste SVG code here or drag & drop a .svg file..."
          />
        </div>

        {/* Right: Preview + Controls + Stats */}
        <div className="flex flex-col w-1/2 overflow-hidden">
          {/* Preview */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Preview
            </span>
            <span className="text-[10px] text-[var(--muted)]">
              {formatBytes(afterStats.bytes)}
              {savings > 0 && (
                <span className="ml-1 text-green-500">-{savings}%</span>
              )}
            </span>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[var(--background)]" style={{ backgroundImage: "repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%)", backgroundSize: "16px 16px" }}>
            {previewSrc ? (
              <img
                src={previewSrc}
                alt="SVG preview"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <span className="text-xs text-[var(--muted)]">
                No valid SVG to preview
              </span>
            )}
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 px-3 py-2 border-y border-[var(--border)] bg-[var(--surface)] text-[10px] text-[var(--muted)]">
            <div className="flex gap-4">
              <span>
                <span className="text-[var(--foreground)] font-medium">Before:</span>{" "}
                {formatBytes(beforeStats.bytes)} / {beforeStats.nodes} nodes / {beforeStats.paths} paths
              </span>
              <span>
                <span className="text-[var(--foreground)] font-medium">After:</span>{" "}
                {formatBytes(afterStats.bytes)} / {afterStats.nodes} nodes / {afterStats.paths} paths
              </span>
            </div>
            {savings > 0 && (
              <span className="ml-auto text-green-500 font-medium">
                Saved {savings}% ({formatBytes(beforeStats.bytes - afterStats.bytes)})
              </span>
            )}
          </div>

          {/* Controls panel */}
          <div className="overflow-y-auto p-3 bg-[var(--surface)] flex-shrink-0" style={{ maxHeight: "260px" }}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {/* Cleanup toggles */}
              <div className="col-span-2 mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <Sparkles size={10} />
                  Cleanup Operations
                </span>
              </div>

              <Toggle
                label="Remove comments"
                checked={options.removeComments}
                onChange={(v) => updateOption("removeComments", v)}
              />
              <Toggle
                label="Remove metadata / editor tags"
                checked={options.removeMetadata}
                onChange={(v) => updateOption("removeMetadata", v)}
              />
              <Toggle
                label="Remove empty groups"
                checked={options.removeEmptyGroups}
                onChange={(v) => updateOption("removeEmptyGroups", v)}
              />
              <Toggle
                label="Remove hidden elements"
                checked={options.removeHiddenElements}
                onChange={(v) => updateOption("removeHiddenElements", v)}
              />
              <Toggle
                label="Remove <title> and <desc>"
                checked={options.removeTitleDesc}
                onChange={(v) => updateOption("removeTitleDesc", v)}
              />
              <Toggle
                label="Collapse unnecessary groups"
                checked={options.collapseGroups}
                onChange={(v) => updateOption("collapseGroups", v)}
              />
              <Toggle
                label="Remove default attributes"
                checked={options.removeDefaults}
                onChange={(v) => updateOption("removeDefaults", v)}
              />
              <Toggle
                label="Minify output"
                checked={options.minify}
                onChange={(v) => updateOption("minify", v)}
              />
              <Toggle
                label="Pretty-print output"
                checked={options.prettyPrint}
                onChange={(v) => updateOption("prettyPrint", v)}
              />

              {/* Round decimals with slider */}
              <div className="col-span-2 flex items-center gap-3 mt-1">
                <Toggle
                  label="Round decimals"
                  checked={options.roundDecimals}
                  onChange={(v) => updateOption("roundDecimals", v)}
                />
                {options.roundDecimals && (
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={4}
                      step={1}
                      value={options.decimalPlaces}
                      onChange={(e) =>
                        updateOption("decimalPlaces", Number(e.target.value))
                      }
                      className="w-20 h-1 accent-[var(--accent)]"
                    />
                    <span className="text-[10px] text-[var(--muted)] w-3 text-center font-mono">
                      {options.decimalPlaces}
                    </span>
                  </div>
                )}
              </div>

              {/* Recolor */}
              <div className="col-span-2 mt-2 mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <Paintbrush size={10} />
                  Recolor
                </span>
              </div>

              <div className="col-span-2 flex items-center gap-3">
                <Toggle
                  label="Replace all colors"
                  checked={recolorEnabled}
                  onChange={setRecolorEnabled}
                />
                {recolorEnabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={recolorValue}
                      onChange={(e) => setRecolorValue(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border border-[var(--border)] bg-transparent"
                    />
                    <span className="text-[10px] font-mono text-[var(--muted)]">
                      {recolorValue}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
