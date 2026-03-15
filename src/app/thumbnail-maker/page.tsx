"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ImagePlus,
  Download,
  Upload,
  Type,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Move,
  Sun,
  GripVertical,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SizePreset {
  label: string;
  w: number;
  h: number;
}

interface TextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  bold: boolean;
  italic: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PRESETS: SizePreset[] = [
  { label: "YouTube", w: 1280, h: 720 },
  { label: "Instagram", w: 1080, h: 1080 },
  { label: "Twitter", w: 1200, h: 675 },
  { label: "Facebook", w: 1200, h: 630 },
  { label: "Pinterest", w: 1000, h: 1500 },
  { label: "TikTok", w: 1080, h: 1920 },
];

const FONTS = ["Impact", "Arial", "Helvetica", "Georgia", "Courier New", "Comic Sans MS", "system-ui"];

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function defaultTextBox(): TextBox {
  return {
    id: uid(),
    text: "Your Text",
    x: 50,
    y: 50,
    fontSize: 64,
    fontFamily: "Impact",
    color: "#ffffff",
    strokeEnabled: true,
    strokeColor: "#000000",
    strokeWidth: 4,
    shadowEnabled: true,
    shadowColor: "#000000",
    shadowBlur: 8,
    bold: false,
    italic: false,
  };
}

// ── Safe-zone data (percentage insets from edges) ────────────────────────────

const SAFE_ZONES: Record<string, { top: number; bottom: number; right: number; left: number; label: string }> = {
  YouTube: { top: 0, bottom: 0.18, right: 0.28, left: 0, label: "Duration badge + recommendations" },
  Instagram: { top: 0.08, bottom: 0.12, right: 0, left: 0, label: "Username & icons" },
  Twitter: { top: 0, bottom: 0, right: 0, left: 0, label: "" },
  Facebook: { top: 0, bottom: 0, right: 0, left: 0, label: "" },
  Pinterest: { top: 0.05, bottom: 0.12, right: 0, left: 0, label: "Save button area" },
  TikTok: { top: 0.1, bottom: 0.2, right: 0.15, left: 0, label: "UI overlay area" },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function ThumbnailMakerPage() {
  const [preset, setPreset] = useState<SizePreset>(PRESETS[0]);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [dimming, setDimming] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([defaultTextBox()]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = textBoxes.find((t) => t.id === selectedId) ?? null;

  // ── Upload background ──────────────────────────────────────────────────────

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setBgImage(img);
      setBgUrl(url);
    };
    img.src = url;
  }, []);

  // ── Draw canvas ────────────────────────────────────────────────────────────

  const draw = useCallback(
    (exportMode = false) => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext("2d")!;
      cvs.width = preset.w;
      cvs.height = preset.h;

      // Background
      if (bgImage) {
        const scale = Math.max(preset.w / bgImage.width, preset.h / bgImage.height);
        const sw = bgImage.width * scale;
        const sh = bgImage.height * scale;
        ctx.filter = `brightness(${brightness}%)`;
        ctx.drawImage(bgImage, (preset.w - sw) / 2, (preset.h - sh) / 2, sw, sh);
        ctx.filter = "none";
      } else {
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, preset.w, preset.h);
      }

      // Dimming overlay
      if (dimming > 0) {
        ctx.fillStyle = `rgba(0,0,0,${dimming / 100})`;
        ctx.fillRect(0, 0, preset.w, preset.h);
      }

      // Text boxes
      for (const tb of textBoxes) {
        ctx.save();
        const style = `${tb.italic ? "italic " : ""}${tb.bold ? "bold " : ""}${tb.fontSize}px "${tb.fontFamily}"`;
        ctx.font = style;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const tx = (tb.x / 100) * preset.w;
        const ty = (tb.y / 100) * preset.h;

        if (tb.shadowEnabled) {
          ctx.shadowColor = tb.shadowColor;
          ctx.shadowBlur = tb.shadowBlur;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }

        if (tb.strokeEnabled) {
          ctx.strokeStyle = tb.strokeColor;
          ctx.lineWidth = tb.strokeWidth;
          ctx.lineJoin = "round";
          ctx.miterLimit = 2;
          ctx.strokeText(tb.text, tx, ty);
        }

        ctx.shadowColor = "transparent";
        ctx.fillStyle = tb.color;
        ctx.fillText(tb.text, tx, ty);
        ctx.restore();
      }

      // Safe zone overlay (preview only)
      if (showSafeZone && !exportMode) {
        const sz = SAFE_ZONES[preset.label];
        if (sz && (sz.top > 0 || sz.bottom > 0 || sz.left > 0 || sz.right > 0)) {
          ctx.fillStyle = "rgba(255,0,0,0.15)";
          if (sz.top > 0) ctx.fillRect(0, 0, preset.w, preset.h * sz.top);
          if (sz.bottom > 0) ctx.fillRect(0, preset.h * (1 - sz.bottom), preset.w, preset.h * sz.bottom);
          if (sz.right > 0) ctx.fillRect(preset.w * (1 - sz.right), 0, preset.w * sz.right, preset.h);
          if (sz.left > 0) ctx.fillRect(0, 0, preset.w * sz.left, preset.h);

          ctx.strokeStyle = "rgba(255,0,0,0.5)";
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 4]);
          ctx.strokeRect(
            preset.w * sz.left,
            preset.h * sz.top,
            preset.w * (1 - sz.left - sz.right),
            preset.h * (1 - sz.top - sz.bottom)
          );
          ctx.setLineDash([]);

          // Label
          if (sz.label) {
            ctx.font = `${Math.max(14, preset.w * 0.014)}px system-ui`;
            ctx.fillStyle = "rgba(255,0,0,0.8)";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(`Safe zone: ${sz.label}`, preset.w * sz.left + 8, preset.h * sz.top + 6);
          }
        }
      }

      // Selected text indicator (preview only)
      if (selectedId && !exportMode) {
        const tb = textBoxes.find((t) => t.id === selectedId);
        if (tb) {
          const tx = (tb.x / 100) * preset.w;
          const ty = (tb.y / 100) * preset.h;
          ctx.save();
          ctx.font = `${tb.italic ? "italic " : ""}${tb.bold ? "bold " : ""}${tb.fontSize}px "${tb.fontFamily}"`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const metrics = ctx.measureText(tb.text);
          const tw = metrics.width + 20;
          const th = tb.fontSize * 1.3;
          ctx.strokeStyle = "var(--accent, #6366f1)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(tx - tw / 2, ty - th / 2, tw, th);
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    },
    [bgImage, preset, dimming, brightness, textBoxes, showSafeZone, selectedId]
  );

  useEffect(() => {
    draw();
  }, [draw]);

  // ── Drag handling ──────────────────────────────────────────────────────────

  const getCanvasPercent = useCallback(
    (e: React.MouseEvent) => {
      const cvs = canvasRef.current;
      if (!cvs) return { px: 0, py: 0 };
      const rect = cvs.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      return { px, py };
    },
    []
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const { px, py } = getCanvasPercent(e);
      // Find closest text box to click
      let closest: TextBox | null = null;
      let closestDist = Infinity;
      for (const tb of textBoxes) {
        const dx = tb.x - px;
        const dy = tb.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 10 && dist < closestDist) {
          closest = tb;
          closestDist = dist;
        }
      }
      if (closest) {
        setSelectedId(closest.id);
        setDragging(closest.id);
        setDragOffset({ x: px - closest.x, y: py - closest.y });
      } else {
        setSelectedId(null);
      }
    },
    [textBoxes, getCanvasPercent]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const { px, py } = getCanvasPercent(e);
      setTextBoxes((prev) =>
        prev.map((tb) =>
          tb.id === dragging
            ? { ...tb, x: Math.max(0, Math.min(100, px - dragOffset.x)), y: Math.max(0, Math.min(100, py - dragOffset.y)) }
            : tb
        )
      );
    },
    [dragging, dragOffset, getCanvasPercent]
  );

  const handleCanvasMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // ── Text box CRUD ──────────────────────────────────────────────────────────

  const updateSelected = useCallback(
    (patch: Partial<TextBox>) => {
      if (!selectedId) return;
      setTextBoxes((prev) => prev.map((tb) => (tb.id === selectedId ? { ...tb, ...patch } : tb)));
    },
    [selectedId]
  );

  const addTextBox = useCallback(() => {
    const nb = defaultTextBox();
    nb.y = 30 + Math.random() * 40;
    setTextBoxes((prev) => [...prev, nb]);
    setSelectedId(nb.id);
  }, []);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setTextBoxes((prev) => prev.filter((tb) => tb.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    draw(true);
    const cvs = canvasRef.current;
    if (!cvs) return;
    const link = document.createElement("a");
    link.download = `thumbnail-${preset.label.toLowerCase()}-${preset.w}x${preset.h}.png`;
    link.href = cvs.toDataURL("image/png");
    link.click();
    // Redraw with overlays
    setTimeout(() => draw(), 50);
  }, [draw, preset]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <Link href="/" className="p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors" aria-label="Back to home">
          <ArrowLeft size={20} />
        </Link>
        <ImagePlus size={20} className="text-[var(--accent)]" />
        <h1 className="text-base font-semibold">Thumbnail Maker</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowSafeZone((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            title="Toggle safe zone overlay"
          >
            {showSafeZone ? <Eye size={14} /> : <EyeOff size={14} />}
            Safe Zone
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Download size={14} />
            Export PNG
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto p-4 space-y-5">
          {/* Preset picker */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Size Preset</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPreset(p)}
                  className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                    preset.label === p.label
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {p.label}
                  <span className="block text-[10px] text-[var(--muted)]">
                    {p.w}x{p.h}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Background */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Background</h2>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg border border-dashed border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Upload size={14} />
              {bgImage ? "Replace Image" : "Upload Image"}
            </button>
            <label className="flex items-center justify-between mt-3 text-xs">
              <span className="flex items-center gap-1.5">
                <Sun size={12} /> Brightness
              </span>
              <span className="text-[var(--muted)]">{brightness}%</span>
            </label>
            <input
              type="range"
              min={20}
              max={200}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-full mt-1 accent-[var(--accent)]"
            />
            <label className="flex items-center justify-between mt-3 text-xs">
              <span>Dimming</span>
              <span className="text-[var(--muted)]">{dimming}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={90}
              value={dimming}
              onChange={(e) => setDimming(Number(e.target.value))}
              className="w-full mt-1 accent-[var(--accent)]"
            />
          </section>

          {/* Text boxes list */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Text Layers</h2>
              <button onClick={addTextBox} className="p-1 rounded hover:bg-[var(--surface-hover)]" title="Add text">
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-1">
              {textBoxes.map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setSelectedId(tb.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg border transition-colors text-left ${
                    selectedId === tb.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <GripVertical size={12} className="text-[var(--muted)] shrink-0" />
                  <Type size={12} className="shrink-0" />
                  <span className="truncate flex-1">{tb.text || "Empty"}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Selected text controls */}
          {selected && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Edit Text</h2>
                <button onClick={removeSelected} className="p-1 rounded hover:bg-red-500/20 text-red-400" title="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
              <input
                type="text"
                value={selected.text}
                onChange={(e) => updateSelected({ text: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="Text..."
              />

              {/* Font family */}
              <select
                value={selected.fontFamily}
                onChange={(e) => updateSelected({ fontFamily: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)]"
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              {/* Font size */}
              <label className="flex items-center justify-between text-xs">
                <span>Size</span>
                <span className="text-[var(--muted)]">{selected.fontSize}px</span>
              </label>
              <input
                type="range"
                min={12}
                max={200}
                value={selected.fontSize}
                onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
                className="w-full accent-[var(--accent)]"
              />

              {/* Color */}
              <div className="flex items-center gap-2">
                <label className="text-xs flex-1">Color</label>
                <input
                  type="color"
                  value={selected.color}
                  onChange={(e) => updateSelected({ color: e.target.value })}
                  className="w-8 h-6 rounded border border-[var(--border)] cursor-pointer"
                />
              </div>

              {/* Bold / Italic */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => updateSelected({ bold: !selected.bold })}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg border transition-colors ${
                    selected.bold ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  B
                </button>
                <button
                  onClick={() => updateSelected({ italic: !selected.italic })}
                  className={`flex-1 py-1 text-xs italic rounded-lg border transition-colors ${
                    selected.italic ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  I
                </button>
              </div>

              {/* Stroke */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selected.strokeEnabled}
                    onChange={(e) => updateSelected({ strokeEnabled: e.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  Stroke
                  <input
                    type="color"
                    value={selected.strokeColor}
                    onChange={(e) => updateSelected({ strokeColor: e.target.value })}
                    className="w-6 h-5 ml-auto rounded border border-[var(--border)] cursor-pointer"
                  />
                </label>
                {selected.strokeEnabled && (
                  <input
                    type="range"
                    min={1}
                    max={16}
                    value={selected.strokeWidth}
                    onChange={(e) => updateSelected({ strokeWidth: Number(e.target.value) })}
                    className="w-full accent-[var(--accent)]"
                  />
                )}
              </div>

              {/* Shadow */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selected.shadowEnabled}
                    onChange={(e) => updateSelected({ shadowEnabled: e.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  Shadow
                  <input
                    type="color"
                    value={selected.shadowColor}
                    onChange={(e) => updateSelected({ shadowColor: e.target.value })}
                    className="w-6 h-5 ml-auto rounded border border-[var(--border)] cursor-pointer"
                  />
                </label>
                {selected.shadowEnabled && (
                  <>
                    <label className="flex items-center justify-between text-xs">
                      <span>Blur</span>
                      <span className="text-[var(--muted)]">{selected.shadowBlur}px</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={selected.shadowBlur}
                      onChange={(e) => updateSelected({ shadowBlur: Number(e.target.value) })}
                      className="w-full accent-[var(--accent)]"
                    />
                  </>
                )}
              </div>

              {/* Position sliders */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-medium flex items-center gap-1.5">
                  <Move size={12} /> Position
                </h3>
                <label className="flex items-center justify-between text-xs">
                  <span>X</span>
                  <span className="text-[var(--muted)]">{selected.x.toFixed(0)}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selected.x}
                  onChange={(e) => updateSelected({ x: Number(e.target.value) })}
                  className="w-full accent-[var(--accent)]"
                />
                <label className="flex items-center justify-between text-xs">
                  <span>Y</span>
                  <span className="text-[var(--muted)]">{selected.y.toFixed(0)}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selected.y}
                  onChange={(e) => updateSelected({ y: Number(e.target.value) })}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            </section>
          )}
        </aside>

        {/* ── Canvas area ──────────────────────────────────────────────────── */}
        <main className="flex-1 flex items-center justify-center p-6 overflow-auto bg-[var(--background)]" ref={previewRef}>
          <div className="relative" style={{ maxWidth: "100%", maxHeight: "100%" }}>
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[calc(100vh-80px)] rounded-lg shadow-lg border border-[var(--border)]"
              style={{ cursor: dragging ? "grabbing" : "grab", objectFit: "contain" }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
            <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-[10px] font-mono pointer-events-none">
              {preset.w} x {preset.h} &mdash; {preset.label}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
