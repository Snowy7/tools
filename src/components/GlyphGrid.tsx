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

  const allSets: GlyphSet[] = [
    ...GLYPH_SETS,
    ...EXTRA_GLYPH_SETS.filter((s) => enabledSets.includes(s.label)),
  ];

  if (customGlyphs.length > 0) {
    allSets.push({ label: "Custom", chars: customGlyphs });
  }

  const totalChars = allSets.reduce((a, s) => a + s.chars.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Language packs toggle */}
      <div>
        <button
          onClick={() => setShowLanguages(!showLanguages)}
          className="flex items-center gap-2 text-xs text-[var(--accent)] hover:underline mb-2"
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`transition-transform ${showLanguages ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          Language Packs
        </button>
        {showLanguages && (
          <div className="flex flex-wrap gap-1.5 mb-3 p-2 rounded-lg bg-[var(--background)] border border-[var(--border)]">
            {EXTRA_GLYPH_SETS.map((set) => {
              const enabled = enabledSets.includes(set.label);
              return (
                <button
                  key={set.label}
                  onClick={() => onToggleSet(set.label)}
                  className={`px-2 py-1 text-[11px] rounded-md transition-all ${
                    enabled
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/40"
                  }`}
                >
                  {set.label} ({set.chars.length})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Glyph sections */}
      {allSets.map((section) => (
        <div key={section.label}>
          <h3 className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5">
            {section.label}
          </h3>
          <div className="flex flex-wrap gap-1">
            {section.chars.map((char) => {
              const isActive = activeGlyph === char;
              const isComplete = completedGlyphs.has(char);
              const preview = glyphPreviews.get(char);

              return (
                <button
                  key={`${section.label}-${char}`}
                  onClick={() => onSelectGlyph(char)}
                  title={`U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`}
                  className={`
                    relative w-9 h-9 rounded-lg text-sm font-medium transition-all
                    flex items-center justify-center overflow-hidden
                    ${
                      isActive
                        ? "ring-2 ring-[var(--accent)] bg-[var(--accent)] text-white scale-110 shadow-md z-10"
                        : isComplete
                        ? "bg-[var(--surface)] border border-[var(--accent)]/30"
                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
                    }
                  `}
                >
                  {preview && !isActive ? (
                    <img src={preview} alt={char} className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <span className="text-[11px]">{char}</span>
                  )}
                </button>
              );
            })}
            {section.label === "Custom" &&
              customGlyphs.map((char) => (
                <button
                  key={`remove-${char}`}
                  onClick={() => onRemoveCustomGlyph(char)}
                  className="w-9 h-9 rounded-lg text-[10px] bg-red-50 border border-red-200 text-red-400 hover:bg-red-100 flex items-center justify-center"
                  title={`Remove ${char}`}
                >
                  &times;
                </button>
              ))}
          </div>
        </div>
      ))}

      {/* Add custom glyph */}
      <div className="pt-2 border-t border-[var(--border)]">
        <label className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
          Add Custom Glyph
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type character(s)..."
            className="flex-1 px-2 py-1 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={() => {
              if (customInput.trim()) {
                for (const ch of customInput.trim()) {
                  onAddCustomGlyph(ch);
                }
                setCustomInput("");
              }
            }}
            className="px-3 py-1 text-xs bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)]"
          >
            Add
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="text-[11px] text-[var(--muted)] pt-2 border-t border-[var(--border)]">
        {completedGlyphs.size} / {totalChars} glyphs completed
      </div>
    </div>
  );
}
