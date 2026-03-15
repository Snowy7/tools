"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Upload,
  Download,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  ArrowLeft,
  Scissors,
  Image as ImageIcon,
  Sliders,
  ChevronDown,
} from "lucide-react";

// ── Types ──

type AppState =
  | { kind: "upload" }
  | { kind: "processing"; originalUrl: string; originalFile: File; statusText: string; progress: number }
  | { kind: "result"; originalUrl: string; resultUrl: string; originalFile: File; resultBlob: Blob; elapsed: number }
  | { kind: "error"; message: string; originalFile: File | null };

type OutputFormat = "png" | "jpeg" | "webp";

interface Settings {
  outputQuality: number;
  outputFormat: OutputFormat;
  bgReplace: "transparent" | "color" | "image";
  bgColor: string;
  bgImageUrl: string | null;
  bgImageFile: File | null;
  smoothEdges: boolean;
}

// ── Helpers ──

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FORMAT_LABELS: Record<OutputFormat, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
};

const FORMAT_MIME: Record<OutputFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const FORMAT_EXT: Record<OutputFormat, string> = {
  png: ".png",
  jpeg: ".jpg",
  webp: ".webp",
};

// ── Component ──

export default function BackgroundRemoverPage() {
  const [state, setState] = useState<AppState>({ kind: "upload" });
  const [isDragging, setIsDragging] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [containerWidth, setContainerWidth] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formatDropdownOpen, setFormatDropdownOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    outputQuality: 92,
    outputFormat: "png",
    bgReplace: "transparent",
    bgColor: "#ffffff",
    bgImageUrl: null,
    bgImageFile: null,
    smoothEdges: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const formatDropdownRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);

  // Track container width via ResizeObserver
  useEffect(() => {
    const container = sliderContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [state.kind]);

  // Close format dropdown on outside click
  useEffect(() => {
    if (!formatDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (formatDropdownRef.current && !formatDropdownRef.current.contains(e.target as Node)) {
        setFormatDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [formatDropdownOpen]);

  const cleanupUrls = useCallback(() => {
    if (state.kind === "processing" && state.originalUrl) {
      URL.revokeObjectURL(state.originalUrl);
    }
    if (state.kind === "result") {
      URL.revokeObjectURL(state.originalUrl);
      URL.revokeObjectURL(state.resultUrl);
    }
  }, [state]);

  const processImage = useCallback(async (file: File) => {
    const originalUrl = URL.createObjectURL(file);

    setState({
      kind: "processing",
      originalUrl,
      originalFile: file,
      statusText: "Downloading AI model...",
      progress: 0,
    });

    const startTime = performance.now();

    try {
      const { removeBackground } = await import("@imgly/background-removal");

      const resultBlob = await removeBackground(file, {
        progress: (key: string, current: number, total: number) => {
          const pct = total > 0 ? Math.round((current / total) * 100) : 0;
          const isDownloading = key.includes("fetch") || key.includes("download") || key.includes("load");
          setState((prev) => {
            if (prev.kind !== "processing") return prev;
            return {
              ...prev,
              statusText: isDownloading ? "Downloading AI model..." : "Removing background...",
              progress: pct,
            };
          });
        },
      });

      const elapsed = Math.round((performance.now() - startTime) / 100) / 10;
      const resultUrl = URL.createObjectURL(resultBlob);

      setState({
        kind: "result",
        originalUrl,
        resultUrl,
        originalFile: file,
        resultBlob,
        elapsed,
      });
    } catch (err) {
      URL.revokeObjectURL(originalUrl);
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "An unexpected error occurred.",
        originalFile: file,
      });
    }
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      cleanupUrls();
      processImage(file);
    },
    [cleanupUrls, processImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const reset = useCallback(() => {
    cleanupUrls();
    setState({ kind: "upload" });
    setSliderPosition(50);
    setCopySuccess(false);
    setSettingsOpen(false);
    if (settings.bgImageUrl) {
      URL.revokeObjectURL(settings.bgImageUrl);
      setSettings((s) => ({ ...s, bgImageUrl: null, bgImageFile: null }));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [cleanupUrls, settings.bgImageUrl]);

  // Build final canvas with settings applied, then trigger download or return blob
  const buildFinalCanvas = useCallback(
    async (resultBlob: Blob): Promise<HTMLCanvasElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;

          // Apply edge smoothing via slight blur on the alpha channel
          if (settings.smoothEdges) {
            ctx.filter = "blur(1px)";
            ctx.drawImage(img, 0, 0);
            ctx.filter = "none";
            // Re-draw with full opacity on top to preserve sharpness of subject
            ctx.globalCompositeOperation = "source-in";
            ctx.drawImage(img, 0, 0);
            ctx.globalCompositeOperation = "source-over";
          }

          // Background replacement
          if (settings.bgReplace === "color") {
            // Draw color background, then composite the result on top
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext("2d")!;
            tempCtx.fillStyle = settings.bgColor;
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            if (settings.smoothEdges) {
              tempCtx.drawImage(canvas, 0, 0);
            } else {
              tempCtx.drawImage(img, 0, 0);
            }
            resolve(tempCanvas);
            return;
          }

          if (settings.bgReplace === "image" && settings.bgImageUrl) {
            const bgImg = new Image();
            bgImg.onload = () => {
              const tempCanvas = document.createElement("canvas");
              tempCanvas.width = canvas.width;
              tempCanvas.height = canvas.height;
              const tempCtx = tempCanvas.getContext("2d")!;
              // Cover-fit the background image
              const scale = Math.max(canvas.width / bgImg.naturalWidth, canvas.height / bgImg.naturalHeight);
              const w = bgImg.naturalWidth * scale;
              const h = bgImg.naturalHeight * scale;
              tempCtx.drawImage(bgImg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
              if (settings.smoothEdges) {
                tempCtx.drawImage(canvas, 0, 0);
              } else {
                tempCtx.drawImage(img, 0, 0);
              }
              resolve(tempCanvas);
            };
            bgImg.onerror = () => {
              // Fallback: just use transparent result
              if (!settings.smoothEdges) {
                ctx.drawImage(img, 0, 0);
              }
              resolve(canvas);
            };
            bgImg.src = settings.bgImageUrl;
            return;
          }

          // Transparent background (default)
          if (!settings.smoothEdges) {
            ctx.drawImage(img, 0, 0);
          }
          resolve(canvas);
        };
        img.src = URL.createObjectURL(resultBlob);
      });
    },
    [settings],
  );

  const downloadResult = useCallback(
    async (format?: OutputFormat) => {
      if (state.kind !== "result") return;
      const fmt = format ?? settings.outputFormat;
      const canvas = await buildFinalCanvas(state.resultBlob);

      const quality = fmt === "png" ? undefined : settings.outputQuality / 100;
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = state.originalFile.name.replace(/\.[^.]+$/, "") + "-no-bg" + FORMAT_EXT[fmt];
          a.click();
          URL.revokeObjectURL(url);
        },
        FORMAT_MIME[fmt],
        quality,
      );
    },
    [state, settings.outputFormat, settings.outputQuality, buildFinalCanvas],
  );

  const copyToClipboard = useCallback(async () => {
    if (state.kind !== "result") return;
    try {
      const canvas = await buildFinalCanvas(state.resultBlob);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))), "image/png");
      });
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Some browsers don't support clipboard write for images
    }
  }, [state, buildFinalCanvas]);

  // Slider drag logic
  const updateSliderPosition = useCallback((clientX: number) => {
    const container = sliderContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(pct);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSlider.current) return;
      e.preventDefault();
      updateSliderPosition(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingSlider.current) return;
      updateSliderPosition(e.touches[0].clientX);
    };
    const handleUp = () => {
      isDraggingSlider.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [updateSliderPosition]);

  // Background image upload handler
  const handleBgImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setSettings((prev) => {
      if (prev.bgImageUrl) URL.revokeObjectURL(prev.bgImageUrl);
      return {
        ...prev,
        bgReplace: "image",
        bgImageUrl: URL.createObjectURL(file),
        bgImageFile: file,
      };
    });
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Link
          href="/"
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
          aria-label="Back to tools"
        >
          <ArrowLeft size={20} />
        </Link>
        <Scissors size={20} style={{ color: "var(--accent)" }} />
        <h1 className="text-lg font-semibold tracking-tight">Background Remover</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center overflow-auto p-4 md:p-8">
        {/* Upload State */}
        {state.kind === "upload" && (
          <div
            className="w-full max-w-xl"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-full rounded-2xl border-2 border-dashed p-12 md:p-16 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-[var(--accent)] bg-[var(--surface-hover)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-200 ${
                  isDragging ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-hover)] text-[var(--muted)]"
                }`}
              >
                <Upload size={32} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="font-medium text-base mb-1">Drop image here or click to upload</p>
                <p className="text-sm text-[var(--muted)]">PNG, JPG, WebP supported</p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>
        )}

        {/* Processing State */}
        {state.kind === "processing" && (
          <div className="w-full max-w-2xl flex flex-col items-center gap-6">
            <div className="relative w-full rounded-xl overflow-hidden bg-[var(--surface)]">
              <img
                src={state.originalUrl}
                alt="Original"
                className="w-full max-h-[50vh] object-contain opacity-30"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 animate-spin" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="20" stroke="var(--border)" strokeWidth="4" />
                    <path
                      d="M44 24c0-11.046-8.954-20-20-20"
                      stroke="var(--accent)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="font-medium text-sm">{state.statusText}</p>
                <div className="w-full max-w-xs h-2 rounded-full overflow-hidden bg-[var(--border)]">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${state.progress}%`,
                      background: "linear-gradient(90deg, var(--accent), var(--accent-hover))",
                    }}
                  />
                </div>
                <p className="text-xs text-[var(--muted)]">{state.progress}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {state.kind === "error" && (
          <div className="w-full max-w-md flex flex-col items-center gap-5 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[var(--surface-hover)] text-red-500">
              <AlertCircle size={28} />
            </div>
            <div>
              <p className="font-semibold mb-1">Something went wrong</p>
              <p className="text-sm text-[var(--muted)]">{state.message}</p>
            </div>
            <div className="flex gap-3">
              {state.originalFile && (
                <button
                  onClick={() => processImage(state.originalFile!)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  <RotateCcw size={16} />
                  Retry
                </button>
              )}
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-transparent hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {/* Result State */}
        {state.kind === "result" && (
          <div className="w-full max-w-4xl flex flex-col gap-5">
            {/* Before/After Slider */}
            <div
              ref={sliderContainerRef}
              className="relative w-full overflow-hidden rounded-xl select-none touch-none cursor-ew-resize"
              style={{
                background:
                  "repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 0 0 / 16px 16px",
              }}
              onMouseDown={(e) => {
                isDraggingSlider.current = true;
                updateSliderPosition(e.clientX);
              }}
              onTouchStart={(e) => {
                isDraggingSlider.current = true;
                updateSliderPosition(e.touches[0].clientX);
              }}
            >
              {/* After (result) - base layer */}
              <img
                src={state.resultUrl}
                alt="Result with background removed"
                className="w-full block max-h-[65vh] object-contain"
                draggable={false}
              />

              {/* Before (original) - clipped overlay */}
              <div
                className="absolute top-0 left-0 bottom-0 overflow-hidden"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={state.originalUrl}
                  alt="Original image"
                  className="block max-w-none h-full object-contain"
                  style={{ width: containerWidth > 0 ? `${containerWidth}px` : "100vw" }}
                  draggable={false}
                />
              </div>

              {/* Divider line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
                style={{
                  left: `${sliderPosition}%`,
                  transform: "translateX(-50%)",
                  background: "white",
                  boxShadow: "0 0 4px rgba(0,0,0,0.4)",
                }}
              />

              {/* Drag handle */}
              <div
                className="absolute top-1/2 w-9 h-9 rounded-full flex items-center justify-center pointer-events-none"
                style={{
                  left: `${sliderPosition}%`,
                  transform: "translate(-50%, -50%)",
                  background: "white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#333"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="8 4 4 8 8 12" />
                  <polyline points="16 4 20 8 16 12" />
                </svg>
              </div>

              {/* Labels */}
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded text-xs font-medium bg-black/50 text-white pointer-events-none">
                Before
              </div>
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-xs font-medium bg-black/50 text-white pointer-events-none">
                After
              </div>
            </div>

            {/* Info row */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
              <div className="flex flex-wrap gap-4">
                <span>
                  Original: <strong className="text-[var(--foreground)]">{formatBytes(state.originalFile.size)}</strong>
                </span>
                <span>
                  Result: <strong className="text-[var(--foreground)]">{formatBytes(state.resultBlob.size)}</strong>
                </span>
              </div>
              <span>Processed in {state.elapsed}s</span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {/* Download button with format dropdown */}
              <div ref={formatDropdownRef} className="relative">
                <div className="flex">
                  <button
                    onClick={() => downloadResult()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-l-lg text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                  >
                    <Download size={16} />
                    Download {FORMAT_LABELS[settings.outputFormat]}
                  </button>
                  <button
                    onClick={() => setFormatDropdownOpen((v) => !v)}
                    className="flex items-center px-2 py-2.5 rounded-r-lg text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer border-l border-white/20"
                    aria-label="Choose download format"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                {formatDropdownOpen && (
                  <div
                    className="absolute top-full left-0 mt-1 w-44 rounded-lg border shadow-lg overflow-hidden z-10"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface)",
                    }}
                  >
                    {(["png", "jpeg", "webp"] as OutputFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => {
                          setSettings((s) => ({ ...s, outputFormat: fmt }));
                          setFormatDropdownOpen(false);
                          downloadResult(fmt);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      >
                        <Download size={14} />
                        Download as {FORMAT_LABELS[fmt]}
                        {fmt !== "png" && (
                          <span className="text-[var(--muted)] text-xs ml-auto">
                            Q{settings.outputQuality}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                {copySuccess ? (
                  <>
                    <Check size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy to clipboard
                  </>
                )}
              </button>

              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                <RotateCcw size={16} />
                Remove another
              </button>
            </div>

            {/* Settings Panel (collapsible) */}
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sliders size={16} />
                  Output Settings
                </span>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`}
                />
              </button>

              {settingsOpen && (
                <div
                  className="px-4 pb-4 pt-2 border-t grid gap-6 sm:grid-cols-2"
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* Output Quality */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium flex items-center justify-between">
                      Output Quality
                      <span className="text-xs text-[var(--muted)] font-normal">
                        {settings.outputFormat === "png" ? "N/A for PNG" : `${settings.outputQuality}%`}
                      </span>
                    </label>
                    <input
                      type="range"
                      min={60}
                      max={100}
                      value={settings.outputQuality}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, outputQuality: Number(e.target.value) }))
                      }
                      disabled={settings.outputFormat === "png"}
                      className="w-full accent-[var(--accent)] disabled:opacity-40"
                    />
                    <div className="flex justify-between text-xs text-[var(--muted)]">
                      <span>60</span>
                      <span>100</span>
                    </div>
                  </div>

                  {/* Output Format */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Output Format</label>
                    <div className="flex gap-1 rounded-lg p-1 bg-[var(--background)]">
                      {(["png", "jpeg", "webp"] as OutputFormat[]).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setSettings((s) => ({ ...s, outputFormat: fmt }))}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                            settings.outputFormat === fmt
                              ? "bg-[var(--accent)] text-white"
                              : "hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          {FORMAT_LABELS[fmt]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Replace */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Background Replace</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-1 rounded-lg p-1 bg-[var(--background)]">
                        {(
                          [
                            { value: "transparent", label: "None" },
                            { value: "color", label: "Color" },
                            { value: "image", label: "Image" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setSettings((s) => ({ ...s, bgReplace: opt.value }))}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                              settings.bgReplace === opt.value
                                ? "bg-[var(--accent)] text-white"
                                : "hover:bg-[var(--surface-hover)]"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {settings.bgReplace === "color" && (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={settings.bgColor}
                            onChange={(e) =>
                              setSettings((s) => ({ ...s, bgColor: e.target.value }))
                            }
                            className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer"
                          />
                          <input
                            type="text"
                            value={settings.bgColor}
                            onChange={(e) =>
                              setSettings((s) => ({ ...s, bgColor: e.target.value }))
                            }
                            className="flex-1 px-2 py-1.5 text-xs rounded-md border border-[var(--border)] bg-[var(--background)]"
                            spellCheck={false}
                          />
                        </div>
                      )}

                      {settings.bgReplace === "image" && (
                        <div>
                          <button
                            onClick={() => bgImageInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-2 text-xs rounded-md border border-dashed border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer w-full"
                          >
                            <ImageIcon size={14} />
                            {settings.bgImageFile
                              ? settings.bgImageFile.name
                              : "Upload background image"}
                          </button>
                          <input
                            ref={bgImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleBgImageUpload}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edge Refinement */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Edge Refinement</label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <button
                        role="switch"
                        aria-checked={settings.smoothEdges}
                        onClick={() =>
                          setSettings((s) => ({ ...s, smoothEdges: !s.smoothEdges }))
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 cursor-pointer ${
                          settings.smoothEdges ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${
                            settings.smoothEdges ? "translate-x-5 ml-0.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      <span className="text-sm">Smooth edges</span>
                    </label>
                    <p className="text-xs text-[var(--muted)]">
                      Applies a subtle feather to the alpha mask for softer edges
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
