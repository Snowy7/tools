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

  const currentGlyph = glyphs.get(activeGlyph);
  const activeIdx = allChars.indexOf(activeGlyph);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>

        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--accent)]">
            <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
          </svg>
          <input type="text" value={fontName} onChange={(e) => setFontName(e.target.value)}
            className="text-sm font-semibold bg-transparent border-none outline-none min-w-0 px-0.5" />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <input ref={fontFileRef} type="file" accept=".otf,.ttf,.woff,.woff2" onChange={handleFontUpload} className="hidden" />
          <button onClick={() => fontFileRef.current?.click()}
            className="px-2.5 py-1 text-[11px] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            Import Font
          </button>
          <button onClick={() => setShowExtractor(true)}
            className="px-2.5 py-1 text-[11px] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
            Extract Image
          </button>
          <button onClick={() => setShowExport(true)} disabled={glyphs.size === 0}
            className="px-2.5 py-1 text-[11px] bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium disabled:opacity-40 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex gap-0 px-4 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        {(["draw", "preview"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs transition-colors relative ${
              tab === t ? "text-[var(--foreground)] font-medium" : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}>
            {t === "draw" ? "Draw Glyphs" : "Preview"}
            {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />}
          </button>
        ))}
      </div>

      {/* Content - fills remaining height, no page scroll */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {tab === "draw" && (
          <>
            {/* Sidebar - scrolls independently */}
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

            {/* Drawing area - centered, no scroll */}
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
              />

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { if (activeIdx > 0) setActiveGlyph(allChars[activeIdx - 1]); }}
                  disabled={activeIdx <= 0}
                  className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-20"
                  title="Previous glyph">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <span className="text-[11px] text-[var(--muted)] min-w-[60px] text-center">
                  {activeIdx + 1} / {allChars.length}
                </span>
                <button
                  onClick={() => { if (activeIdx < allChars.length - 1) setActiveGlyph(allChars[activeIdx + 1]); }}
                  disabled={activeIdx >= allChars.length - 1}
                  className="p-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-20"
                  title="Next glyph">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            </main>
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
                      <div key={char}
                        className="w-14 h-14 border border-[var(--border)] rounded-lg overflow-hidden bg-white flex items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors group relative"
                        onClick={() => { setActiveGlyph(char); setTab("draw"); }}>
                        <img src={entry.preview} alt={char} className="w-full h-full object-contain p-1" />
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{char}</span>
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
