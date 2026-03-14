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

export default function GlyphCanvas({
  char,
  size = 600,
  initialStrokes = [],
  initialImage,
  onChange,
  readOnly = false,
}: GlyphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<StrokeData[]>(initialStrokes);
  const [currentStroke, setCurrentStroke] = useState<StrokeData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(6);
  const [activeBrush, setActiveBrush] = useState<BrushConfig>(BRUSHES[0]);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [bgImageLoaded, setBgImageLoaded] = useState(false);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  // Load background image once
  useEffect(() => {
    if (initialImage) {
      const img = new Image();
      img.onload = () => {
        bgImageRef.current = img;
        setBgImageLoaded(true);
      };
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

    // Draw bg image if loaded
    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, size, size);
    }

    drawGuides(ctx, size, char);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const stroke of allStrokes) {
      renderStroke(ctx, stroke);
    }
  }, [strokes, currentStroke, size, char, bgImageLoaded]);

  useEffect(() => { redraw(); }, [redraw]);
  useEffect(() => { setStrokes(initialStrokes); }, [initialStrokes]);

  function getPos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure || 0.5,
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (readOnly) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);

    if (tool === "eraser") {
      eraseAt(pos, strokes);
      return;
    }

    setCurrentStroke({
      points: [pos],
      width: brushSize,
      brushId: activeBrush.id,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDrawing || readOnly) return;
    const pos = getPos(e);

    if (tool === "eraser") {
      eraseAt(pos, strokes);
      return;
    }

    if (currentStroke) {
      setCurrentStroke({
        ...currentStroke,
        points: [...currentStroke.points, pos],
      });
    }
  }

  function eraseAt(pos: { x: number; y: number }, s: StrokeData[]) {
    const threshold = brushSize * 3;
    const newStrokes = s.filter((stroke) =>
      !stroke.points.some((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < threshold)
    );
    if (newStrokes.length !== s.length) {
      setStrokes(newStrokes);
    }
  }

  function handlePointerUp() {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "eraser") {
      emitChange(strokes);
      return;
    }

    if (currentStroke && currentStroke.points.length > 1) {
      const newStrokes = [...strokes, currentStroke];
      setStrokes(newStrokes);
      setCurrentStroke(null);
      emitChange(newStrokes);
    } else {
      setCurrentStroke(null);
    }
  }

  function emitChange(s: StrokeData[]) {
    if (!onChange) return;
    // Defer to next frame so canvas is up to date
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Render a clean preview without guides
      const previewCanvas = document.createElement("canvas");
      previewCanvas.width = size;
      previewCanvas.height = size;
      const pctx = previewCanvas.getContext("2d")!;
      pctx.fillStyle = "#ffffff";
      pctx.fillRect(0, 0, size, size);
      if (bgImageRef.current) {
        pctx.drawImage(bgImageRef.current, 0, 0, size, size);
      }
      for (const stroke of s) {
        renderStroke(pctx, stroke);
      }
      onChange(s, previewCanvas.toDataURL("image/png"));
    });
  }

  function handleClear() {
    setStrokes([]);
    setCurrentStroke(null);
    emitChange([]);
  }

  function handleUndo() {
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    emitChange(newStrokes);
  }

  const displaySize = Math.min(size / 2, 320);

  return (
    <div className="flex flex-col gap-3">
      {/* Brush selector */}
      {!readOnly && (
        <div className="flex items-center gap-1 flex-wrap">
          {BRUSHES.map((b) => (
            <button
              key={b.id}
              onClick={() => { setActiveBrush(b); setTool("brush"); }}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                tool === "brush" && activeBrush.id === b.id
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/40"
              }`}
            >
              {b.name}
            </button>
          ))}
          <div className="w-px h-5 bg-[var(--border)] mx-1" />
          <button
            onClick={() => setTool("eraser")}
            className={`px-2.5 py-1 text-xs rounded-md transition-all ${
              tool === "eraser"
                ? "bg-red-500 text-white"
                : "bg-[var(--surface)] border border-[var(--border)] hover:border-red-400/40"
            }`}
          >
            Eraser
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="border border-[var(--border)] rounded-xl cursor-crosshair touch-none shadow-sm"
        style={{ width: displaySize, height: displaySize }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <canvas ref={bgCanvasRef} className="hidden" />

      {!readOnly && (
        <div className="flex items-center gap-3 text-xs">
          <label className="text-[var(--muted)]">Size</label>
          <input
            type="range"
            min={1}
            max={30}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-24 accent-[var(--accent)]"
          />
          <span className="text-[var(--muted)] font-mono w-5">{brushSize}</span>
          <div className="flex-1" />
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="px-2.5 py-1 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-30"
          >
            Undo
          </button>
          <button
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="px-2.5 py-1 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-red-500 disabled:opacity-30"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

function drawGuides(ctx: CanvasRenderingContext2D, s: number, char: string) {
  ctx.save();
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);

  const lines = [
    { y: s * 0.15, color: "#dbeafe" },  // ascender
    { y: s * 0.25, color: "#e5e7eb" },  // cap height
    { y: s * 0.42, color: "#d1d5db" },  // x-height
    { y: s * 0.75, color: "#93c5fd" },  // baseline
    { y: s * 0.9, color: "#dbeafe" },   // descender
  ];

  for (const line of lines) {
    ctx.strokeStyle = line.color;
    ctx.beginPath();
    ctx.moveTo(0, line.y);
    ctx.lineTo(s, line.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = `${s * 0.08}px system-ui`;
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
        ctx.beginPath();
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = width * (0.8 + Math.random() * 0.4);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(
          points[0].x + (Math.random() - 0.5) * 1.5,
          points[0].y + (Math.random() - 0.5) * 1.5
        );
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(
            points[i].x + (Math.random() - 0.5) * 1.5,
            points[i].y + (Math.random() - 0.5) * 1.5
          );
        }
        ctx.stroke();
      }
      break;

    case "ink":
      ctx.globalAlpha = brush.opacity;
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      // Variable width based on speed/pressure
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const pressure = p.pressure ?? 0.5;
        const r = (width * 0.5) + (width * 0.8 * pressure);
        ctx.moveTo(p.x + r, p.y);
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      drawSmoothLine(ctx, points, width * 0.6, 1, "round");
      break;

    case "calligraphy": {
      ctx.globalAlpha = brush.opacity;
      ctx.fillStyle = "#0a0a0a";
      const angle = Math.PI / 4; // 45 degree nib
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const moveAngle = Math.atan2(dy, dx);
        const angleDiff = Math.abs(Math.sin(moveAngle - angle));
        const w = width * 0.3 + width * 0.7 * angleDiff;
        const nx = Math.cos(angle + Math.PI / 2) * w;
        const ny = Math.sin(angle + Math.PI / 2) * w;

        ctx.beginPath();
        ctx.moveTo(p1.x - nx, p1.y - ny);
        ctx.lineTo(p1.x + nx, p1.y + ny);
        ctx.lineTo(p2.x + nx, p2.y + ny);
        ctx.lineTo(p2.x - nx, p2.y - ny);
        ctx.closePath();
        ctx.fill();
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
      ctx.globalAlpha = brush.opacity;
      ctx.fillStyle = "#0a0a0a";
      for (const p of points) {
        const density = width * 2;
        for (let j = 0; j < density; j++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * width;
          const sx = p.x + Math.cos(angle) * radius;
          const sy = p.y + Math.sin(angle) * radius;
          const dotSize = Math.random() * 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, dotSize, 0, Math.PI * 2);
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
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const offset = (pass - 1) * 1.5;
        ctx.moveTo(points[0].x + offset, points[0].y + offset);
        for (let i = 1; i < points.length; i++) {
          const jitter = (Math.random() - 0.5) * 2;
          ctx.lineTo(points[i].x + offset + jitter, points[i].y + offset + jitter);
        }
        ctx.stroke();
      }
      break;
  }

  ctx.restore();
}

function drawSmoothLine(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  width: number,
  opacity: number,
  cap: CanvasLineCap
) {
  ctx.beginPath();
  ctx.strokeStyle = `rgba(10,10,10,${opacity})`;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.lineJoin = "round";
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
  }
  ctx.stroke();
}
