"use client";

import { useState } from "react";
import { GLYPH_SETS, EXTRA_GLYPH_SETS, type GlyphSet } from "@/lib/font-utils";

interface GlyphGridProps {
  completedGlyphs: Set<string>;
  activeGlyph: string | null;
  onSelectGlyph: (char: string) => void;
  glyphPreviews: Map<string, string>;
  enabledSets: string[];
  onToggleSet: (label: string) => void;
  customGlyphs: string[];
  onAddCustomGlyph: (char: string) => void;
  onRemoveCustomGlyph: (char: string) => void;
}

export default function GlyphGrid({
  completedGlyphs,
  activeGlyph,
  onSelectGlyph,
  glyphPreviews,
  enabledSets,
  onToggleSet,
  customGlyphs,
  onAddCustomGlyph,
  onRemoveCustomGlyph,
}: GlyphGridProps) {
  const [customInput, setCustomInput] = useState("");
  const [showLanguages, setShowLanguages] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allSets: GlyphSet[] = [
    ...GLYPH_SETS,
    ...EXTRA_GLYPH_SETS.filter((s) => enabledSets.includes(s.label)),
  ];
  if (customGlyphs.length > 0) {
    allSets.push({ label: "Custom", chars: customGlyphs });
  }

  const totalChars = allSets.reduce((a, s) => a + s.chars.length, 0);

  function toggleCollapse(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-1 h-full">
      {/* Language packs */}
      <div className="flex-shrink-0">
        <button
          onClick={() => setShowLanguages(!showLanguages)}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[11px] text-[var(--accent)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`transition-transform flex-shrink-0 ${showLanguages ? "rotate-90" : ""}`}>
            <path d="M9 18l6-6-6-6" />
          </svg>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          Language Packs
        </button>
        {showLanguages && (
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {EXTRA_GLYPH_SETS.map((set) => {
              const enabled = enabledSets.includes(set.label);
              return (
                <button key={set.label} onClick={() => onToggleSet(set.label)}
                  className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${
                    enabled ? "bg-[var(--accent)] text-white" : "bg-[var(--background)] border border-[var(--border)] hover:border-[var(--accent)]/40 text-[var(--muted)]"
                  }`}>
                  {set.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Glyph sections - scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-1 space-y-0.5">
        {allSets.map((section) => {
          const isCollapsed = collapsed.has(section.label);
          const completedInSection = section.chars.filter((c) => completedGlyphs.has(c)).length;

          return (
            <div key={section.label}>
              <button
                onClick={() => toggleCollapse(section.label)}
                className="flex items-center gap-1.5 w-full px-1.5 py-1 rounded-lg hover:bg-[var(--surface-hover)] transition-colors group"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                  className={`transition-transform text-[var(--muted)] flex-shrink-0 ${isCollapsed ? "" : "rotate-90"}`}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider flex-1 text-left">
                  {section.label}
                </span>
                <span className="text-[9px] text-[var(--muted)] bg-[var(--background)] px-1 py-0.5 rounded">
                  {completedInSection}/{section.chars.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="flex flex-wrap gap-[3px] px-1 pb-1 pt-0.5">
                  {section.chars.map((char) => {
                    const isActive = activeGlyph === char;
                    const isComplete = completedGlyphs.has(char);
                    const preview = glyphPreviews.get(char);

                    return (
                      <button
                        key={`${section.label}-${char}`}
                        onClick={() => onSelectGlyph(char)}
                        title={`${char} — U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`}
                        className={`
                          relative w-8 h-8 rounded-md text-xs font-medium transition-all
                          flex items-center justify-center overflow-hidden
                          ${isActive
                            ? "ring-2 ring-[var(--accent)] bg-[var(--accent)] text-white scale-110 shadow-md z-10"
                            : isComplete
                            ? "bg-[var(--surface)] border border-[var(--accent)]/30 hover:border-[var(--accent)]"
                            : "bg-[var(--background)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
                          }
                        `}
                      >
                        {preview && !isActive ? (
                          <img src={preview} alt={char} className="w-full h-full object-contain p-0.5" />
                        ) : (
                          <span className="text-[10px] leading-none">{char}</span>
                        )}
                      </button>
                    );
                  })}

                  {/* Remove buttons for custom glyphs */}
                  {section.label === "Custom" && customGlyphs.map((char) => (
                    <button key={`rm-${char}`} onClick={() => onRemoveCustomGlyph(char)}
                      className="w-8 h-8 rounded-md text-[9px] bg-red-50 border border-red-200 text-red-400 hover:bg-red-100 flex items-center justify-center"
                      title={`Remove ${char}`}>
                      &times;
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom: custom glyph input + stats */}
      <div className="flex-shrink-0 border-t border-[var(--border)] pt-2 px-1 space-y-2">
        <div className="flex gap-1">
          <input type="text" value={customInput} onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Add glyph..."
            className="flex-1 px-2 py-1 text-[11px] border border-[var(--border)] rounded-md bg-[var(--background)] outline-none focus:border-[var(--accent)] min-w-0" />
          <button onClick={() => {
            if (customInput.trim()) {
              for (const ch of customInput.trim()) onAddCustomGlyph(ch);
              setCustomInput("");
            }
          }} className="px-2 py-1 text-[10px] bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)]">
            Add
          </button>
        </div>
        <div className="text-[10px] text-[var(--muted)] pb-1">
          {completedGlyphs.size} / {totalChars} completed
        </div>
      </div>
    </div>
  );
}
