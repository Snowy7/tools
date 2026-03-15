"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";

type AppState =
  | { kind: "upload" }
  | { kind: "processing"; originalUrl: string; originalFile: File; statusText: string; progress: number }
  | { kind: "result"; originalUrl: string; resultUrl: string; originalFile: File; resultBlob: Blob; elapsed: number }
  | { kind: "error"; message: string; originalFile: File | null };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackgroundRemoverPage() {
  const [state, setState] = useState<AppState>({ kind: "upload" });
  const [isDragging, setIsDragging] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [copySuccess, setCopySuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);

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

      const elapsed = Math.round((performance.now() - startTime) / 1000 * 10) / 10;
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [cleanupUrls]);

  const downloadPng = useCallback(() => {
    if (state.kind !== "result") return;
    const a = document.createElement("a");
    a.href = state.resultUrl;
    a.download = state.originalFile.name.replace(/\.[^.]+$/, "") + "-no-bg.png";
    a.click();
  }, [state]);

  const downloadJpeg = useCallback(() => {
    if (state.kind !== "result") return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = state.originalFile.name.replace(/\.[^.]+$/, "") + "-no-bg.jpg";
          a.click();
          URL.revokeObjectURL(url);
        },
        "image/jpeg",
        0.92,
      );
    };
    img.src = state.resultUrl;
  }, [state]);

  const copyToClipboard = useCallback(async () => {
    if (state.kind !== "result") return;
    try {
      const item = new ClipboardItem({ "image/png": state.resultBlob });
      await navigator.clipboard.write([item]);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback: some browsers don't support clipboard write for images
    }
  }, [state]);

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
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Background Remover</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center overflow-auto p-4 md:p-8">
        {/* ── Upload State ── */}
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
              className="w-full rounded-2xl border-2 border-dashed p-12 md:p-16 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200"
              style={{
                borderColor: isDragging ? "var(--accent)" : "var(--border)",
                background: isDragging ? "var(--surface-hover)" : "var(--surface)",
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-200"
                style={{
                  background: isDragging ? "var(--accent)" : "var(--surface-hover)",
                  color: isDragging ? "#ffffff" : "var(--muted)",
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-medium text-base mb-1">Drop image here or click to upload</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  PNG, JPG, WebP supported
                </p>
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

        {/* ── Processing State ── */}
        {state.kind === "processing" && (
          <div className="w-full max-w-2xl flex flex-col items-center gap-6">
            <div className="relative w-full rounded-xl overflow-hidden" style={{ background: "var(--surface)" }}>
              <img
                src={state.originalUrl}
                alt="Original"
                className="w-full max-h-[50vh] object-contain opacity-30"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                {/* Animated spinner */}
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 animate-spin" viewBox="0 0 48 48" fill="none">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="var(--border)"
                      strokeWidth="4"
                    />
                    <path
                      d="M44 24c0-11.046-8.954-20-20-20"
                      stroke="var(--accent)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="font-medium text-sm">{state.statusText}</p>
                {/* Progress bar */}
                <div
                  className="w-full max-w-xs h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--border)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${state.progress}%`,
                      background: "linear-gradient(90deg, var(--accent), var(--accent-hover))",
                    }}
                  />
                </div>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {state.progress}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {state.kind === "error" && (
          <div className="w-full max-w-md flex flex-col items-center gap-5 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "var(--surface-hover)", color: "#ef4444" }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <p className="font-semibold mb-1">Something went wrong</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {state.message}
              </p>
            </div>
            <div className="flex gap-3">
              {state.originalFile && (
                <button
                  onClick={() => processImage(state.originalFile!)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
                  style={{ background: "var(--accent)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  Retry
                </button>
              )}
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer"
                style={{ borderColor: "var(--border)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {/* ── Result State ── */}
        {state.kind === "result" && (
          <div className="w-full max-w-4xl flex flex-col gap-5">
            {/* Before/After Slider */}
            <div
              ref={sliderContainerRef}
              className="relative w-full rounded-xl overflow-hidden select-none touch-none"
              style={{
                background:
                  "repeating-conic-gradient(var(--border) 0% 25%, var(--surface) 0% 50%) 0 0 / 20px 20px",
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
              {/* Result image (full width, on bottom) */}
              <img
                src={state.resultUrl}
                alt="Result with background removed"
                className="w-full max-h-[55vh] object-contain block"
                draggable={false}
              />

              {/* Original image (clipped from right) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={state.originalUrl}
                  alt="Original image"
                  className="w-full max-h-[55vh] object-contain block"
                  style={{
                    width: sliderContainerRef.current
                      ? `${sliderContainerRef.current.offsetWidth}px`
                      : "100%",
                    maxHeight: "55vh",
                  }}
                  draggable={false}
                />
              </div>

              {/* Divider line */}
              <div
                className="absolute top-0 bottom-0 w-0.5"
                style={{
                  left: `${sliderPosition}%`,
                  transform: "translateX(-50%)",
                  background: "white",
                  boxShadow: "0 0 4px rgba(0,0,0,0.4)",
                }}
              />

              {/* Drag handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center cursor-ew-resize"
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
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded text-xs font-medium bg-black/50 text-white">
                Before
              </div>
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-xs font-medium bg-black/50 text-white">
                After
              </div>
            </div>

            {/* Info row */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: "var(--muted)" }}>
              <div className="flex flex-wrap gap-4">
                <span>
                  Original: <strong style={{ color: "var(--foreground)" }}>{formatBytes(state.originalFile.size)}</strong>
                </span>
                <span>
                  Result: <strong style={{ color: "var(--foreground)" }}>{formatBytes(state.resultBlob.size)}</strong>
                </span>
              </div>
              <span>Processed in {state.elapsed}s</span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={downloadPng}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
                style={{ background: "var(--accent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PNG
                <span className="opacity-70">({formatBytes(state.resultBlob.size)})</span>
              </button>

              <button
                onClick={downloadJpeg}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download JPEG
              </button>

              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              >
                {copySuccess ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy to clipboard
                  </>
                )}
              </button>

              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Remove another
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
