"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface DetectedRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  userLabel: string;
  croppedImage: string;
}

interface ImageExtractorProps {
  onExtract: (glyphs: { char: string; imageData: string }[]) => void;
  onClose: () => void;
}

type Mode = "idle" | "drawing";

export default function ImageExtractor({ onExtract, onClose }: ImageExtractorProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(128);
  const [minSize, setMinSize] = useState(8);
  const [regions, setRegions] = useState<DetectedRegion[]>([]);
  const [step, setStep] = useState<"upload" | "edit">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [drawMode, setDrawMode] = useState<Mode>("idle");
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);

  // Load image into Image object
  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });
  }, []);

  // Render image + boxes to canvas
  const renderCanvas = useCallback((
    img: HTMLImageElement,
    rects: DetectedRegion[],
    tempRect?: { x: number; y: number; w: number; h: number } | null,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxW = 700;
    const scale = Math.min(1, maxW / img.width);
    scaleRef.current = scale;
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw existing boxes
    ctx.lineWidth = 2;
    ctx.font = "bold 11px system-ui";
    rects.forEach((r, i) => {
      const color = r.userLabel ? "#22c55e" : "#3b82f6";
      ctx.strokeStyle = color;
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      const label = r.userLabel || `#${i + 1}`;
      const tw = ctx.measureText(label).width + 6;
      ctx.fillStyle = color;
      ctx.fillRect(r.x, r.y - 16, tw, 16);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, r.x + 3, r.y - 4);
    });

    // Draw temp rect while user is dragging
    if (tempRect) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.strokeRect(tempRect.x, tempRect.y, tempRect.w, tempRect.h);
      ctx.setLineDash([]);
    }
  }, []);

  // Handle image upload
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setImageSrc(dataUrl);
      const img = await loadImage(dataUrl);
      imageObjRef.current = img;
      setStep("edit");
      setRegions([]);
      setTimeout(() => renderCanvas(img, []), 50);
    };
    reader.readAsDataURL(file);
  }, [loadImage, renderCanvas]);

  // Re-render whenever regions change
  useEffect(() => {
    if (imageObjRef.current && step === "edit") {
      renderCanvas(imageObjRef.current, regions);
    }
  }, [regions, step, renderCanvas]);

  // Re-render image when step changes to edit (fixes re-detect issue)
  useEffect(() => {
    if (step === "edit" && imageSrc && !imageObjRef.current) {
      loadImage(imageSrc).then((img) => {
        imageObjRef.current = img;
        renderCanvas(img, regions);
      });
    }
  }, [step, imageSrc, loadImage, renderCanvas, regions]);

  // Crop a region from the image
  function cropRegion(img: HTMLImageElement, r: { x: number; y: number; w: number; h: number }, scale: number): string {
    const pad = 8;
    const cropSize = Math.max(r.w, r.h) + pad * 2;
    const c = document.createElement("canvas");
    c.width = cropSize;
    c.height = cropSize;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cropSize, cropSize);
    const ox = (cropSize - r.w) / 2;
    const oy = (cropSize - r.h) / 2;
    ctx.drawImage(img, r.x / scale, r.y / scale, r.w / scale, r.h / scale, ox, oy, r.w, r.h);
    return c.toDataURL("image/png");
  }

  // Auto-detect
  const detectRegions = useCallback(() => {
    const img = imageObjRef.current;
    if (!img) return;
    setIsProcessing(true);

    // Use setTimeout to not block UI
    setTimeout(() => {
      const scale = scaleRef.current;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const work = document.createElement("canvas");
      work.width = w;
      work.height = h;
      const ctx = work.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const { data } = imgData;

      // Binarize
      const binary = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        const avg = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        binary[i] = avg < threshold ? 1 : 0;
      }

      // Connected component labeling
      const labels = new Int32Array(w * h);
      let nextLabel = 1;
      const boundsMap = new Map<number, { minX: number; minY: number; maxX: number; maxY: number; area: number }>();

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const pi = y * w + x;
          if (!binary[pi] || labels[pi] !== 0) continue;

          const label = nextLabel++;
          const stack = [x, y];
          let bMinX = x, bMinY = y, bMaxX = x, bMaxY = y, area = 0;

          while (stack.length > 0) {
            const sy = stack.pop()!;
            const sx = stack.pop()!;
            if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
            const si = sy * w + sx;
            if (!binary[si] || labels[si] !== 0) continue;

            labels[si] = label;
            area++;
            if (sx < bMinX) bMinX = sx;
            if (sy < bMinY) bMinY = sy;
            if (sx > bMaxX) bMaxX = sx;
            if (sy > bMaxY) bMaxY = sy;

            stack.push(sx + 1, sy, sx - 1, sy, sx, sy + 1, sx, sy - 1);
          }

          boundsMap.set(label, { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY, area });
        }
      }

      // Filter
      const maxDim = Math.min(w, h) * 0.85;
      const rects: { x: number; y: number; w: number; h: number }[] = [];

      for (const [, b] of boundsMap) {
        const bw = b.maxX - b.minX;
        const bh = b.maxY - b.minY;
        if (bw >= minSize && bh >= minSize && bw <= maxDim && bh <= maxDim && b.area >= minSize * 2) {
          rects.push({
            x: Math.max(0, b.minX - 4),
            y: Math.max(0, b.minY - 4),
            w: Math.min(w - b.minX + 4, bw + 8),
            h: Math.min(h - b.minY + 4, bh + 8),
          });
        }
      }

      // Merge overlapping
      const merged = mergeOverlapping(rects);

      // Sort reading order
      merged.sort((a, b) => {
        const rowA = Math.floor(a.y / (h * 0.08));
        const rowB = Math.floor(b.y / (h * 0.08));
        if (rowA !== rowB) return rowA - rowB;
        return a.x - b.x;
      });

      // Auto-label
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

      const detected: DetectedRegion[] = merged.map((r, i) => ({
        ...r,
        userLabel: i < chars.length ? chars[i] : "",
        croppedImage: cropRegion(img, r, scale),
      }));

      setRegions(detected);
      setIsProcessing(false);
    }, 20);
  }, [threshold, minSize]);

  function mergeOverlapping(rects: { x: number; y: number; w: number; h: number }[]) {
    const m = rects.map((r) => ({ ...r }));
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < m.length; i++) {
        for (let j = i + 1; j < m.length; j++) {
          const a = m[i], b = m[j];
          const gap = 3;
          if (a.x - gap < b.x + b.w && a.x + a.w + gap > b.x && a.y - gap < b.y + b.h && a.y + a.h + gap > b.y) {
            const nx = Math.min(a.x, b.x), ny = Math.min(a.y, b.y);
            m[i] = { x: nx, y: ny, w: Math.max(a.x + a.w, b.x + b.w) - nx, h: Math.max(a.y + a.h, b.y + b.h) - ny };
            m.splice(j, 1);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
    return m;
  }

  // Manual bounding box drawing
  function getCanvasPos(e: React.MouseEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (drawMode !== "drawing") return;
    setDrawStart(getCanvasPos(e));
    setDrawCurrent(null);
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (drawMode !== "drawing" || !drawStart) return;
    const pos = getCanvasPos(e);
    setDrawCurrent(pos);

    if (imageObjRef.current) {
      const tempRect = {
        x: Math.min(drawStart.x, pos.x),
        y: Math.min(drawStart.y, pos.y),
        w: Math.abs(pos.x - drawStart.x),
        h: Math.abs(pos.y - drawStart.y),
      };
      renderCanvas(imageObjRef.current, regions, tempRect);
    }
  }

  function handleCanvasMouseUp() {
    if (drawMode !== "drawing" || !drawStart || !drawCurrent) {
      setDrawStart(null);
      return;
    }

    const img = imageObjRef.current;
    if (!img) return;

    const r = {
      x: Math.min(drawStart.x, drawCurrent.x),
      y: Math.min(drawStart.y, drawCurrent.y),
      w: Math.abs(drawCurrent.x - drawStart.x),
      h: Math.abs(drawCurrent.y - drawStart.y),
    };

    if (r.w > 5 && r.h > 5) {
      const newRegion: DetectedRegion = {
        ...r,
        userLabel: "",
        croppedImage: cropRegion(img, r, scaleRef.current),
      };
      setRegions((prev) => [...prev, newRegion]);
    }

    setDrawStart(null);
    setDrawCurrent(null);
    setDrawMode("idle");
  }

  function handleLabelChange(idx: number, value: string) {
    setRegions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], userLabel: value };
      return next;
    });
  }

  function handleRemoveRegion(idx: number) {
    setRegions((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleExtract() {
    const glyphs = regions
      .filter((r) => r.userLabel.trim())
      .map((r) => ({ char: r.userLabel.trim(), imageData: r.croppedImage }));
    onExtract(glyphs);
  }

  const labeledCount = regions.filter((r) => r.userLabel.trim()).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Extract Glyphs from Image</h2>
            <p className="text-xs text-[var(--muted)]">
              {step === "upload"
                ? "Upload an image containing letters or glyphs"
                : `${regions.length} regions${labeledCount > 0 ? ` (${labeledCount} labeled)` : ""} — auto-detect or draw boxes manually`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center gap-6 py-20">
              <div className="w-20 h-20 rounded-2xl bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
              <p className="text-[var(--muted)] text-sm max-w-md text-center">
                Upload an image with handwritten or printed characters. Auto-detect bounding boxes or draw them manually.
              </p>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 bg-[var(--accent)] text-white rounded-xl hover:bg-[var(--accent-hover)] transition-colors font-medium">
                Choose Image
              </button>
            </div>
          )}

          {step === "edit" && (
            <div className="flex flex-col gap-4">
              {/* Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Auto detect controls */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] rounded-lg border border-[var(--border)]">
                  <label className="text-[11px] text-[var(--muted)]">Threshold</label>
                  <input type="range" min={30} max={240} value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))} className="w-20 accent-[var(--accent)]" />
                  <span className="text-[11px] font-mono w-6 text-[var(--muted)]">{threshold}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] rounded-lg border border-[var(--border)]">
                  <label className="text-[11px] text-[var(--muted)]">Min size</label>
                  <input type="range" min={3} max={60} value={minSize}
                    onChange={(e) => setMinSize(Number(e.target.value))} className="w-16 accent-[var(--accent)]" />
                  <span className="text-[11px] font-mono w-5 text-[var(--muted)]">{minSize}</span>
                </div>

                <button onClick={detectRegions} disabled={isProcessing}
                  className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] font-medium disabled:opacity-50 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  {isProcessing ? "Detecting..." : "Auto Detect"}
                </button>

                <div className="w-px h-6 bg-[var(--border)]" />

                <button
                  onClick={() => setDrawMode(drawMode === "drawing" ? "idle" : "drawing")}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                    drawMode === "drawing"
                      ? "bg-amber-500 text-white"
                      : "border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
                  </svg>
                  {drawMode === "drawing" ? "Drawing Box..." : "Draw Box"}
                </button>

                {regions.length > 0 && (
                  <>
                    <div className="w-px h-6 bg-[var(--border)]" />
                    <button onClick={() => setRegions([])}
                      className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-red-500">
                      Clear All
                    </button>
                  </>
                )}
              </div>

              {/* Canvas */}
              <div className={`border rounded-xl overflow-auto max-h-[45vh] bg-white ${
                drawMode === "drawing" ? "border-amber-400 cursor-crosshair" : "border-[var(--border)]"
              }`}>
                <canvas
                  ref={canvasRef}
                  className="max-w-full"
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
              </div>

              {/* Region cards */}
              {regions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--muted)] font-medium">
                      {regions.length} regions detected
                    </span>
                    <span className="text-xs text-[var(--muted)]">{labeledCount} labeled</span>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5 max-h-[25vh] overflow-auto p-0.5">
                    {regions.map((region, idx) => (
                      <div key={idx}
                        className="flex flex-col items-center gap-0.5 p-1 border border-[var(--border)] rounded-lg bg-[var(--background)] group relative">
                        <button onClick={() => handleRemoveRegion(idx)}
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          &times;
                        </button>
                        <img src={region.croppedImage} alt={`#${idx + 1}`}
                          className="w-9 h-9 object-contain rounded bg-white" />
                        <input type="text" maxLength={1} value={region.userLabel}
                          onChange={(e) => handleLabelChange(idx, e.target.value)}
                          className="w-6 h-4 text-center text-[10px] border border-[var(--border)] rounded bg-[var(--surface)] focus:border-[var(--accent)] outline-none" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {regions.length === 0 && !isProcessing && (
                <div className="text-center py-6 text-[var(--muted)] text-sm">
                  Click &ldquo;Auto Detect&rdquo; to find glyphs, or use &ldquo;Draw Box&rdquo; to manually select regions.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "edit" && (
          <div className="flex justify-between items-center px-5 py-3 border-t border-[var(--border)] flex-shrink-0">
            <button onClick={() => { fileInputRef.current?.click(); }}
              className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]">
              Change Image
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]">
                Cancel
              </button>
              <button onClick={handleExtract} disabled={labeledCount === 0}
                className="px-5 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40 font-medium">
                Import {labeledCount} Glyph{labeledCount !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
