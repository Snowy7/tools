"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import GlyphCanvas from "@/components/GlyphCanvas";
import GlyphGrid from "@/components/GlyphGrid";
import ImageExtractor from "@/components/ImageExtractor";
import FontPreview from "@/components/FontPreview";
import ExportDialog from "@/components/ExportDialog";
import { GLYPH_SETS, EXTRA_GLYPH_SETS, type GlyphEntry, type StrokeData } from "@/lib/font-utils";

type Tab = "draw" | "preview";

interface FontMetrics {
  ascender: number;
  capHeight: number;
  xHeight: number;
  baseline: number;
  descender: number;
}

const DEFAULT_METRICS: FontMetrics = {
  ascender: 0.15,
  capHeight: 0.25,
  xHeight: 0.42,
  baseline: 0.75,
  descender: 0.9,
};

const SYSTEM_FONTS = [
  "serif",
  "sans-serif",
  "monospace",
  "Arial",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Palatino",
  "Garamond",
  "Bookman",
  "Helvetica",
  "Impact",
];

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        {title}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="px-4 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

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
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-xs text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-[18px] rounded-full transition-colors ${
          checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"
        }`}
      >
        <span
          className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
            checked ? "left-[16px]" : "left-[2px]"
          }`}
        />
      </button>
    </label>
  );
}

function SliderRow({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        <span className="text-[10px] font-mono text-[var(--muted)] tabular-nums">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-[var(--border)] rounded-full appearance-none cursor-pointer accent-[var(--accent)]"
      />
    </div>
  );
}

export default function FontCreatorPage() {
  const [fontName, setFontName] = useState("My Font");
  const [activeGlyph, setActiveGlyph] = useState<string>("A");
  const [glyphs, setGlyphs] = useState<Map<string, GlyphEntry>>(new Map());
  const [showExtractor, setShowExtractor] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [tab, setTab] = useState<Tab>("draw");
  const [enabledSets, setEnabledSets] = useState<string[]>([]);
  const [customGlyphs, setCustomGlyphs] = useState<string[]>([]);
  const fontFileRef = useRef<HTMLInputElement>(null);

  // Guide and ghost state
  const [showGuides, setShowGuides] = useState(true);
  const [showGhost, setShowGhost] = useState(false);
  const [ghostFont, setGhostFont] = useState("serif");
  const [ghostOpacity, setGhostOpacity] = useState(0.15);
  const [metrics, setMetrics] = useState<FontMetrics>(DEFAULT_METRICS);

  // Advance width per glyph (default ~0.6 normalized)
  const [advanceWidth, setAdvanceWidth] = useState(0.6);

  const completedGlyphs = new Set(glyphs.keys());
  const glyphPreviews = new Map(
    Array.from(glyphs.entries()).map(([k, v]) => [k, v.preview])
  );

  const allChars = [
    ...GLYPH_SETS.flatMap((s) => s.chars),
    ...EXTRA_GLYPH_SETS.filter((s) => enabledSets.includes(s.label)).flatMap((s) => s.chars),
    ...customGlyphs,
  ];

  const handleGlyphChange = useCallback(
    (strokes: StrokeData[], preview: string) => {
      setGlyphs((prev) => {
        const next = new Map(prev);
        if (strokes.length === 0 && !next.get(activeGlyph)?.imageData) {
          next.delete(activeGlyph);
        } else {
          next.set(activeGlyph, {
            strokes,
            preview,
            imageData: next.get(activeGlyph)?.imageData,
          });
        }
        return next;
      });
    },
    [activeGlyph]
  );

  const handleSelectGlyph = useCallback((char: string) => {
    setActiveGlyph(char);
    setTab("draw");
  }, []);

  const handleToggleSet = useCallback((label: string) => {
    setEnabledSets((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }, []);

  const handleAddCustomGlyph = useCallback((char: string) => {
    setCustomGlyphs((prev) => (prev.includes(char) ? prev : [...prev, char]));
  }, []);

  const handleRemoveCustomGlyph = useCallback((char: string) => {
    setCustomGlyphs((prev) => prev.filter((c) => c !== char));
    setGlyphs((prev) => { const n = new Map(prev); n.delete(char); return n; });
  }, []);

  const handleImageExtract = useCallback(
    (extracted: { char: string; imageData: string }[]) => {
      setGlyphs((prev) => {
        const next = new Map(prev);
        for (const g of extracted) {
          next.set(g.char, { strokes: [], preview: g.imageData, imageData: g.imageData });
        }
        return next;
      });
      setShowExtractor(false);
    },
    []
  );

  const handleFontUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      try {
        const opentype = await import("opentype.js");
        const font = opentype.parse(buffer);
        setFontName(font.names.fontFamily?.en || file.name.replace(/\.\w+$/, ""));

        const allTargetChars = allChars.join("");
        const canvas = document.createElement("canvas");
        const size = 600;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const newGlyphs = new Map<string, GlyphEntry>();

        for (const char of allTargetChars) {
          const glyph = font.charToGlyph(char);
          if (!glyph || glyph.index === 0) continue;
          ctx.clearRect(0, 0, size, size);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, size, size);
          const path = glyph.getPath(size * 0.15, size * 0.72, size * 0.55);
          path.fill = "#0a0a0a";
          path.draw(ctx);
          newGlyphs.set(char, { strokes: [], preview: canvas.toDataURL("image/png") });
        }
        setGlyphs(newGlyphs);
      } catch {
        alert("Could not parse font file. Supported: .otf, .ttf, .woff");
      }
    };
    reader.readAsArrayBuffer(file);
  }, [allChars]);

  const updateMetric = useCallback((key: keyof FontMetrics, value: number) => {
    setMetrics((prev) => ({ ...prev, [key]: value }));
  }, []);

  const currentGlyph = glyphs.get(activeGlyph);
  const activeIdx = allChars.indexOf(activeGlyph);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>

        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--accent)]">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
          <input
            type="text"
            value={fontName}
            onChange={(e) => setFontName(e.target.value)}
            className="text-sm font-semibold bg-transparent border-none outline-none min-w-0 px-0.5"
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <input ref={fontFileRef} type="file" accept=".otf,.ttf,.woff,.woff2" onChange={handleFontUpload} className="hidden" />
          <button
            onClick={() => fontFileRef.current?.click()}
            className="px-2.5 py-1 text-[11px] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import Font
          </button>
          <button
            onClick={() => setShowExtractor(true)}
            className="px-2.5 py-1 text-[11px] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            Extract Image
          </button>
          <button
            onClick={() => setShowExport(true)}
            disabled={glyphs.size === 0}
            className="px-2.5 py-1 text-[11px] bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium disabled:opacity-40 flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex gap-0 px-4 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        {(["draw", "preview"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs transition-colors relative ${
              tab === t
                ? "text-[var(--foreground)] font-medium"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t === "draw" ? "Draw Glyphs" : "Preview"}
            {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {tab === "draw" && (
          <>
            {/* Left sidebar - glyph grid */}
            <aside className="w-64 border-r border-[var(--border)] bg-[var(--surface)] flex-shrink-0 flex flex-col overflow-hidden">
              <GlyphGrid
                completedGlyphs={completedGlyphs}
                activeGlyph={activeGlyph}
                onSelectGlyph={handleSelectGlyph}
                glyphPreviews={glyphPreviews}
                enabledSets={enabledSets}
                onToggleSet={handleToggleSet}
                customGlyphs={customGlyphs}
                onAddCustomGlyph={handleAddCustomGlyph}
                onRemoveCustomGlyph={handleRemoveCustomGlyph}
              />
            </aside>

            {/* Center - canvas area */}
            <main className="flex-1 flex flex-col items-center justify-center gap-4 p-4 min-h-0">
              <div className="text-center">
                <h2 className="text-4xl font-bold leading-none">{activeGlyph}</h2>
                <p className="text-[10px] text-[var(--muted)] mt-0.5 font-mono">
                  U+{activeGlyph.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}
                </p>
              </div>

              <GlyphCanvas
                key={activeGlyph}
                char={activeGlyph}
                size={600}
                initialStrokes={currentGlyph?.strokes || []}
                initialImage={currentGlyph?.imageData}
                onChange={handleGlyphChange}
                showGuides={showGuides}
                ghostChar={showGhost ? activeGlyph : undefined}
                ghostFont={ghostFont}
                ghostOpacity={ghostOpacity}
                ascender={metrics.ascender}
                capHeight={metrics.capHeight}
                xHeight={metrics.xHeight}
                baseline={metrics.baseline}
                descender={metrics.descender}
              />

              {/* Prev / Next navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (activeIdx > 0) setActiveGlyph(allChars[activeIdx - 1]);
                  }}
                  disabled={activeIdx <= 0}
                  className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-20"
                  title="Previous glyph"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <span className="text-[11px] text-[var(--muted)] min-w-[60px] text-center">
                  {activeIdx + 1} / {allChars.length}
                </span>
                <button
                  onClick={() => {
                    if (activeIdx < allChars.length - 1) setActiveGlyph(allChars[activeIdx + 1]);
                  }}
                  disabled={activeIdx >= allChars.length - 1}
                  className="p-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-20"
                  title="Next glyph"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </main>

            {/* Right sidebar - settings */}
            <aside className="w-72 border-l border-[var(--border)] bg-[var(--surface)] flex-shrink-0 overflow-y-auto">
              <CollapsibleSection title="Guide Settings">
                <Toggle label="Show Guides" checked={showGuides} onChange={setShowGuides} />
                <Toggle label="Show Ghost" checked={showGhost} onChange={setShowGhost} />
              </CollapsibleSection>

              <CollapsibleSection title="Ghost Reference" defaultOpen={showGhost}>
                <div className="space-y-1">
                  <span className="text-xs text-[var(--muted)]">Ghost Font</span>
                  <select
                    value={ghostFont}
                    onChange={(e) => setGhostFont(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-colors"
                  >
                    {SYSTEM_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <SliderRow
                  label="Ghost Opacity"
                  value={ghostOpacity}
                  min={0.05}
                  max={0.5}
                  step={0.01}
                  onChange={setGhostOpacity}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Font Metrics">
                <SliderRow
                  label="Ascender"
                  value={metrics.ascender}
                  onChange={(v) => updateMetric("ascender", v)}
                />
                <SliderRow
                  label="Cap Height"
                  value={metrics.capHeight}
                  onChange={(v) => updateMetric("capHeight", v)}
                />
                <SliderRow
                  label="x-Height"
                  value={metrics.xHeight}
                  onChange={(v) => updateMetric("xHeight", v)}
                />
                <SliderRow
                  label="Baseline"
                  value={metrics.baseline}
                  onChange={(v) => updateMetric("baseline", v)}
                />
                <SliderRow
                  label="Descender"
                  value={metrics.descender}
                  onChange={(v) => updateMetric("descender", v)}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Glyph Settings">
                <SliderRow
                  label="Advance Width"
                  value={advanceWidth}
                  min={0.1}
                  max={1}
                  step={0.01}
                  onChange={setAdvanceWidth}
                />
              </CollapsibleSection>
            </aside>
          </>
        )}

        {tab === "preview" && (
          <main className="flex-1 p-8 overflow-auto">
            <div className="max-w-3xl mx-auto">
              <FontPreview glyphPreviews={glyphPreviews} />
              {glyphs.size > 0 && (
                <div className="mt-8">
                  <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3">
                    All Glyphs ({glyphs.size})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(glyphs.entries()).map(([char, entry]) => (
                      <div
                        key={char}
                        className="w-14 h-14 border border-[var(--border)] rounded-lg overflow-hidden bg-white flex items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors group relative"
                        onClick={() => {
                          setActiveGlyph(char);
                          setTab("draw");
                        }}
                      >
                        <img src={entry.preview} alt={char} className="w-full h-full object-contain p-1" />
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {char}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {glyphs.size === 0 && (
                <div className="text-center py-20 text-[var(--muted)]">
                  No glyphs yet. Start drawing or import to preview.
                </div>
              )}
            </div>
          </main>
        )}
      </div>

      {showExtractor && (
        <ImageExtractor onExtract={handleImageExtract} onClose={() => setShowExtractor(false)} />
      )}
      {showExport && (
        <ExportDialog fontName={fontName} glyphs={glyphs} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
