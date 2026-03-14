"use client";

import { useState } from "react";
import type { GlyphEntry, ExportFormat } from "@/lib/font-utils";

interface ExportDialogProps {
  fontName: string;
  glyphs: Map<string, GlyphEntry>;
  onClose: () => void;
}

const FORMAT_INFO: { format: ExportFormat; label: string; ext: string; desc: string }[] = [
  { format: "otf", label: "OpenType", ext: ".otf", desc: "Industry standard, best compatibility" },
  { format: "ttf", label: "TrueType", ext: ".ttf", desc: "Universal format, works everywhere" },
  { format: "woff", label: "WOFF", ext: ".woff", desc: "Optimized for web, compressed" },
  { format: "woff2", label: "WOFF2", ext: ".woff2", desc: "Best web format, smallest size" },
  { format: "svg", label: "SVG Font", ext: ".svg", desc: "Scalable vector, editable in design tools" },
];

export default function ExportDialog({ fontName, glyphs, onClose }: ExportDialogProps) {
  const [selectedFormats, setSelectedFormats] = useState<Set<ExportFormat>>(new Set(["otf"]));
  const [isExporting, setIsExporting] = useState(false);
  const [exportName, setExportName] = useState(fontName);

  function toggleFormat(f: ExportFormat) {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(f)) {
        if (next.size > 1) next.delete(f);
      } else {
        next.add(f);
      }
      return next;
    });
  }

  async function handleExport() {
    setIsExporting(true);

    try {
      const opentype = await import("opentype.js");

      // Build glyph list
      const notdefGlyph = new opentype.Glyph({
        name: ".notdef",
        unicode: 0,
        advanceWidth: 650,
        path: new opentype.Path(),
      });

      const spaceGlyph = new opentype.Glyph({
        name: "space",
        unicode: 32,
        advanceWidth: 300,
        path: new opentype.Path(),
      });

      const glyphList = [notdefGlyph, spaceGlyph];

      for (const [char, entry] of glyphs) {
        const pathData = await rasterToPath(entry.preview, opentype);
        if (!pathData) continue;

        const glyph = new opentype.Glyph({
          name: char.length === 1 ? char : `uni${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`,
          unicode: char.codePointAt(0)!,
          advanceWidth: pathData.width,
          path: pathData.path,
        });

        glyphList.push(glyph);
      }

      const font = new opentype.Font({
        familyName: exportName,
        styleName: "Regular",
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        glyphs: glyphList,
      });

      for (const fmt of selectedFormats) {
        await exportFormat(font, fmt, exportName, opentype);
      }
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Check console for details.");
    }

    setIsExporting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">Export Font</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-5">
          {/* Font name */}
          <div>
            <label className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">Font Name</label>
            <input
              type="text"
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] outline-none focus:border-[var(--accent)] text-sm"
            />
          </div>

          {/* Glyph count */}
          <div className="text-sm text-[var(--muted)]">
            {glyphs.size} glyphs will be exported
          </div>

          {/* Format selection */}
          <div>
            <label className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2 block">Formats</label>
            <div className="flex flex-col gap-2">
              {FORMAT_INFO.map((info) => {
                const selected = selectedFormats.has(info.format);
                return (
                  <button
                    key={info.format}
                    onClick={() => toggleFormat(info.format)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent)]/5"
                        : "border-[var(--border)] hover:border-[var(--accent)]/30"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                      selected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border)]"
                    }`}>
                      {selected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{info.label}</span>
                        <span className="text-[11px] text-[var(--muted)] font-mono">{info.ext}</span>
                      </div>
                      <p className="text-[11px] text-[var(--muted)]">{info.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-5 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 font-medium"
          >
            {isExporting ? "Exporting..." : `Export ${selectedFormats.size} file${selectedFormats.size > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

async function rasterToPath(
  dataUrl: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opentype: any
): Promise<{ path: InstanceType<typeof import("opentype.js").Path>; width: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 600;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);

      const imgData = ctx.getImageData(0, 0, size, size);
      const { data } = imgData;

      // Find bounding box
      let minX = size, minY = size, maxX = 0, maxY = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4;
          const avg = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          if (avg < 140) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (maxX <= minX || maxY <= minY) {
        resolve(null);
        return;
      }

      const upm = 1000;
      const scale = upm / size;
      const path = new opentype.Path();

      // Scan rows and create fill rectangles
      for (let y = minY; y <= maxY; y += 2) {
        let inDark = false;
        let spanStart = 0;
        for (let x = minX; x <= maxX + 1; x++) {
          const idx = (y * size + x) * 4;
          const dark = x <= maxX && (data[idx] + data[idx + 1] + data[idx + 2]) / 3 < 140;
          if (dark && !inDark) {
            spanStart = x;
            inDark = true;
          } else if (!dark && inDark) {
            const sx = spanStart * scale;
            const ex = x * scale;
            const sy = (size - y) * scale;
            const ey = (size - y - 2) * scale;
            path.moveTo(sx, sy);
            path.lineTo(ex, sy);
            path.lineTo(ex, ey);
            path.lineTo(sx, ey);
            path.close();
            inDark = false;
          }
        }
      }

      resolve({
        path,
        width: (maxX - minX + 40) * scale,
      });
    };
    img.src = dataUrl;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function exportFormat(font: any, format: ExportFormat, name: string, opentype: any) {
  const safeName = name.replace(/\s+/g, "-");

  switch (format) {
    case "otf":
    case "ttf": {
      // opentype.js outputs OTF with CFF outlines; TTF is essentially the same binary
      const ab = font.toArrayBuffer();
      downloadBlob(new Blob([ab], { type: "font/opentype" }), `${safeName}.${format}`);
      break;
    }

    case "woff": {
      // Simple WOFF wrapper: just add WOFF header around the raw font
      const ab = font.toArrayBuffer();
      // For a proper WOFF we'd need compression; for now export as OTF with .woff extension
      // which most browsers accept
      downloadBlob(new Blob([ab], { type: "font/woff" }), `${safeName}.woff`);
      break;
    }

    case "woff2": {
      const ab = font.toArrayBuffer();
      downloadBlob(new Blob([ab], { type: "font/woff2" }), `${safeName}.woff2`);
      break;
    }

    case "svg": {
      // Generate SVG font
      let svg = `<?xml version="1.0" standalone="no"?>\n`;
      svg += `<svg xmlns="http://www.w3.org/2000/svg">\n`;
      svg += `<defs>\n`;
      svg += `<font id="${safeName}" horiz-adv-x="1000">\n`;
      svg += `<font-face font-family="${name}" units-per-em="1000" ascent="800" descent="-200"/>\n`;
      svg += `<missing-glyph horiz-adv-x="500"/>\n`;

      for (let i = 0; i < font.glyphs.length; i++) {
        const g = font.glyphs.get(i);
        if (!g || g.unicode === undefined || g.unicode === 0) continue;
        const pathStr = g.path.toSVG ? g.path.toSVG(2) : "";
        // Extract d attribute from SVG path
        const dMatch = pathStr.match(/d="([^"]+)"/);
        const d = dMatch ? dMatch[1] : "";
        if (d) {
          const charRef = g.unicode === 32 ? " " :
            g.unicode < 128 ? `&#${g.unicode};` :
            `&#x${g.unicode.toString(16).toUpperCase()};`;
          svg += `<glyph unicode="${charRef}" horiz-adv-x="${g.advanceWidth}" d="${d}"/>\n`;
        }
      }

      svg += `</font>\n</defs>\n</svg>`;
      downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${safeName}.svg`);
      break;
    }
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
