"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  Pause,
  Play,
  Plus,
  Repeat,
  Square,
  Trash2,
  Upload,
  X,
  GripVertical,
} from "lucide-react";

/* ---------- types ---------- */

interface FrameData {
  id: string;
  name: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  objectUrl: string;
}

type BgMode = "checkerboard" | "solid" | "image";

/* ---------- helpers ---------- */

let idCounter = 0;
function uid() {
  return `frame-${Date.now()}-${++idCounter}`;
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const size = 12;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? "#2a2a2e" : "#35353a";
      ctx.fillRect(x, y, size, size);
    }
  }
}

/* ---------- component ---------- */

export default function AnimationPreviewerPage() {
  /* refs */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  /* frame data */
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);

  /* playback */
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(12);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [loop, setLoop] = useState(true);
  const [pingPong, setPingPong] = useState(false);
  const [playDirection, setPlayDirection] = useState<1 | -1>(1);

  /* onion skinning */
  const [onionEnabled, setOnionEnabled] = useState(false);
  const [onionBefore, setOnionBefore] = useState(2);
  const [onionAfter, setOnionAfter] = useState(1);
  const [onionOpacity, setOnionOpacity] = useState(0.2);

  /* background */
  const [bgMode, setBgMode] = useState<BgMode>("checkerboard");
  const [bgColor, setBgColor] = useState("#1a1a2e");
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  /* canvas sizing */
  const [zoom, setZoom] = useState(1);

  /* drag & drop reorder */
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState(false);

  /* derived */
  const frameCount = frames.length;
  const hasFrames = frameCount > 0;
  const canvasWidth = hasFrames ? frames[0].width : 256;
  const canvasHeight = hasFrames ? frames[0].height : 256;

  /* ---------- file loading ---------- */

  const loadFiles = useCallback(
    async (fileList: FileList, append = false) => {
      const files = Array.from(fileList)
        .filter((f) => f.type.startsWith("image/"))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      const loaded = await Promise.all(
        files.map(
          (file) =>
            new Promise<FrameData>((resolve, reject) => {
              const url = URL.createObjectURL(file);
              const img = new Image();
              img.onload = () =>
                resolve({
                  id: uid(),
                  name: file.name.replace(/\.[^.]+$/, ""),
                  image: img,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                  objectUrl: url,
                });
              img.onerror = reject;
              img.src = url;
            }),
        ),
      );

      if (append) {
        setFrames((prev) => [...prev, ...loaded]);
      } else {
        setFrames(loaded);
        setCurrentFrame(0);
        setPlaying(false);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget(false);
      if (e.dataTransfer.files?.length) {
        void loadFiles(e.dataTransfer.files, !hasFrames ? false : false);
      }
    },
    [loadFiles, hasFrames],
  );

  /* ---------- frame advance ---------- */

  const advanceFrame = useCallback(() => {
    setCurrentFrame((prev) => {
      if (pingPong) {
        let next = prev + playDirection;
        let newDir = playDirection;
        if (next >= frameCount) {
          next = frameCount - 2;
          newDir = -1;
        }
        if (next < 0) {
          next = 1;
          newDir = 1;
          if (!loop) {
            setPlaying(false);
            return 0;
          }
        }
        if (newDir !== playDirection) setPlayDirection(newDir as 1 | -1);
        return Math.max(0, Math.min(next, frameCount - 1));
      }
      const next = prev + 1;
      if (next >= frameCount) {
        if (loop) return 0;
        setPlaying(false);
        return prev;
      }
      return next;
    });
  }, [frameCount, loop, pingPong, playDirection]);

  /* ---------- animation loop ---------- */

  useEffect(() => {
    if (!playing || frameCount < 2) return;

    lastTimeRef.current = performance.now();

    function animate(time: number) {
      const elapsed = time - lastTimeRef.current;
      const frameInterval = 1000 / (fps * speedMultiplier);
      if (elapsed >= frameInterval) {
        advanceFrame();
        lastTimeRef.current = time;
      }
      animationRef.current = requestAnimationFrame(animate);
    }

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [playing, fps, speedMultiplier, frameCount, advanceFrame]);

  /* ---------- canvas rendering ---------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasFrames) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvasWidth;
    const h = canvasHeight;
    canvas.width = w;
    canvas.height = h;

    /* background */
    ctx.clearRect(0, 0, w, h);
    if (bgMode === "checkerboard") {
      drawCheckerboard(ctx, w, h);
    } else if (bgMode === "solid") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
    } else if (bgMode === "image" && bgImage) {
      ctx.drawImage(bgImage, 0, 0, w, h);
    }

    /* onion skin: before frames (red tint) */
    if (onionEnabled) {
      for (let i = onionBefore; i >= 1; i--) {
        const idx = currentFrame - i;
        if (idx >= 0 && frames[idx]) {
          ctx.save();
          ctx.globalAlpha = onionOpacity * (1 - i / (onionBefore + 1));
          ctx.drawImage(frames[idx].image, 0, 0, w, h);
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = "rgba(255,0,0,0.3)";
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = "source-over";
          ctx.restore();
        }
      }

      /* onion skin: after frames (blue tint) */
      for (let i = 1; i <= onionAfter; i++) {
        const idx = currentFrame + i;
        if (idx < frameCount && frames[idx]) {
          ctx.save();
          ctx.globalAlpha = onionOpacity * (1 - i / (onionAfter + 1));
          ctx.drawImage(frames[idx].image, 0, 0, w, h);
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = "rgba(0,100,255,0.3)";
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = "source-over";
          ctx.restore();
        }
      }
    }

    /* current frame */
    ctx.globalAlpha = 1;
    if (frames[currentFrame]) {
      ctx.drawImage(frames[currentFrame].image, 0, 0, w, h);
    }
  }, [frames, currentFrame, canvasWidth, canvasHeight, hasFrames, bgMode, bgColor, bgImage, onionEnabled, onionBefore, onionAfter, onionOpacity, frameCount]);

  /* ---------- controls ---------- */

  function togglePlay() {
    if (frameCount < 2) return;
    if (!playing) {
      setPlayDirection(1);
      lastTimeRef.current = performance.now();
    }
    setPlaying((p) => !p);
  }

  function stop() {
    setPlaying(false);
    setCurrentFrame(0);
    setPlayDirection(1);
  }

  function stepPrev() {
    setPlaying(false);
    setCurrentFrame((p) => (p > 0 ? p - 1 : frameCount - 1));
  }

  function stepNext() {
    setPlaying(false);
    setCurrentFrame((p) => (p < frameCount - 1 ? p + 1 : 0));
  }

  function removeFrame(idx: number) {
    setFrames((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      URL.revokeObjectURL(prev[idx].objectUrl);
      return next;
    });
    setCurrentFrame((prev) => {
      if (prev >= frameCount - 1) return Math.max(0, frameCount - 2);
      if (prev > idx) return prev - 1;
      return prev;
    });
  }

  /* drag reorder */
  function handleFrameDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleFrameDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setFrames((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(dragIdx, 1);
      copy.splice(idx, 0, moved);
      return copy;
    });
    setDragIdx(idx);
  }

  function handleFrameDragEnd() {
    setDragIdx(null);
  }

  /* ---------- exports ---------- */

  function exportSpritesheet() {
    if (!hasFrames) return;
    const totalW = canvasWidth * frameCount;
    const c = document.createElement("canvas");
    c.width = totalW;
    c.height = canvasHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    frames.forEach((frame, i) => {
      ctx.drawImage(frame.image, i * canvasWidth, 0, canvasWidth, canvasHeight);
    });
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "spritesheet.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function exportMetadata() {
    const data = {
      frameCount,
      frameWidth: canvasWidth,
      frameHeight: canvasHeight,
      fps,
      loop,
      pingPong,
      frames: frames.map((f, i) => ({
        index: i,
        name: f.name,
        x: i * canvasWidth,
        y: 0,
        width: canvasWidth,
        height: canvasHeight,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "animation-metadata.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCurrentFrame() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `frame-${currentFrame}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function handleBgImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setBgImage(img);
      setBgMode("image");
    };
    img.src = url;
  }

  /* ---------- speed buttons ---------- */
  const speedOptions = [0.25, 0.5, 1, 2];

  /* ---------- render ---------- */

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>

        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <Film size={14} />
          <span className="text-sm font-semibold">Animation Previewer</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
          >
            <Upload size={12} />
            Upload
          </button>
          {hasFrames && (
            <>
              <button
                type="button"
                onClick={exportSpritesheet}
                className="inline-flex items-center gap-1.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] text-xs px-2.5 py-1"
              >
                <Download size={12} />
                Spritesheet
              </button>
              <button
                type="button"
                onClick={exportMetadata}
                className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
              >
                <Download size={12} />
                JSON
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void loadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={addInputRef}
        type="file"
        accept="image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void loadFiles(e.target.files, true);
          e.target.value = "";
        }}
      />
      <input
        ref={bgImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBgImageUpload}
      />

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {!hasFrames ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center p-8">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(true);
              }}
              onDragLeave={() => setDropTarget(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-4 w-full max-w-md py-16 px-8 rounded-xl border-2 border-dashed transition-colors ${
                dropTarget
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--border)] hover:border-[var(--muted)]"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)]">
                <Upload size={18} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Drop sprite frames or click to upload
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Select multiple PNGs or WebPs, sorted alphabetically
                </p>
              </div>
            </button>
          </div>
        ) : (
          <>
            {/* Left sidebar */}
            <div className="w-72 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto flex flex-col">
              {/* Frame list */}
              <div className="p-3 border-b border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Frames ({frameCount})
                  </p>
                  <button
                    type="button"
                    onClick={() => addInputRef.current?.click()}
                    className="w-5 h-5 rounded flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <div className="space-y-0.5 max-h-64 overflow-y-auto">
                  {frames.map((frame, idx) => (
                    <div
                      key={frame.id}
                      draggable
                      onDragStart={() => handleFrameDragStart(idx)}
                      onDragOver={(e) => handleFrameDragOver(e, idx)}
                      onDragEnd={handleFrameDragEnd}
                      onClick={() => {
                        setCurrentFrame(idx);
                        setPlaying(false);
                      }}
                      className={`flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer group transition-colors ${
                        idx === currentFrame
                          ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                          : "hover:bg-[var(--surface-hover)] border border-transparent"
                      }`}
                    >
                      <GripVertical size={10} className="text-[var(--muted)] opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab" />
                      <div className="w-10 h-10 rounded border border-[var(--border)] bg-[var(--background)] overflow-hidden flex items-center justify-center flex-shrink-0">
                        <img
                          src={frame.objectUrl}
                          alt={frame.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[var(--foreground)] truncate">{frame.name}</p>
                        <p className="text-[10px] text-[var(--muted)]">#{idx}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFrame(idx);
                        }}
                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--muted)] hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Onion Skinning */}
              <div className="p-3 border-b border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Onion Skinning
                  </p>
                  <button
                    type="button"
                    onClick={() => setOnionEnabled((v) => !v)}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                      onionEnabled ? "text-[var(--accent)]" : "text-[var(--muted)]"
                    } hover:bg-[var(--surface-hover)]`}
                  >
                    {onionEnabled ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                </div>
                {onionEnabled && (
                  <div className="space-y-2.5">
                    <label className="block">
                      <span className="flex items-center justify-between text-xs text-[var(--foreground)] mb-1">
                        Before frames
                        <span className="font-semibold text-red-400">{onionBefore}</span>
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        value={onionBefore}
                        onChange={(e) => setOnionBefore(Number(e.target.value))}
                        className="w-full h-1 rounded-full appearance-none bg-[var(--border)] accent-red-400"
                      />
                    </label>
                    <label className="block">
                      <span className="flex items-center justify-between text-xs text-[var(--foreground)] mb-1">
                        After frames
                        <span className="font-semibold text-blue-400">{onionAfter}</span>
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        value={onionAfter}
                        onChange={(e) => setOnionAfter(Number(e.target.value))}
                        className="w-full h-1 rounded-full appearance-none bg-[var(--border)] accent-blue-400"
                      />
                    </label>
                    <label className="block">
                      <span className="flex items-center justify-between text-xs text-[var(--foreground)] mb-1">
                        Opacity
                        <span className="font-semibold">{Math.round(onionOpacity * 100)}%</span>
                      </span>
                      <input
                        type="range"
                        min={5}
                        max={50}
                        value={onionOpacity * 100}
                        onChange={(e) => setOnionOpacity(Number(e.target.value) / 100)}
                        className="w-full h-1 rounded-full appearance-none bg-[var(--border)] accent-[var(--accent)]"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Background */}
              <div className="p-3 border-b border-[var(--border)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                  Background
                </p>
                <div className="flex gap-1 mb-2">
                  {(["checkerboard", "solid", "image"] as BgMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        if (mode === "image") {
                          bgImageInputRef.current?.click();
                        } else {
                          setBgMode(mode);
                        }
                      }}
                      className={`flex-1 text-[10px] py-1 rounded capitalize transition-colors ${
                        bgMode === mode
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                {bgMode === "solid" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-6 h-6 rounded border border-[var(--border)] bg-transparent cursor-pointer"
                    />
                    <span className="text-xs text-[var(--muted)] font-mono">{bgColor}</span>
                  </div>
                )}
              </div>

              {/* Export options */}
              <div className="p-3 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                  Export
                </p>
                <button
                  type="button"
                  onClick={exportSpritesheet}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] text-xs px-2.5 py-1.5 font-medium"
                >
                  <ImageIcon size={12} />
                  Spritesheet PNG
                </button>
                <button
                  type="button"
                  onClick={exportMetadata}
                  className="w-full inline-flex items-center justify-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1.5 text-[var(--foreground)] font-medium"
                >
                  <Download size={12} />
                  Metadata JSON
                </button>
                <button
                  type="button"
                  onClick={exportCurrentFrame}
                  className="w-full inline-flex items-center justify-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1.5 text-[var(--foreground)] font-medium"
                >
                  <Download size={12} />
                  Current Frame PNG
                </button>
              </div>
            </div>

            {/* Center: preview + controls */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Canvas area */}
              <div className="flex-1 flex items-center justify-center overflow-auto p-4">
                <div
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                  className="transition-transform"
                >
                  <canvas
                    ref={canvasRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    className="block rounded border border-[var(--border)]"
                  />
                </div>
              </div>

              {/* Zoom controls */}
              <div className="flex items-center justify-center gap-2 px-4 pb-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                  className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] px-1"
                >
                  -
                </button>
                <span className="text-[10px] text-[var(--muted)] w-12 text-center font-mono">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                  className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] px-1"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] px-1.5 py-0.5 rounded border border-[var(--border)]"
                >
                  Fit
                </button>
              </div>

              {/* Transport bar */}
              <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
                <div className="flex items-center justify-center gap-3">
                  {/* Stop */}
                  <button
                    type="button"
                    onClick={stop}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  >
                    <Square size={14} />
                  </button>

                  {/* Prev */}
                  <button
                    type="button"
                    onClick={stepPrev}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Play/Pause */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="w-9 h-9 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center"
                  >
                    {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>

                  {/* Next */}
                  <button
                    type="button"
                    onClick={stepNext}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  >
                    <ChevronRight size={16} />
                  </button>

                  {/* Frame counter */}
                  <span className="text-xs text-[var(--muted)] font-mono min-w-[80px] text-center">
                    Frame {currentFrame + 1} / {frameCount}
                  </span>

                  {/* Separator */}
                  <div className="w-px h-5 bg-[var(--border)]" />

                  {/* FPS */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[var(--muted)]">FPS</span>
                    <input
                      type="range"
                      min={1}
                      max={60}
                      value={fps}
                      onChange={(e) => setFps(Number(e.target.value))}
                      className="w-20 h-1 rounded-full appearance-none bg-[var(--border)] accent-[var(--accent)]"
                    />
                    <span className="text-[10px] text-[var(--foreground)] font-mono w-5 text-right">{fps}</span>
                  </div>

                  {/* Separator */}
                  <div className="w-px h-5 bg-[var(--border)]" />

                  {/* Speed buttons */}
                  <div className="flex items-center gap-0.5">
                    {speedOptions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpeedMultiplier(s)}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                          speedMultiplier === s
                            ? "bg-[var(--accent)] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  {/* Separator */}
                  <div className="w-px h-5 bg-[var(--border)]" />

                  {/* Loop toggle */}
                  <button
                    type="button"
                    onClick={() => setLoop((v) => !v)}
                    title="Loop"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      loop
                        ? "text-[var(--accent)] bg-[var(--accent)]/10"
                        : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <Repeat size={13} />
                  </button>

                  {/* Ping-pong toggle */}
                  <button
                    type="button"
                    onClick={() => setPingPong((v) => !v)}
                    title="Ping-pong"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-colors ${
                      pingPong
                        ? "text-[var(--accent)] bg-[var(--accent)]/10"
                        : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 9 2 12 5 15" />
                      <polyline points="19 9 22 12 19 15" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
