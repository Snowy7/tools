"use client";

import { useState } from "react";

interface FontPreviewProps {
  glyphPreviews: Map<string, string>;
}

export default function FontPreview({ glyphPreviews }: FontPreviewProps) {
  const [text, setText] = useState("Hello World");
  const [size, setSize] = useState(48);

  const chars = text.split("");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type to preview..."
          className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm outline-none focus:border-[var(--accent)]"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--muted)]">Size</label>
          <input
            type="range"
            min={24}
            max={96}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-20"
          />
        </div>
      </div>

      <div
        className="min-h-[120px] p-4 border border-[var(--border)] rounded-lg bg-white flex items-center gap-0.5 flex-wrap"
      >
        {chars.map((char, i) => {
          if (char === " ") {
            return <div key={i} style={{ width: size * 0.4 }} />;
          }
          const preview = glyphPreviews.get(char);
          if (preview) {
            return (
              <img
                key={i}
                src={preview}
                alt={char}
                style={{ height: size, width: "auto" }}
                className="object-contain"
              />
            );
          }
          return (
            <span
              key={i}
              className="text-[var(--muted)]/30 font-mono"
              style={{ fontSize: size * 0.6, lineHeight: 1 }}
            >
              {char}
            </span>
          );
        })}
      </div>
    </div>
  );
}
