"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { BRUSHES, type BrushConfig, type StrokeData } from "@/lib/font-utils";

interface GlyphCanvasProps {
  char: string;
  size?: number;
  initialStrokes?: StrokeData[];
  initialImage?: string;
  onChange?: (strokes: StrokeData[], preview: string) => void;
  readOnly?: boolean;
}

// SVG icons for each brush
const BRUSH_ICONS: Record<string, React.ReactNode> = {
  pen: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
    </svg>
  ),
  pencil: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
    </svg>
  ),
  ink: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c0 0-8 9.5-8 13a8 8 0 0 0 16 0c0-3.5-8-13-8-13z" />
    </svg>
  ),
  calligraphy: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 20h12" /><path d="M12 4v12" /><path d="M8 4h8" /><path d="M10 4v4" /><path d="M14 4v4" />
    </svg>
  ),
  marker: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l-6 6v3h9l3-3" /><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </svg>
  ),
  finetip: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" /><path d="M8 6l4-4 4 4" />
    </svg>
  ),
  spray: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 5-6 3.51 0 4.97 3.28 5 6 .03 2.5-1 3.5-1 5.62V16" />
      <rect x="3" y="16" width="10" height="6" rx="1" /><circle cx="18" cy="4" r="1" /><circle cx="20" cy="8" r="1" /><circle cx="17" cy="10" r="1" />
    </svg>
  ),
  rough: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20c2-4 6-12 8-14s4-2 6 0" /><path d="M6 18c2-3 4-8 6-10s3-2 5 0" />
    </svg>
  ),
};

export default function GlyphCanvas({
  char,
  size = 600,
  initialStrokes = [],
  initialImage,
  onChange,
  readOnly = false,
}: GlyphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<StrokeData[]>(initialStrokes);
  const [currentStroke, setCurrentStroke] = useState<StrokeData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(6);
  const [activeBrush, setActiveBrush] = useState<BrushConfig>(BRUSHES[0]);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [showBrushMenu, setShowBrushMenu] = useState(false);
  const [bgImageLoaded, setBgImageLoaded] = useState(false);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const brushMenuRef = useRef<HTMLDivElement>(null);

  // Close brush menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (brushMenuRef.current && !brushMenuRef.current.contains(e.target as Node)) {
        setShowBrushMenu(false);
      }
    }
    if (showBrushMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showBrushMenu]);

  useEffect(() => {
    if (initialImage) {
      const img = new Image();
      img.onload = () => { bgImageRef.current = img; setBgImageLoaded(true); };
      img.src = initialImage;
    } else {
      bgImageRef.current = null;
      setBgImageLoaded(false);
    }
  }, [initialImage]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    if (bgImageRef.current) ctx.drawImage(bgImageRef.current, 0, 0, size, size);

    drawGuides(ctx, size, char);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const stroke of allStrokes) renderStroke(ctx, stroke);
  }, [strokes, currentStroke, size, char, bgImageLoaded]);

  useEffect(() => { redraw(); }, [redraw]);
  useEffect(() => { setStrokes(initialStrokes); }, [initialStrokes]);

  function getPos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (size / rect.width),
      y: (e.clientY - rect.top) * (size / rect.height),
      pressure: e.pressure || 0.5,
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (readOnly) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    if (tool === "eraser") { eraseAt(pos, strokes); return; }
    setCurrentStroke({ points: [pos], width: brushSize, brushId: activeBrush.id });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDrawing || readOnly) return;
    const pos = getPos(e);
    if (tool === "eraser") { eraseAt(pos, strokes); return; }
    if (currentStroke) setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, pos] });
  }

  function eraseAt(pos: { x: number; y: number }, s: StrokeData[]) {
    const t = brushSize * 3;
    const newStrokes = s.filter((stroke) => !stroke.points.some((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < t));
    if (newStrokes.length !== s.length) setStrokes(newStrokes);
  }

  function handlePointerUp() {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (tool === "eraser") { emitChange(strokes); return; }
    if (currentStroke && currentStroke.points.length > 1) {
      const ns = [...strokes, currentStroke];
      setStrokes(ns);
      setCurrentStroke(null);
      emitChange(ns);
    } else {
      setCurrentStroke(null);
    }
  }

  function emitChange(s: StrokeData[]) {
    if (!onChange) return;
    requestAnimationFrame(() => {
      const pc = document.createElement("canvas");
      pc.width = size; pc.height = size;
      const pctx = pc.getContext("2d")!;
      pctx.fillStyle = "#ffffff";
      pctx.fillRect(0, 0, size, size);
      if (bgImageRef.current) pctx.drawImage(bgImageRef.current, 0, 0, size, size);
      for (const stroke of s) renderStroke(pctx, stroke);
      onChange(s, pc.toDataURL("image/png"));
    });
  }

  function handleClear() { setStrokes([]); setCurrentStroke(null); emitChange([]); }
  function handleUndo() { const ns = strokes.slice(0, -1); setStrokes(ns); emitChange(ns); }

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-1.5 p-2 bg-[var(--surface)] border border-[var(--border)] border-b-0 rounded-t-xl">
          {/* Brush picker */}
          <div className="relative" ref={brushMenuRef}>
            <button
              onClick={() => setShowBrushMenu(!showBrushMenu)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                tool === "brush"
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30"
                  : "bg-[var(--background)] border border-[var(--border)] hover:border-[var(--accent)]/30"
              }`}
            >
              <span className="opacity-80">{BRUSH_ICONS[activeBrush.id]}</span>
              <span>{activeBrush.name}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-40">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {showBrushMenu && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                {BRUSHES.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setActiveBrush(b); setTool("brush"); setShowBrushMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                      activeBrush.id === b.id && tool === "brush"
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <span className="opacity-70 flex-shrink-0">{BRUSH_ICONS[b.id]}</span>
                    <span className="flex-1">{b.name}</span>
                    {b.pressureSensitive && (
                      <span className="text-[9px] text-[var(--muted)] bg-[var(--background)] px-1 py-0.5 rounded">pressure</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Eraser */}
          <button
            onClick={() => setTool(tool === "eraser" ? "brush" : "eraser")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
              tool === "eraser"
                ? "bg-red-500/10 text-red-500 border border-red-500/30"
                : "bg-[var(--background)] border border-[var(--border)] hover:border-red-400/30"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
              <path d="M22 21H7" /><path d="m5 11 9 9" />
            </svg>
            <span>Eraser</span>
          </button>

          <div className="w-px h-6 bg-[var(--border)]" />

          {/* Size */}
          <div className="flex items-center gap-1.5 px-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--muted)]">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
            </svg>
            <input type="range" min={1} max={30} value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20 accent-[var(--accent)]" />
            <span className="text-[11px] text-[var(--muted)] font-mono w-4">{brushSize}</span>
          </div>

          <div className="flex-1" />

          {/* Undo / Clear */}
          <button onClick={handleUndo} disabled={strokes.length === 0}
            className="p-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-20 transition-opacity"
            title="Undo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>
          <button onClick={handleClear} disabled={strokes.length === 0}
            className="p-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-red-400 disabled:opacity-20 transition-opacity"
            title="Clear all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className={`border border-[var(--border)] touch-none shadow-sm bg-white ${
          readOnly ? "rounded-xl" : "rounded-b-xl"
        } ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}
        style={{ width: 340, height: 340 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}

function drawGuides(ctx: CanvasRenderingContext2D, s: number, char: string) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);

  const lines = [
    { y: s * 0.15, color: "rgba(147,197,253,0.4)", label: "ascender" },
    { y: s * 0.25, color: "rgba(209,213,219,0.5)", label: "cap" },
    { y: s * 0.42, color: "rgba(209,213,219,0.6)", label: "x-height" },
    { y: s * 0.75, color: "rgba(147,197,253,0.5)", label: "baseline" },
    { y: s * 0.9, color: "rgba(147,197,253,0.3)", label: "descender" },
  ];

  for (const line of lines) {
    ctx.strokeStyle = line.color;
    ctx.beginPath();
    ctx.moveTo(0, line.y);
    ctx.lineTo(s, line.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(209,213,219,0.5)";
  ctx.font = `${s * 0.07}px system-ui`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(char, s - 12, s - 12);
  ctx.restore();
}

function renderStroke(ctx: CanvasRenderingContext2D, stroke: StrokeData) {
  const brush = BRUSHES.find((b) => b.id === stroke.brushId) || BRUSHES[0];
  const { points, width } = stroke;
  if (points.length < 2) return;
  ctx.save();

  switch (brush.texture) {
    case "solid":
      drawSmoothLine(ctx, points, width, brush.opacity, "round");
      break;
    case "pencil":
      ctx.globalAlpha = brush.opacity;
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath(); ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = width * (0.8 + Math.random() * 0.4);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.moveTo(points[0].x + (Math.random() - 0.5) * 1.5, points[0].y + (Math.random() - 0.5) * 1.5);
        for (let i = 1; i < points.length; i++)
          ctx.lineTo(points[i].x + (Math.random() - 0.5) * 1.5, points[i].y + (Math.random() - 0.5) * 1.5);
        ctx.stroke();
      }
      break;
    case "ink":
      ctx.globalAlpha = brush.opacity; ctx.fillStyle = "#0a0a0a"; ctx.beginPath();
      for (const p of points) {
        const pr = p.pressure ?? 0.5;
        const r = width * 0.5 + width * 0.8 * pr;
        ctx.moveTo(p.x + r, p.y); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      drawSmoothLine(ctx, points, width * 0.6, 1, "round");
      break;
    case "calligraphy": {
      ctx.globalAlpha = brush.opacity; ctx.fillStyle = "#0a0a0a";
      const angle = Math.PI / 4;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i], p2 = points[i + 1];
        const ma = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const ad = Math.abs(Math.sin(ma - angle));
        const w = width * 0.3 + width * 0.7 * ad;
        const nx = Math.cos(angle + Math.PI / 2) * w, ny = Math.sin(angle + Math.PI / 2) * w;
        ctx.beginPath();
        ctx.moveTo(p1.x - nx, p1.y - ny); ctx.lineTo(p1.x + nx, p1.y + ny);
        ctx.lineTo(p2.x + nx, p2.y + ny); ctx.lineTo(p2.x - nx, p2.y - ny);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case "marker":
      ctx.globalAlpha = brush.opacity * 0.6;
      drawSmoothLine(ctx, points, width * 1.5, 1, "square");
      ctx.globalAlpha = brush.opacity * 0.4;
      drawSmoothLine(ctx, points, width * 0.8, 1, "round");
      break;
    case "spray":
      ctx.globalAlpha = brush.opacity; ctx.fillStyle = "#0a0a0a";
      for (const p of points) {
        for (let j = 0; j < width * 2; j++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * width;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, Math.random() * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case "rough":
      ctx.globalAlpha = brush.opacity;
      for (let pass = 0; pass < 3; pass++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(10,10,10,${0.3 + pass * 0.2})`;
        ctx.lineWidth = width * (0.5 + pass * 0.3);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        const o = (pass - 1) * 1.5;
        ctx.moveTo(points[0].x + o, points[0].y + o);
        for (let i = 1; i < points.length; i++)
          ctx.lineTo(points[i].x + o + (Math.random() - 0.5) * 2, points[i].y + o + (Math.random() - 0.5) * 2);
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
}

function drawSmoothLine(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], width: number, opacity: number, cap: CanvasLineCap) {
  ctx.beginPath(); ctx.strokeStyle = `rgba(10,10,10,${opacity})`;
  ctx.lineWidth = width; ctx.lineCap = cap; ctx.lineJoin = "round";
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1], c = points[i];
    ctx.quadraticCurveTo(p.x, p.y, (p.x + c.x) / 2, (p.y + c.y) / 2);
  }
  ctx.stroke();
}
