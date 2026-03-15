"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  Download,
  Eraser,
  FlipHorizontal,
  Grid2X2,
  Paintbrush,
  Pipette,
  Square,
  Trash2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

type Tool = "draw" | "erase";

interface GridPreset {
  label: string;
  w: number;
  h: number;
}

const GRID_PRESETS: GridPreset[] = [
  { label: "5x7", w: 5, h: 7 },
  { label: "6x8", w: 6, h: 8 },
  { label: "7x9", w: 7, h: 9 },
  { label: "8x8", w: 8, h: 8 },
  { label: "8x12", w: 8, h: 12 },
  { label: "8x16", w: 8, h: 16 },
];

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const PUNCTUATION = "!@#$%^&*()-_=+[]{}|;:'\",.<>?/\\`~ ";
const ALL_CHARS = UPPERCASE + LOWERCASE + DIGITS + PUNCTUATION;

function makeEmptyGrid(w: number, h: number): boolean[][] {
  return Array.from({ length: h }, () => Array(w).fill(false));
}

function cloneGrid(g: boolean[][]): boolean[][] {
  return g.map((r) => [...r]);
}

function isGridEmpty(g: boolean[][]): boolean {
  return g.every((r) => r.every((c) => !c));
}

/* ------------------------------------------------------------------ */
/*  Atlas generation                                                   */
/* ------------------------------------------------------------------ */

function generateAtlas(
  characters: Record<string, boolean[][]>,
  gridW: number,
  gridH: number,
  color: string,
  cols: number = 16
): { canvas: HTMLCanvasElement; meta: object } {
  const chars = ALL_CHARS.split("").filter((c) => characters[c] && !isGridEmpty(characters[c]));
  if (chars.length === 0) {
    const cv = document.createElement("canvas");
    cv.width = 1;
    cv.height = 1;
    return { canvas: cv, meta: { gridWidth: gridW, gridHeight: gridH, characters: {} } };
  }

  const rows = Math.ceil(chars.length / cols);
  const cv = document.createElement("canvas");
  cv.width = cols * gridW;
  cv.height = rows * gridH;
  const ctx = cv.getContext("2d")!;

  const charMap: Record<string, { x: number; y: number; w: number; h: number }> = {};

  chars.forEach((ch, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = col * gridW;
    const oy = row * gridH;
    const grid = characters[ch];
    charMap[ch] = { x: ox, y: oy, w: gridW, h: gridH };

    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        if (grid[y]?.[x]) {
          ctx.fillStyle = color;
          ctx.fillRect(ox + x, oy + y, 1, 1);
        }
      }
    }
  });

  const meta = {
    gridWidth: gridW,
    gridHeight: gridH,
    atlasWidth: cv.width,
    atlasHeight: cv.height,
    columnsPerRow: cols,
    characters: charMap,
  };

  return { canvas: cv, meta };
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function PixelFontBuilderPage() {
  /* -- State -- */
  const [gridPreset, setGridPreset] = useState(3); // 8x8 default
  const gridW = GRID_PRESETS[gridPreset].w;
  const gridH = GRID_PRESETS[gridPreset].h;

  const [characters, setCharacters] = useState<Record<string, boolean[][]>>(() => {
    const m: Record<string, boolean[][]> = {};
    ALL_CHARS.split("").forEach((c) => (m[c] = makeEmptyGrid(8, 8)));
    return m;
  });

  const [selectedChar, setSelectedChar] = useState("A");
  const [tool, setTool] = useState<Tool>("draw");
  const [fontColor, setFontColor] = useState("#ffffff");
  const [spacing, setSpacing] = useState(1);
  const [lineHeight, setLineHeight] = useState(2);
  const [mirror, setMirror] = useState(false);
  const [previewText, setPreviewText] = useState("Hello World!");
  const [copied, setCopied] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawValue, setDrawValue] = useState(true);

  const editorCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* -- When grid preset changes, resize all character grids -- */
  const handlePresetChange = useCallback(
    (idx: number) => {
      const nw = GRID_PRESETS[idx].w;
      const nh = GRID_PRESETS[idx].h;
      setGridPreset(idx);
      setCharacters((prev) => {
        const next: Record<string, boolean[][]> = {};
        ALL_CHARS.split("").forEach((c) => {
          const old = prev[c];
          const g = makeEmptyGrid(nw, nh);
          if (old) {
            for (let y = 0; y < Math.min(nh, old.length); y++) {
              for (let x = 0; x < Math.min(nw, old[y].length); x++) {
                g[y][x] = old[y][x];
              }
            }
          }
          next[c] = g;
        });
        return next;
      });
    },
    []
  );

  /* -- Set pixel helper -- */
  const setPixel = useCallback(
    (x: number, y: number, value: boolean) => {
      setCharacters((prev) => {
        const grid = cloneGrid(prev[selectedChar]);
        if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
          grid[y][x] = value;
          if (mirror) {
            const mx = grid[0].length - 1 - x;
            if (mx >= 0 && mx < grid[0].length) {
              grid[y][mx] = value;
            }
          }
        }
        return { ...prev, [selectedChar]: grid };
      });
    },
    [selectedChar, mirror]
  );

  /* -- Fill / Clear all -- */
  const fillAll = useCallback(() => {
    setCharacters((prev) => {
      const grid = prev[selectedChar].map((r) => r.map(() => true));
      return { ...prev, [selectedChar]: grid };
    });
  }, [selectedChar]);

  const clearAll = useCallback(() => {
    setCharacters((prev) => ({
      ...prev,
      [selectedChar]: makeEmptyGrid(gridW, gridH),
    }));
  }, [selectedChar, gridW, gridH]);

  /* -- Draw editor canvas -- */
  const drawEditor = useCallback(() => {
    const canvas = editorCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const maxW = rect.width - 32;
    const maxH = rect.height - 80;

    const cellSize = Math.max(4, Math.min(Math.floor(maxW / gridW), Math.floor(maxH / gridH), 48));
    const cw = gridW * cellSize;
    const ch = gridH * cellSize;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "var(--surface)";
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, cw, ch);

    const grid = characters[selectedChar];
    if (!grid) return;

    // Draw pixels
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        if (grid[y]?.[x]) {
          ctx.fillStyle = fontColor;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= gridW; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize + 0.5, 0);
      ctx.lineTo(x * cellSize + 0.5, ch);
      ctx.stroke();
    }
    for (let y = 0; y <= gridH; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize + 0.5);
      ctx.lineTo(cw, y * cellSize + 0.5);
      ctx.stroke();
    }

    // Mirror line
    if (mirror) {
      ctx.strokeStyle = "rgba(255,100,100,0.35)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      const mx = (gridW / 2) * cellSize;
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, ch);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [characters, selectedChar, gridW, gridH, fontColor, mirror]);

  useEffect(() => {
    drawEditor();
  }, [drawEditor]);

  useEffect(() => {
    const handleResize = () => drawEditor();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawEditor]);

  /* -- Draw preview canvas -- */
  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const scale = 3;
    const pw = gridW * scale;
    const ph = gridH * scale;

    const lines = previewText.split("\n");
    let maxLineW = 0;
    for (const line of lines) {
      const lw = line.length * (pw + spacing * scale) - spacing * scale;
      if (lw > maxLineW) maxLineW = lw;
    }

    const totalH = lines.length * (ph + lineHeight * scale) - lineHeight * scale;
    const dpr = window.devicePixelRatio || 1;

    const canvasW = Math.max(maxLineW, 1);
    const canvasH = Math.max(totalH, 1);
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    lines.forEach((line, li) => {
      const oy = li * (ph + lineHeight * scale);
      [...line].forEach((ch, ci) => {
        const ox = ci * (pw + spacing * scale);
        const grid = characters[ch];
        if (!grid) return;
        for (let y = 0; y < gridH; y++) {
          for (let x = 0; x < gridW; x++) {
            if (grid[y]?.[x]) {
              ctx.fillStyle = fontColor;
              ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
            }
          }
        }
      });
    });
  }, [characters, previewText, gridW, gridH, fontColor, spacing, lineHeight]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  /* -- Canvas mouse handlers -- */
  const getCellFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = editorCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const cellSize = rect.width / gridW;
      const x = Math.floor((e.clientX - rect.left) / cellSize);
      const y = Math.floor((e.clientY - rect.top) / cellSize);
      if (x < 0 || x >= gridW || y < 0 || y >= gridH) return null;
      return { x, y };
    },
    [gridW, gridH]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cell = getCellFromEvent(e);
      if (!cell) return;
      const val = tool === "draw" ? true : false;
      // Toggle: if draw tool and pixel already on, turn off; else set to tool value
      const grid = characters[selectedChar];
      const currentVal = grid[cell.y]?.[cell.x] ?? false;
      const newVal = tool === "draw" ? !currentVal : false;
      setDrawValue(newVal);
      setIsDrawing(true);
      setPixel(cell.x, cell.y, newVal);
    },
    [getCellFromEvent, tool, characters, selectedChar, setPixel]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const cell = getCellFromEvent(e);
      if (!cell) return;
      setPixel(cell.x, cell.y, drawValue);
    },
    [isDrawing, getCellFromEvent, setPixel, drawValue]
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  useEffect(() => {
    const up = () => setIsDrawing(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  /* -- Export handlers -- */
  const exportAtlasPNG = useCallback(() => {
    const { canvas } = generateAtlas(characters, gridW, gridH, fontColor);
    const link = document.createElement("a");
    link.download = "pixel-font-atlas.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [characters, gridW, gridH, fontColor]);

  const exportMetadataJSON = useCallback(() => {
    const { meta } = generateAtlas(characters, gridW, gridH, fontColor);
    const blob = new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.download = "pixel-font-meta.json";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [characters, gridW, gridH, fontColor]);

  const copyMetadata = useCallback(() => {
    const { meta } = generateAtlas(characters, gridW, gridH, fontColor);
    navigator.clipboard.writeText(JSON.stringify(meta, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [characters, gridW, gridH, fontColor]);

  /* -- Character completed check -- */
  const isCharCompleted = useCallback(
    (ch: string) => {
      const grid = characters[ch];
      return grid ? !isGridEmpty(grid) : false;
    },
    [characters]
  );

  /* -- Character group rendering -- */
  const renderCharGroup = (label: string, chars: string) => (
    <div key={label}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5 px-0.5">
        {label}
      </div>
      <div className="flex flex-wrap gap-[3px]">
        {chars.split("").map((c) => {
          const active = c === selectedChar;
          const completed = isCharCompleted(c);
          const display = c === " " ? "SP" : c;
          return (
            <button
              key={c}
              onClick={() => setSelectedChar(c)}
              title={c === " " ? "Space" : c}
              className={`
                relative w-7 h-7 rounded text-[11px] font-mono font-medium
                flex items-center justify-center transition-all
                ${
                  active
                    ? "bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent)]/25"
                    : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                }
              `}
            >
              {display}
              {completed && !active && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between px-4 h-11 border-b border-[var(--border)] shrink-0 bg-[var(--background)]">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Back to tools"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Grid2X2 size={15} className="text-[var(--accent)]" />
            Pixel Font Builder
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={copyMetadata}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] transition-colors"
          >
            {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
            {copied ? "Copied" : "Copy Meta"}
          </button>
          <button
            onClick={exportMetadataJSON}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] transition-colors"
          >
            <Download size={13} />
            JSON
          </button>
          <button
            onClick={exportAtlasPNG}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
          >
            <Download size={13} />
            Atlas PNG
          </button>
        </div>
      </header>

      {/* ---- Body ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* ---- Left Sidebar: Character Selector ---- */}
        <aside className="w-56 border-r border-[var(--border)] bg-[var(--background)] overflow-y-auto shrink-0 p-3 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
            Characters
          </div>
          {renderCharGroup("Uppercase", UPPERCASE)}
          {renderCharGroup("Lowercase", LOWERCASE)}
          {renderCharGroup("Digits", DIGITS)}
          {renderCharGroup("Punctuation", PUNCTUATION)}
        </aside>

        {/* ---- Center: Pixel Editor ---- */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] shrink-0">
            <span className="text-xs text-[var(--muted)] mr-1 font-medium">
              Editing:
              <span className="text-[var(--foreground)] ml-1 font-bold text-sm">
                {selectedChar === " " ? "Space" : selectedChar}
              </span>
            </span>
            <div className="w-px h-4 bg-[var(--border)]" />

            <button
              onClick={() => setTool("draw")}
              title="Draw"
              className={`p-1.5 rounded transition-colors ${
                tool === "draw"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
              }`}
            >
              <Paintbrush size={14} />
            </button>
            <button
              onClick={() => setTool("erase")}
              title="Erase"
              className={`p-1.5 rounded transition-colors ${
                tool === "erase"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
              }`}
            >
              <Eraser size={14} />
            </button>

            <div className="w-px h-4 bg-[var(--border)]" />

            <button
              onClick={fillAll}
              title="Fill all"
              className="p-1.5 rounded text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
            >
              <Square size={14} />
            </button>
            <button
              onClick={clearAll}
              title="Clear all"
              className="p-1.5 rounded text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
            >
              <Trash2 size={14} />
            </button>

            <div className="w-px h-4 bg-[var(--border)]" />

            <button
              onClick={() => setMirror((v) => !v)}
              title="Mirror mode"
              className={`p-1.5 rounded transition-colors ${
                mirror
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
              }`}
            >
              <FlipHorizontal size={14} />
            </button>
          </div>

          {/* Canvas area */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center overflow-hidden p-4"
          >
            <canvas
              ref={editorCanvasRef}
              className="cursor-crosshair rounded-sm"
              style={{ imageRendering: "pixelated" }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </main>

        {/* ---- Right Sidebar: Settings + Preview ---- */}
        <aside className="w-64 border-l border-[var(--border)] bg-[var(--background)] overflow-y-auto shrink-0">
          {/* Grid Size */}
          <div className="border-b border-[var(--border)] p-3 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Grid Size
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GRID_PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => handlePresetChange(i)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    i === gridPreset
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Color */}
          <div className="border-b border-[var(--border)] p-3 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Font Color
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="color"
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                  className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer bg-transparent p-0"
                />
              </div>
              <input
                type="text"
                value={fontColor}
                onChange={(e) => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                    setFontColor(e.target.value);
                  }
                }}
                className="flex-1 px-2 py-1 rounded text-xs font-mono bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Spacing */}
          <div className="border-b border-[var(--border)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Character Spacing
              </div>
              <span className="text-[11px] font-mono text-[var(--foreground)]">{spacing}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          {/* Line Height */}
          <div className="border-b border-[var(--border)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Line Height Extra
              </div>
              <span className="text-[11px] font-mono text-[var(--foreground)]">{lineHeight}px</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          {/* Preview */}
          <div className="p-3 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Preview
            </div>
            <textarea
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              rows={2}
              placeholder="Type to preview..."
              className="w-full px-2 py-1.5 rounded text-xs font-mono bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] resize-none"
            />
            <div className="rounded bg-[var(--surface)] border border-[var(--border)] p-3 min-h-[60px] overflow-auto flex items-start justify-start">
              <canvas
                ref={previewCanvasRef}
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
