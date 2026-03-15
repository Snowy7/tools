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
  const [invertDetection, setInvertDetection] = useState(false);
  const [regions, setRegions] = useState<DetectedRegion[]>([]);
  const [step, setStep] = useState<"upload" | "edit">("upload");
  const [status, setStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [showBinaryPreview, setShowBinaryPreview] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // ── Render ──
  const renderCanvas = useCallback((
    img: HTMLImageElement,
    rects: DetectedRegion[],
    extra?: {
      tempRect?: { x: number; y: number; w: number; h: number };
      binary?: boolean;
      threshold?: number;
      invert?: boolean;
    },
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxW = 720;
    const scale = Math.min(1, maxW / img.width);
    scaleRef.current = scale;
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Binary preview
    if (extra?.binary && extra.threshold !== undefined) {
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = id.data;
      const inv = extra.invert ?? false;
      for (let i = 0; i < d.length; i += 4) {
        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
        const isDark = inv ? avg >= extra.threshold : avg < extra.threshold;
        if (isDark) {
          d[i] = 59; d[i + 1] = 130; d[i + 2] = 246; d[i + 3] = 160;
        } else {
          d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 180;
        }
      }
      ctx.putImageData(id, 0, 0);
    }

    // Bounding boxes
    ctx.lineWidth = 2;
    ctx.font = "bold 10px system-ui";
    rects.forEach((r, i) => {
      const hasLabel = !!r.userLabel.trim();
      ctx.strokeStyle = hasLabel ? "#22c55e" : "#3b82f6";
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      // Semi-transparent fill
      ctx.fillStyle = hasLabel ? "rgba(34,197,94,0.08)" : "rgba(59,130,246,0.08)";
      ctx.fillRect(r.x, r.y, r.w, r.h);

      const label = r.userLabel || `${i + 1}`;
      const tw = ctx.measureText(label).width + 6;
      const badgeY = r.y > 16 ? r.y - 14 : r.y + r.h + 2;
      ctx.fillStyle = hasLabel ? "#22c55e" : "#3b82f6";
      ctx.beginPath();
      ctx.roundRect(r.x, badgeY, tw, 14, 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, r.x + 3, badgeY + 10);
    });

    // Drawing rect
    if (extra?.tempRect) {
      const tr = extra.tempRect;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.strokeRect(tr.x, tr.y, tr.w, tr.h);
      ctx.setLineDash([]);
    }
  }, []);

  // ── Upload ──
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Loading...");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const url = ev.target?.result as string;
      setImageSrc(url);
      try {
        const img = await loadImage(url);
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
    // Reset file input so re-uploading same file works
    e.target.value = "";
  }, [renderCanvas]);

  // Re-render on changes
  useEffect(() => {
    if (imageObjRef.current && step === "edit" && !isProcessing) {
      renderCanvas(imageObjRef.current, regions, {
        binary: showBinaryPreview,
        threshold,
        invert: invertDetection,
      });
    }
  }, [regions, step, renderCanvas, isProcessing, showBinaryPreview, threshold, invertDetection]);

  // Restore image if ref lost
  useEffect(() => {
    if (step === "edit" && imageSrc && !imageObjRef.current) {
      loadImage(imageSrc).then((img) => {
        imageObjRef.current = img;
        renderCanvas(img, regions);
      });
    }
  }, [step, imageSrc, renderCanvas, regions]);

  // ── Crop ──
  function cropRegion(img: HTMLImageElement, r: { x: number; y: number; w: number; h: number }, scale: number): string {
    const pad = 12;
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

  // ── Detection: 8-connected two-pass CCL ──
  const detectRegions = useCallback(() => {
    const img = imageObjRef.current;
    if (!img) { setStatus("No image loaded"); return; }

    setIsProcessing(true);
    setRegions([]);
    setStatus("Analyzing image...");

    // Defer heavy work so React can render the status update
    setTimeout(() => {
      try {
        const scale = scaleRef.current;
        const W = Math.round(img.width * scale);
        const H = Math.round(img.height * scale);

        // Get pixel data
        const work = document.createElement("canvas");
        work.width = W; work.height = H;
        const ctx = work.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);
        const pixelData = ctx.getImageData(0, 0, W, H).data;

        // Binarize
        const binary = new Uint8Array(W * H);
        let darkCount = 0;
        for (let i = 0; i < W * H; i++) {
          const off = i * 4;
          const avg = (pixelData[off] + pixelData[off + 1] + pixelData[off + 2]) / 3;
          const isDark = invertDetection ? avg >= threshold : avg < threshold;
          binary[i] = isDark ? 1 : 0;
          if (isDark) darkCount++;
        }

        // If more than 60% of pixels are "dark", suggest inverting
        const darkRatio = darkCount / (W * H);
        if (darkRatio > 0.6 && !invertDetection) {
          setIsProcessing(false);
          setStatus("Most of the image is dark. Try enabling 'Invert' or lowering the threshold.");
          return;
        }
        if (darkRatio < 0.001) {
          setIsProcessing(false);
          setStatus("Almost no dark pixels found. Try raising the threshold.");
          return;
        }

        // 8-connected two-pass CCL with union-find
        const maxLabels = Math.min(W * H, 500000);
        const parent = new Int32Array(maxLabels + 1);
        const labels = new Int32Array(W * H);
        let nextLabel = 1;

        for (let i = 0; i <= maxLabels; i++) parent[i] = i;

        function find(x: number): number {
          let r = x;
          while (parent[r] !== r) r = parent[r];
          // Path compression
          while (parent[x] !== r) { const t = parent[x]; parent[x] = r; x = t; }
          return r;
        }
        function union(a: number, b: number) {
          const ra = find(a), rb = find(b);
          if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
        }

        // First pass — check all 8 neighbors (above-left, above, above-right, left)
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            if (!binary[idx]) continue;

            if (nextLabel >= maxLabels) break;

            // Collect labeled neighbors
            const neighbors: number[] = [];
            // Above-left
            if (y > 0 && x > 0 && labels[(y - 1) * W + (x - 1)]) neighbors.push(labels[(y - 1) * W + (x - 1)]);
            // Above
            if (y > 0 && labels[(y - 1) * W + x]) neighbors.push(labels[(y - 1) * W + x]);
            // Above-right
            if (y > 0 && x < W - 1 && labels[(y - 1) * W + (x + 1)]) neighbors.push(labels[(y - 1) * W + (x + 1)]);
            // Left
            if (x > 0 && labels[y * W + (x - 1)]) neighbors.push(labels[y * W + (x - 1)]);

            if (neighbors.length === 0) {
              labels[idx] = nextLabel++;
            } else {
              // Use the smallest neighbor label
              let minL = neighbors[0];
              for (let n = 1; n < neighbors.length; n++) {
                if (neighbors[n] < minL) minL = neighbors[n];
              }
              labels[idx] = minL;
              // Union all neighbors
              for (const n of neighbors) {
                if (n !== minL) union(n, minL);
              }
            }
          }
        }

        // Second pass — resolve and compute bounds
        const boundsMap = new Map<number, { minX: number; minY: number; maxX: number; maxY: number; area: number }>();

        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            if (!labels[idx]) continue;
            const root = find(labels[idx]);
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

        // Filter by dimensions and area
        const maxDim = Math.min(W, H) * 0.8;
        const minArea = Math.max(minSize * minSize * 0.2, 15);
        const rects: { x: number; y: number; w: number; h: number }[] = [];

        for (const [, b] of boundsMap) {
          const bw = b.maxX - b.minX;
          const bh = b.maxY - b.minY;
          if (bw >= minSize && bh >= minSize && bw <= maxDim && bh <= maxDim && b.area >= minArea) {
            const pad = Math.max(4, Math.round(Math.max(bw, bh) * 0.08));
            rects.push({
              x: Math.max(0, b.minX - pad),
              y: Math.max(0, b.minY - pad),
              w: Math.min(W - Math.max(0, b.minX - pad), bw + pad * 2),
              h: Math.min(H - Math.max(0, b.minY - pad), bh + pad * 2),
            });
          }
        }

        // Merge overlapping
        const merged = mergeBoxes(rects);

        // Sort into reading order
        sortReadingOrder(merged, H);

        // Auto-label & crop
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const detected: DetectedRegion[] = merged.map((r, i) => ({
          ...r,
          userLabel: i < chars.length ? chars[i] : "",
          croppedImage: cropRegion(img, r, scale),
        }));

        setRegions(detected);
        setIsProcessing(false);

        if (detected.length === 0) {
          setStatus("No glyphs found. Adjust threshold, try Invert, or draw boxes manually.");
        } else {
          setStatus(`Found ${detected.length} glyphs`);
          setTimeout(() => setStatus(""), 4000);
        }
      } catch (err) {
        console.error("Detection error:", err);
        setIsProcessing(false);
        setStatus(`Detection error: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }, 50); // 50ms delay so React renders the "Analyzing..." status first
  }, [threshold, minSize, invertDetection]);

  function mergeBoxes(rects: { x: number; y: number; w: number; h: number }[]) {
    const m = rects.map((r) => ({ ...r }));
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < m.length; i++) {
        for (let j = i + 1; j < m.length; j++) {
          const a = m[i], b = m[j];
          const gap = 2;
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

  function sortReadingOrder(rects: { x: number; y: number; w: number; h: number }[], imgH: number) {
    if (rects.length < 2) return;
    const heights = rects.map((r) => r.h).sort((a, b) => a - b);
    const medH = heights[Math.floor(heights.length / 2)];
    const rowGap = medH * 0.4;

    rects.sort((a, b) => a.y - b.y);
    const rows: (typeof rects)[] = [];
    let row = [rects[0]];
    for (let i = 1; i < rects.length; i++) {
      const cy1 = row[0].y + row[0].h / 2;
      const cy2 = rects[i].y + rects[i].h / 2;
      if (Math.abs(cy2 - cy1) <= rowGap) {
        row.push(rects[i]);
      } else {
        rows.push(row);
        row = [rects[i]];
      }
    }
    rows.push(row);

    rects.length = 0;
    for (const r of rows) {
      r.sort((a, b) => a.x - b.x);
      rects.push(...r);
    }
  }

  // ── Manual drawing ──
  function canvasPos(e: React.MouseEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }

  function onCanvasDown(e: React.MouseEvent) {
    if (!drawMode) return;
    setDrawStart(canvasPos(e));
  }
  function onCanvasMove(e: React.MouseEvent) {
    if (!drawMode || !drawStart) return;
    const p = canvasPos(e);
    if (imageObjRef.current) {
      renderCanvas(imageObjRef.current, regions, {
        tempRect: { x: Math.min(drawStart.x, p.x), y: Math.min(drawStart.y, p.y),
          w: Math.abs(p.x - drawStart.x), h: Math.abs(p.y - drawStart.y) },
      });
    }
  }
  function onCanvasUp(e: React.MouseEvent) {
    if (!drawMode || !drawStart) { setDrawStart(null); return; }
    const p = canvasPos(e);
    const img = imageObjRef.current;
    if (!img) return;
    const r = { x: Math.min(drawStart.x, p.x), y: Math.min(drawStart.y, p.y),
      w: Math.abs(p.x - drawStart.x), h: Math.abs(p.y - drawStart.y) };
    if (r.w > 5 && r.h > 5) {
      setRegions((prev) => [...prev, { ...r, userLabel: "", croppedImage: cropRegion(img, r, scaleRef.current) }]);
    }
    setDrawStart(null);
  }

  function handleLabelChange(idx: number, val: string) {
    setRegions((p) => { const n = [...p]; n[idx] = { ...n[idx], userLabel: val }; return n; });
  }
  function handleRemoveRegion(idx: number) {
    setRegions((p) => p.filter((_, i) => i !== idx));
  }
  function handleExtract() {
    onExtract(regions.filter((r) => r.userLabel.trim()).map((r) => ({
      char: r.userLabel.trim(), imageData: r.croppedImage,
    })));
  }

  const labeled = regions.filter((r) => r.userLabel.trim()).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold">Extract Glyphs from Image</h2>
            <p className="text-[11px] text-[var(--muted)]">
              {step === "upload" ? "Upload an image containing characters"
                : regions.length > 0 ? `${regions.length} regions found, ${labeled} labeled`
                : "Use auto-detect or draw boxes around each glyph"}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className={`px-5 py-1.5 text-[11px] flex items-center gap-2 border-b border-[var(--border)] flex-shrink-0 ${
            status.includes("error") || status.includes("No glyph") || status.includes("no dark") || status.includes("Most of")
              ? "bg-amber-50 text-amber-700" : "bg-blue-50/50 text-blue-600"
          }`}>
            {isProcessing && (
              <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            )}
            {status}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center gap-5 py-16">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm text-[var(--foreground)] mb-1">Upload an image with characters</p>
                <p className="text-[11px] text-[var(--muted)]">PNG, JPG, or any image format. Dark text on light background works best.</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2 bg-[var(--accent)] text-white rounded-xl hover:bg-[var(--accent-hover)] transition-colors text-sm font-medium">
                Choose Image
              </button>
            </div>
          )}

          {step === "edit" && (
            <div className="flex flex-col gap-3">
              {/* Toolbar */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                {/* Detection settings */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">
                  <span className="text-[var(--muted)]">Thresh</span>
                  <input type="range" min={20} max={245} value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))} className="w-16 accent-[var(--accent)]" />
                  <span className="font-mono w-5 text-[var(--muted)]">{threshold}</span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">
                  <span className="text-[var(--muted)]">Min</span>
                  <input type="range" min={2} max={80} value={minSize}
                    onChange={(e) => setMinSize(Number(e.target.value))} className="w-12 accent-[var(--accent)]" />
                  <span className="font-mono w-4 text-[var(--muted)]">{minSize}</span>
                </div>

                <button
                  onClick={() => setInvertDetection(!invertDetection)}
                  className={`px-2 py-1 rounded-lg border transition-all ${
                    invertDetection ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--muted)]"
                  }`}>
                  Invert
                </button>

                <button
                  onClick={() => setShowBinaryPreview(!showBinaryPreview)}
                  className={`px-2 py-1 rounded-lg border transition-all ${
                    showBinaryPreview ? "bg-violet-500 text-white border-violet-500" : "border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--muted)]"
                  }`}>
                  Preview
                </button>

                <div className="w-px h-5 bg-[var(--border)]" />

                <button onClick={detectRegions} disabled={isProcessing}
                  className="px-2.5 py-1 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] font-medium disabled:opacity-50 flex items-center gap-1">
                  {isProcessing ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                  )}
                  {isProcessing ? "Working..." : "Detect"}
                </button>

                <button onClick={() => setDrawMode(!drawMode)}
                  className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                    drawMode ? "bg-amber-500 text-white" : "border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  }`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="4" width="16" height="16" rx="1" strokeDasharray="3 2" />
                  </svg>
                  {drawMode ? "Drawing..." : "Draw"}
                </button>

                {regions.length > 0 && (
                  <>
                    <div className="w-px h-5 bg-[var(--border)]" />
                    <button onClick={() => setRegions([])}
                      className="px-2 py-1 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-red-500">
                      Clear
                    </button>
                  </>
                )}

                <div className="flex-1" />
                <button onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-[var(--muted)]">
                  Change image
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>

              {/* Canvas */}
              <div className={`border rounded-xl overflow-auto max-h-[45vh] bg-[#f8f8f8] ${
                drawMode ? "border-amber-400 cursor-crosshair" : "border-[var(--border)]"
              }`}>
                <canvas ref={canvasRef} className="max-w-full"
                  onMouseDown={onCanvasDown} onMouseMove={onCanvasMove} onMouseUp={onCanvasUp}
                  onMouseLeave={() => { if (drawStart) { setDrawStart(null); if (imageObjRef.current) renderCanvas(imageObjRef.current, regions); } }}
                />
              </div>

              {/* Regions */}
              {regions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-[var(--muted)] font-medium">{regions.length} regions</span>
                    <span className="text-[11px] text-[var(--muted)]">{labeled} labeled</span>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1 max-h-[22vh] overflow-auto">
                    {regions.map((region, idx) => (
                      <div key={idx}
                        className="flex flex-col items-center gap-0.5 p-1 border border-[var(--border)] rounded-lg bg-[var(--background)] group relative">
                        <button onClick={() => handleRemoveRegion(idx)}
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          &times;
                        </button>
                        <img src={region.croppedImage} alt={`#${idx + 1}`} className="w-8 h-8 object-contain rounded bg-white" />
                        <input type="text" maxLength={1} value={region.userLabel}
                          onChange={(e) => handleLabelChange(idx, e.target.value)}
                          className="w-6 h-4 text-center text-[10px] border border-[var(--border)] rounded bg-[var(--surface)] focus:border-[var(--accent)] outline-none" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {regions.length === 0 && !isProcessing && !status && (
                <p className="text-center py-4 text-[var(--muted)] text-xs">
                  Use &ldquo;Detect&rdquo; to auto-find glyphs, or &ldquo;Draw&rdquo; to manually box them.
                  {" "}Toggle &ldquo;Preview&rdquo; to see what the threshold captures.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "edit" && regions.length > 0 && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border)] flex-shrink-0">
            <button onClick={onClose}
              className="px-4 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]">Cancel</button>
            <button onClick={handleExtract} disabled={labeled === 0}
              className="px-4 py-1.5 text-xs bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40 font-medium">
              Import {labeled} glyph{labeled !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
