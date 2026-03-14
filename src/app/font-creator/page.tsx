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

  // Build the full character list for navigation
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
    setGlyphs((prev) => {
      const next = new Map(prev);
      next.delete(char);
      return next;
    });
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
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        const newGlyphs = new Map<string, GlyphEntry>();

        for (const char of allTargetChars) {
          const glyph = font.charToGlyph(char);
          if (!glyph || glyph.index === 0) continue;

          ctx.clearRect(0, 0, size, size);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, size, size);

          const fontSize = size * 0.55;
          const path = glyph.getPath(size * 0.15, size * 0.72, fontSize);
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
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)]">
        <Link
          href="/"
          className="w-8 h-8 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>

        <input
          type="text"
          value={fontName}
          onChange={(e) => setFontName(e.target.value)}
          className="text-base font-semibold bg-transparent border-none outline-none min-w-0 px-1"
        />

        <div className="ml-auto flex items-center gap-2">
          <input
            ref={fontFileRef}
            type="file"
            accept=".otf,.ttf,.woff,.woff2"
            onChange={handleFontUpload}
            className="hidden"
          />
          <button
            onClick={() => fontFileRef.current?.click()}
            className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            Import Font
          </button>
          <button
            onClick={() => setShowExtractor(true)}
            className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            Extract from Image
          </button>
          <button
            onClick={() => setShowExport(true)}
            disabled={glyphs.size === 0}
            className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium disabled:opacity-40"
          >
            Export
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex gap-0 px-4 border-b border-[var(--border)] bg-[var(--surface)]">
        {(["draw", "preview"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition-colors relative ${
              tab === t ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t === "draw" ? "Draw Glyphs" : "Preview"}
            {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {tab === "draw" && (
          <>
            {/* Sidebar */}
            <aside className="w-72 border-r border-[var(--border)] p-3 overflow-auto bg-[var(--surface)] flex-shrink-0">
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

            {/* Drawing area */}
            <main className="flex-1 flex flex-col items-center justify-center gap-5 p-6 overflow-auto">
              <div className="text-center">
                <h2 className="text-5xl font-bold mb-1">{activeGlyph}</h2>
                <p className="text-xs text-[var(--muted)]">
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (activeIdx > 0) setActiveGlyph(allChars[activeIdx - 1]);
                  }}
                  disabled={activeIdx <= 0}
                  className="px-4 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30"
                >
                  &larr; Prev
                </button>
                <span className="text-xs text-[var(--muted)]">
                  {activeIdx + 1} / {allChars.length}
                </span>
                <button
                  onClick={() => {
                    if (activeIdx < allChars.length - 1) setActiveGlyph(allChars[activeIdx + 1]);
                  }}
                  disabled={activeIdx >= allChars.length - 1}
                  className="px-4 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium disabled:opacity-30"
                >
                  Next &rarr;
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
                      <div
                        key={char}
                        className="w-14 h-14 border border-[var(--border)] rounded-lg overflow-hidden bg-white flex items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors group relative"
                        onClick={() => { setActiveGlyph(char); setTab("draw"); }}
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
