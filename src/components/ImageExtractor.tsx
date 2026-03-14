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

export default function ImageExtractor({ onExtract, onClose }: ImageExtractorProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(128);
  const [minSize, setMinSize] = useState(8);
  const [regions, setRegions] = useState<DetectedRegion[]>([]);
  const [step, setStep] = useState<"upload" | "edit">("upload");
  const [status, setStatus] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [showThresholdPreview, setShowThresholdPreview] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);

  // ── Load image ──
  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // ── Render canvas ──
  const renderCanvas = useCallback((
    img: HTMLImageElement,
    rects: DetectedRegion[],
    tempRect?: { x: number; y: number; w: number; h: number } | null,
    showBinary?: boolean,
    binaryThreshold?: number,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxW = 700;
    const scale = Math.min(1, maxW / img.width);
    scaleRef.current = scale;
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Show threshold preview overlay
    if (showBinary && binaryThreshold !== undefined) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (avg < binaryThreshold) {
          d[i] = 220; d[i + 1] = 40; d[i + 2] = 40; d[i + 3] = 140;
        } else {
          d[i + 3] = 40;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Draw boxes
    ctx.lineWidth = 2;
    ctx.font = "bold 11px system-ui";
    rects.forEach((r, i) => {
      const color = r.userLabel ? "#22c55e" : "#3b82f6";
      ctx.strokeStyle = color;
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      const label = r.userLabel || `#${i + 1}`;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = color;
      const badgeY = r.y > 18 ? r.y - 18 : r.y + r.h + 2;
      ctx.fillRect(r.x, badgeY, tw, 16);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, r.x + 4, badgeY + 12);
    });

    // Temp drawing rect
    if (tempRect && tempRect.w > 2 && tempRect.h > 2) {
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.strokeRect(tempRect.x, tempRect.y, tempRect.w, tempRect.h);
      ctx.setLineDash([]);
    }
  }, []);

  // ── Image upload ──
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Loading image...");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setImageSrc(dataUrl);
      try {
        const img = await loadImage(dataUrl);
        imageObjRef.current = img;
        setStep("edit");
        setRegions([]);
        setStatus("");
        requestAnimationFrame(() => renderCanvas(img, []));
      } catch {
        setStatus("Failed to load image");
      }
    };
    reader.readAsDataURL(file);
  }, [renderCanvas]);

  // Re-render on region changes
  useEffect(() => {
    if (imageObjRef.current && step === "edit" && !isProcessing) {
      renderCanvas(imageObjRef.current, regions, null, showThresholdPreview, threshold);
    }
  }, [regions, step, renderCanvas, isProcessing, showThresholdPreview, threshold]);

  // Restore image ref if lost
  useEffect(() => {
    if (step === "edit" && imageSrc && !imageObjRef.current) {
      loadImage(imageSrc).then((img) => {
        imageObjRef.current = img;
        renderCanvas(img, regions);
      });
    }
  }, [step, imageSrc, renderCanvas, regions]);

  // ── Crop region ──
  function cropRegion(img: HTMLImageElement, r: { x: number; y: number; w: number; h: number }, scale: number): string {
    const pad = 10;
    const cs = Math.max(r.w, r.h) + pad * 2;
    const c = document.createElement("canvas");
    c.width = cs; c.height = cs;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cs, cs);
    ctx.drawImage(img, r.x / scale, r.y / scale, r.w / scale, r.h / scale,
      (cs - r.w) / 2, (cs - r.h) / 2, r.w, r.h);
    return c.toDataURL("image/png");
  }

  // ── Auto-detect using two-pass CCL (no recursion, no stack overflow) ──
  const detectRegions = useCallback(() => {
    const img = imageObjRef.current;
    if (!img) { setStatus("No image loaded"); return; }

    setIsProcessing(true);
    setStatus("Analyzing image...");

    // Use requestAnimationFrame so the UI updates before heavy work
    requestAnimationFrame(() => {
      try {
        const scale = scaleRef.current;
        const W = Math.round(img.width * scale);
        const H = Math.round(img.height * scale);

        const work = document.createElement("canvas");
        work.width = W; work.height = H;
        const ctx = work.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);

        const imgData = ctx.getImageData(0, 0, W, H);
        const data = imgData.data;

        // Binarize into flat array
        const binary = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) {
          const off = i * 4;
          const avg = (data[off] + data[off + 1] + data[off + 2]) / 3;
          binary[i] = avg < threshold ? 1 : 0;
        }

        setStatus("Finding connected components...");

        // Two-pass connected component labeling (no recursion)
        const labels = new Int32Array(W * H);
        const parent = new Int32Array(W * H + 1); // union-find parent
        let nextLabel = 1;

        // Initialize union-find
        for (let i = 0; i < parent.length; i++) parent[i] = i;

        function find(x: number): number {
          while (parent[x] !== x) {
            parent[x] = parent[parent[x]]; // path compression
            x = parent[x];
          }
          return x;
        }
        function union(a: number, b: number) {
          const ra = find(a), rb = find(b);
          if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
        }

        // First pass: assign provisional labels
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            if (!binary[idx]) continue;

            const above = y > 0 ? labels[(y - 1) * W + x] : 0;
            const left = x > 0 ? labels[y * W + (x - 1)] : 0;

            if (above === 0 && left === 0) {
              labels[idx] = nextLabel;
              parent[nextLabel] = nextLabel;
              nextLabel++;
            } else if (above !== 0 && left === 0) {
              labels[idx] = above;
            } else if (above === 0 && left !== 0) {
              labels[idx] = left;
            } else {
              // Both neighbors labeled
              const minLabel = Math.min(above, left);
              labels[idx] = minLabel;
              if (above !== left) union(above, left);
            }
          }
        }

        setStatus("Computing bounding boxes...");

        // Second pass: resolve labels and compute bounding boxes
        const boundsMap = new Map<number, { minX: number; minY: number; maxX: number; maxY: number; area: number }>();

        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            if (!labels[idx]) continue;

            const root = find(labels[idx]);
            labels[idx] = root;

            const b = boundsMap.get(root);
            if (b) {
              if (x < b.minX) b.minX = x;
              if (y < b.minY) b.minY = y;
              if (x > b.maxX) b.maxX = x;
              if (y > b.maxY) b.maxY = y;
              b.area++;
            } else {
              boundsMap.set(root, { minX: x, minY: y, maxX: x, maxY: y, area: 1 });
            }
          }
        }

        setStatus(`Found ${boundsMap.size} components, filtering...`);

        // Filter by size
        const maxDim = Math.min(W, H) * 0.85;
        const minArea = Math.max(minSize * 2, 20);
        const rects: { x: number; y: number; w: number; h: number }[] = [];

        for (const [, b] of boundsMap) {
          const bw = b.maxX - b.minX;
          const bh = b.maxY - b.minY;
          if (bw >= minSize && bh >= minSize && bw <= maxDim && bh <= maxDim && b.area >= minArea) {
            rects.push({
              x: Math.max(0, b.minX - 4),
              y: Math.max(0, b.minY - 4),
              w: Math.min(W - b.minX + 4, bw + 8),
              h: Math.min(H - b.minY + 4, bh + 8),
            });
          }
        }

        // Merge overlapping
        const merged = mergeOverlapping(rects);

        // Sort reading order: group into rows, then left-to-right
        if (merged.length > 0) {
          // Compute median height for row grouping
          const heights = merged.map((r) => r.h).sort((a, b) => a - b);
          const medianH = heights[Math.floor(heights.length / 2)];
          const rowThreshold = medianH * 0.5;

          merged.sort((a, b) => a.y - b.y);

          // Group into rows
          const rows: typeof merged[] = [];
          let currentRow = [merged[0]];
          for (let i = 1; i < merged.length; i++) {
            const prevCenterY = currentRow[0].y + currentRow[0].h / 2;
            const currCenterY = merged[i].y + merged[i].h / 2;
            if (Math.abs(currCenterY - prevCenterY) < rowThreshold) {
              currentRow.push(merged[i]);
            } else {
              rows.push(currentRow);
              currentRow = [merged[i]];
            }
          }
          rows.push(currentRow);

          // Sort each row left-to-right and flatten
          merged.length = 0;
          for (const row of rows) {
            row.sort((a, b) => a.x - b.x);
            merged.push(...row);
          }
        }

        // Auto-label
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const detected: DetectedRegion[] = merged.map((r, i) => ({
          ...r,
          userLabel: i < chars.length ? chars[i] : "",
          croppedImage: cropRegion(img, r, scale),
        }));

        setRegions(detected);
        setIsProcessing(false);

        if (detected.length === 0) {
          setStatus("No glyphs detected. Try adjusting the threshold or use Draw Box to select manually.");
        } else {
          setStatus(`Detected ${detected.length} glyphs`);
          setTimeout(() => setStatus(""), 3000);
        }
      } catch (err) {
        console.error("Detection error:", err);
        setIsProcessing(false);
        setStatus("Detection failed. Try a different threshold or draw boxes manually.");
      }
    });
  }, [threshold, minSize, renderCanvas]);

  function mergeOverlapping(rects: { x: number; y: number; w: number; h: number }[]) {
    const m = rects.map((r) => ({ ...r }));
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < m.length; i++) {
        for (let j = i + 1; j < m.length; j++) {
          const a = m[i], b = m[j];
          const gap = 3;
          if (a.x - gap < b.x + b.w && a.x + a.w + gap > b.x &&
              a.y - gap < b.y + b.h && a.y + a.h + gap > b.y) {
            const nx = Math.min(a.x, b.x), ny = Math.min(a.y, b.y);
            m[i] = { x: nx, y: ny,
              w: Math.max(a.x + a.w, b.x + b.w) - nx,
              h: Math.max(a.y + a.h, b.y + b.h) - ny };
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

  // ── Manual box drawing ──
  function getCanvasPos(e: React.MouseEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (!drawMode) return;
    setDrawStart(getCanvasPos(e));
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (!drawMode || !drawStart) return;
    const pos = getCanvasPos(e);
    if (imageObjRef.current) {
      renderCanvas(imageObjRef.current, regions, {
        x: Math.min(drawStart.x, pos.x), y: Math.min(drawStart.y, pos.y),
        w: Math.abs(pos.x - drawStart.x), h: Math.abs(pos.y - drawStart.y),
      });
    }
  }

  function handleCanvasMouseUp(e: React.MouseEvent) {
    if (!drawMode || !drawStart) { setDrawStart(null); return; }
    const pos = getCanvasPos(e);
    const img = imageObjRef.current;
    if (!img) return;

    const r = {
      x: Math.min(drawStart.x, pos.x), y: Math.min(drawStart.y, pos.y),
      w: Math.abs(pos.x - drawStart.x), h: Math.abs(pos.y - drawStart.y),
    };

    if (r.w > 5 && r.h > 5) {
      setRegions((prev) => [...prev, {
        ...r, userLabel: "", croppedImage: cropRegion(img, r, scaleRef.current),
      }]);
    }

    setDrawStart(null);
    setDrawMode(false);
  }

  function handleLabelChange(idx: number, value: string) {
    setRegions((prev) => { const n = [...prev]; n[idx] = { ...n[idx], userLabel: value }; return n; });
  }

  function handleRemoveRegion(idx: number) {
    setRegions((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleExtract() {
    onExtract(regions.filter((r) => r.userLabel.trim()).map((r) => ({
      char: r.userLabel.trim(), imageData: r.croppedImage,
    })));
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
                : regions.length > 0
                  ? `${regions.length} regions (${labeledCount} labeled)`
                  : "Auto-detect glyphs or draw bounding boxes manually"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Status bar */}
        {status && (
          <div className={`px-5 py-1.5 text-xs flex items-center gap-2 border-b border-[var(--border)] flex-shrink-0 ${
            status.includes("fail") || status.includes("No glyph") ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
          }`}>
            {isProcessing && (
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" />
              </svg>
            )}
            {status}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center gap-6 py-20">
              <div className="w-20 h-20 rounded-2xl bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                </svg>
              </div>
              <p className="text-[var(--muted)] text-sm max-w-md text-center">
                Upload an image with handwritten or printed characters. The tool will detect glyph bounding boxes automatically, or you can draw them manually.
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] rounded-lg border border-[var(--border)]">
                  <label className="text-[11px] text-[var(--muted)]">Threshold</label>
                  <input type="range" min={30} max={240} value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))} className="w-20 accent-[var(--accent)]" />
                  <span className="text-[11px] font-mono w-6 text-[var(--muted)]">{threshold}</span>
                  <button
                    onMouseDown={() => setShowThresholdPreview(true)}
                    onMouseUp={() => setShowThresholdPreview(false)}
                    onMouseLeave={() => setShowThresholdPreview(false)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    title="Hold to preview which pixels will be detected">
                    Preview
                  </button>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] rounded-lg border border-[var(--border)]">
                  <label className="text-[11px] text-[var(--muted)]">Min size</label>
                  <input type="range" min={3} max={60} value={minSize}
                    onChange={(e) => setMinSize(Number(e.target.value))} className="w-16 accent-[var(--accent)]" />
                  <span className="text-[11px] font-mono w-5 text-[var(--muted)]">{minSize}</span>
                </div>

                <button onClick={detectRegions} disabled={isProcessing}
                  className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] font-medium disabled:opacity-50 flex items-center gap-1.5">
                  {isProcessing ? (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                  )}
                  {isProcessing ? "Detecting..." : "Auto Detect"}
                </button>

                <div className="w-px h-6 bg-[var(--border)]" />

                <button
                  onClick={() => setDrawMode(!drawMode)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                    drawMode ? "bg-amber-500 text-white" : "border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  }`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
                  </svg>
                  {drawMode ? "Drawing..." : "Draw Box"}
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
                drawMode ? "border-amber-400 cursor-crosshair" : "border-[var(--border)]"
              }`}>
                <canvas ref={canvasRef} className="max-w-full"
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={() => { if (drawStart) { setDrawStart(null); if (imageObjRef.current) renderCanvas(imageObjRef.current, regions); } }}
                />
              </div>

              {/* Region cards */}
              {regions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--muted)] font-medium">{regions.length} regions</span>
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
                        <img src={region.croppedImage} alt={`#${idx + 1}`} className="w-9 h-9 object-contain rounded bg-white" />
                        <input type="text" maxLength={1} value={region.userLabel}
                          onChange={(e) => handleLabelChange(idx, e.target.value)}
                          className="w-6 h-4 text-center text-[10px] border border-[var(--border)] rounded bg-[var(--surface)] focus:border-[var(--accent)] outline-none" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {regions.length === 0 && !isProcessing && !status && (
                <div className="text-center py-6 text-[var(--muted)] text-sm">
                  Click &ldquo;Auto Detect&rdquo; to find glyphs, or &ldquo;Draw Box&rdquo; to select manually.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "edit" && (
          <div className="flex justify-between items-center px-5 py-3 border-t border-[var(--border)] flex-shrink-0">
            <button onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]">
              Change Image
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]">Cancel</button>
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
