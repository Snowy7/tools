"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  X,
  Copy,
  Check,
  Grid3X3,
  List,
  LayoutGrid,
  ChevronDown,
  icons,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ViewMode = "grid" | "list" | "compact";

interface IconEntry {
  name: string;
  Component: LucideIcon;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ALL_ICONS: IconEntry[] = Object.entries(icons).map(([name, Component]) => ({
  name,
  Component,
}));

const BATCH_SIZE = 120;

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(null), 1800);
    });
  }, []);

  return { copied, copy };
}

/* ------------------------------------------------------------------ */
/*  Icon Card                                                          */
/* ------------------------------------------------------------------ */

const IconCard = memo(function IconCard({
  entry,
  size,
  color,
  strokeWidth,
  isSelected,
  onClick,
  viewMode,
}: {
  entry: IconEntry;
  size: number;
  color: string;
  strokeWidth: number;
  isSelected: boolean;
  onClick: () => void;
  viewMode: ViewMode;
}) {
  const { name, Component } = entry;

  if (viewMode === "compact") {
    return (
      <button
        onClick={onClick}
        title={name}
        className={`flex items-center justify-center rounded-lg p-1.5 transition-colors cursor-pointer ${
          isSelected
            ? "bg-[var(--accent)] text-white"
            : "hover:bg-[var(--surface-hover)]"
        }`}
      >
        <Component
          size={Math.min(size, 20)}
          color={isSelected ? "white" : color}
          strokeWidth={strokeWidth}
        />
      </button>
    );
  }

  if (viewMode === "list") {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors text-left w-full cursor-pointer ${
          isSelected
            ? "bg-[var(--accent)] text-white"
            : "hover:bg-[var(--surface-hover)]"
        }`}
      >
        <Component
          size={20}
          color={isSelected ? "white" : color}
          strokeWidth={strokeWidth}
        />
        <span
          className="text-sm truncate"
          style={{ color: isSelected ? "white" : "var(--foreground)" }}
        >
          {name}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg p-3 transition-colors cursor-pointer ${
        isSelected
          ? "bg-[var(--accent)] text-white"
          : "hover:bg-[var(--surface-hover)]"
      }`}
    >
      <Component
        size={size}
        color={isSelected ? "white" : color}
        strokeWidth={strokeWidth}
      />
      <span
        className="text-[10px] leading-tight text-center truncate w-full"
        style={{ color: isSelected ? "white" : "var(--muted)" }}
      >
        {name}
      </span>
    </button>
  );
});

/* ------------------------------------------------------------------ */
/*  Detail Panel                                                       */
/* ------------------------------------------------------------------ */

function DetailPanel({
  entry,
  size,
  color,
  strokeWidth,
  onClose,
}: {
  entry: IconEntry;
  size: number;
  color: string;
  strokeWidth: number;
  onClose: () => void;
}) {
  const { copied, copy } = useCopy();
  const svgRef = useRef<HTMLDivElement>(null);

  const getSvgString = useCallback(() => {
    if (!svgRef.current) return "";
    const svg = svgRef.current.querySelector("svg");
    return svg ? svg.outerHTML : "";
  }, []);

  const jsxSnippet = `<${entry.name} size={${size}} color="${color}" strokeWidth={${strokeWidth}} />`;
  const importSnippet = `import { ${entry.name} } from 'lucide-react';`;

  return (
    <div
      className="border-t flex flex-col gap-3 p-4 shrink-0"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
      }}
    >
      <div className="flex items-center justify-between">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          {entry.name}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
        >
          <X size={16} style={{ color: "var(--muted)" }} />
        </button>
      </div>

      <div className="flex items-start gap-4">
        {/* Large preview */}
        <div
          ref={svgRef}
          className="flex items-center justify-center rounded-lg p-4 shrink-0"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            width: 96,
            height: 96,
          }}
        >
          <entry.Component size={48} color={color} strokeWidth={strokeWidth} />
        </div>

        {/* Copy actions */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <CopyButton
            label="Copy SVG"
            copiedLabel={copied}
            onClick={() => copy(getSvgString(), "svg")}
            tag="svg"
          />
          <CopyButton
            label="Copy JSX"
            copiedLabel={copied}
            onClick={() => copy(jsxSnippet, "jsx")}
            tag="jsx"
          />
          <CopyButton
            label="Copy Import"
            copiedLabel={copied}
            onClick={() => copy(importSnippet, "import")}
            tag="import"
          />
          <CopyButton
            label="Copy Name"
            copiedLabel={copied}
            onClick={() => copy(entry.name, "name")}
            tag="name"
          />
        </div>
      </div>
    </div>
  );
}

function CopyButton({
  label,
  copiedLabel,
  onClick,
  tag,
}: {
  label: string;
  copiedLabel: string | null;
  onClick: () => void;
  tag: string;
}) {
  const isCopied = copiedLabel === tag;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
      style={{
        background: isCopied ? "var(--accent)" : "var(--background)",
        color: isCopied ? "white" : "var(--foreground)",
        border: `1px solid ${isCopied ? "var(--accent)" : "var(--border)"}`,
      }}
    >
      {isCopied ? <Check size={12} /> : <Copy size={12} />}
      {isCopied ? "Copied!" : label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function IconBrowserPage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 200);
  const [size, setSize] = useState(24);
  const [color, setColor] = useState("var(--foreground)");
  const [customColor, setCustomColor] = useState("#3b82f6");
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [showControls, setShowControls] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeColor = useCustomColor ? customColor : color;

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return ALL_ICONS;
    const lower = debouncedQuery.toLowerCase().replace(/\s+/g, "");
    return ALL_ICONS.filter((e) => e.name.toLowerCase().includes(lower));
  }, [debouncedQuery]);

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [debouncedQuery]);

  const visibleIcons = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const hasMore = visibleCount < filtered.length;

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + BATCH_SIZE, filtered.length));
  }, [filtered.length]);

  const selectedEntry = useMemo(
    () => (selected ? ALL_ICONS.find((e) => e.name === selected) ?? null : null),
    [selected],
  );

  const handleSelect = useCallback((name: string) => {
    setSelected((prev) => (prev === name ? null : name));
  }, []);

  const gridClasses: Record<ViewMode, string> = {
    grid: "grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-1",
    list: "flex flex-col gap-0.5",
    compact: "grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-0.5",
  };

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* ---- Header ---- */}
      <header
        className="flex items-center gap-3 px-4 py-2 shrink-0 border-b"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
        }}
      >
        <Link
          href="/"
          className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          aria-label="Back to home"
        >
          <ArrowLeft size={18} style={{ color: "var(--foreground)" }} />
        </Link>
        <Search size={16} style={{ color: "var(--muted)" }} />
        <h1
          className="text-sm font-semibold whitespace-nowrap"
          style={{ color: "var(--foreground)" }}
        >
          Icon Browser
        </h1>

        <span
          className="text-xs ml-auto whitespace-nowrap"
          style={{ color: "var(--muted)" }}
        >
          {filtered.length === ALL_ICONS.length
            ? `${ALL_ICONS.length} icons`
            : `${filtered.length} / ${ALL_ICONS.length}`}
        </span>

        <button
          onClick={() => setShowControls((v) => !v)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors cursor-pointer"
          style={{
            background: showControls ? "var(--accent)" : "var(--background)",
            color: showControls ? "white" : "var(--muted)",
            border: `1px solid ${showControls ? "var(--accent)" : "var(--border)"}`,
          }}
        >
          Customize
          <ChevronDown
            size={12}
            className={`transition-transform ${showControls ? "rotate-180" : ""}`}
          />
        </button>
      </header>

      {/* ---- Controls Panel ---- */}
      {showControls && (
        <div
          className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-b shrink-0"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          {/* Size slider */}
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
            Size
            <input
              type="range"
              min={16}
              max={64}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-20 accent-[var(--accent)]"
            />
            <span className="w-6 text-right tabular-nums" style={{ color: "var(--foreground)" }}>
              {size}
            </span>
          </label>

          {/* Stroke width slider */}
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
            Stroke
            <input
              type="range"
              min={1}
              max={3}
              step={0.25}
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-16 accent-[var(--accent)]"
            />
            <span className="w-6 text-right tabular-nums" style={{ color: "var(--foreground)" }}>
              {strokeWidth}
            </span>
          </label>

          {/* Color */}
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
            Color
            <button
              onClick={() => setUseCustomColor(false)}
              className="px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer"
              style={{
                background: !useCustomColor ? "var(--accent)" : "var(--background)",
                color: !useCustomColor ? "white" : "var(--muted)",
                border: `1px solid ${!useCustomColor ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              Theme
            </button>
            <button
              onClick={() => setUseCustomColor(true)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer"
              style={{
                background: useCustomColor ? "var(--accent)" : "var(--background)",
                color: useCustomColor ? "white" : "var(--muted)",
                border: `1px solid ${useCustomColor ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              Custom
            </button>
            {useCustomColor && (
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
              />
            )}
          </label>

          {/* View mode */}
          <div className="flex items-center gap-1 ml-auto">
            {([
              ["grid", LayoutGrid],
              ["list", List],
              ["compact", Grid3X3],
            ] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="p-1.5 rounded-md transition-colors cursor-pointer"
                style={{
                  background: viewMode === mode ? "var(--accent)" : "transparent",
                  color: viewMode === mode ? "white" : "var(--muted)",
                }}
                title={mode.charAt(0).toUpperCase() + mode.slice(1)}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- Search Bar ---- */}
      <div className="px-4 py-2.5 shrink-0" style={{ background: "var(--background)" }}>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <Search size={16} style={{ color: "var(--muted)" }} />
          <input
            type="text"
            placeholder="Search icons..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--muted)]"
            style={{ color: "var(--foreground)" }}
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              <X size={14} style={{ color: "var(--muted)" }} />
            </button>
          )}
        </div>
      </div>

      {/* ---- Icon Grid ---- */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-2">
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 gap-2"
            style={{ color: "var(--muted)" }}
          >
            <Search size={32} />
            <p className="text-sm">No icons found for &ldquo;{debouncedQuery}&rdquo;</p>
          </div>
        ) : (
          <>
            <div className={gridClasses[viewMode]}>
              {visibleIcons.map((entry) => (
                <IconCard
                  key={entry.name}
                  entry={entry}
                  size={size}
                  color={activeColor}
                  strokeWidth={strokeWidth}
                  isSelected={selected === entry.name}
                  onClick={() => handleSelect(entry.name)}
                  viewMode={viewMode}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={loadMore}
                  className="text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                  style={{
                    background: "var(--surface)",
                    color: "var(--accent)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Load more ({filtered.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ---- Detail Panel ---- */}
      {selectedEntry && (
        <DetailPanel
          entry={selectedEntry}
          size={size}
          color={activeColor}
          strokeWidth={strokeWidth}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
