"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Palette, Upload } from "lucide-react";
import { extractPaletteFromPixels } from "@/lib/palette";

interface ExtractedState {
  imageUrl: string;
  palette: { hex: string; weight: number }[];
}

export default function PaletteExtractorPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ExtractedState | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [colorCount, setColorCount] = useState(8);
  const [isDragging, setIsDragging] = useState(false);

  const cssVariables = useMemo(() => {
    if (!state) return "";
    return state.palette
      .map((color, index) => `--palette-${index + 1}: ${color.hex};`)
      .join("\n");
  }, [state]);

  async function handleUpload(file: File) {
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const palette = extractPaletteFromPixels(imageData.data, colorCount, 24).map((color) => ({
        hex: color.hex,
        weight: color.weight,
      }));
      setState((previous) => {
        if (previous) URL.revokeObjectURL(previous.imageUrl);
        return { imageUrl, palette };
      });
    };
    img.src = imageUrl;
  }

  const reExtract = useCallback(
    (count: number) => {
      if (!state) return;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const palette = extractPaletteFromPixels(imageData.data, count, 24).map((color) => ({
          hex: color.hex,
          weight: color.weight,
        }));
        setState((prev) => (prev ? { ...prev, palette } : prev));
      };
      img.src = state.imageUrl;
    },
    [state],
  );

  async function copyText(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1500);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      void handleUpload(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

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
        <Palette size={20} style={{ color: "var(--accent)" }} />
        <h1 className="text-lg font-semibold tracking-tight">Palette Extractor</h1>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "var(--accent)", color: "#fff" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
        >
          <Upload size={15} />
          Upload
        </button>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
          event.target.value = "";
        }}
      />

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {!state ? (
          /* No image: centered drop zone */
          <div
            className="flex-1 flex items-center justify-center p-4 md:p-8"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`w-full max-w-lg rounded-2xl border-2 border-dashed p-10 md:p-14 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-[var(--accent)] bg-[var(--surface-hover)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-200 ${
                  isDragging ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-hover)] text-[var(--muted)]"
                }`}
              >
                <Upload size={28} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm mb-0.5">Drop image here or click to upload</p>
                <p className="text-xs text-[var(--muted)]">PNG, JPG, WebP, screenshots, paintings, cover art</p>
              </div>
            </button>
          </div>
        ) : (
          /* Image loaded: two-panel layout */
          <>
            {/* Left: Image preview */}
            <div
              className="flex-1 flex items-center justify-center overflow-auto p-4 md:p-8"
              style={{ background: "var(--background)" }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <img
                src={state.imageUrl}
                alt="Uploaded palette source"
                className="max-w-full max-h-full object-contain rounded-xl border"
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            {/* Right sidebar */}
            <aside
              className="w-80 shrink-0 border-l overflow-y-auto flex flex-col"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="p-4 flex flex-col gap-5">
                {/* Upload new */}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Upload size={15} />
                  Upload new image
                </button>

                {/* Color count slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--muted)]">Color count</span>
                    <span className="text-xs font-medium tabular-nums">{colorCount}</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={12}
                    value={colorCount}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      setColorCount(count);
                      reExtract(count);
                    }}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>

                {/* Dominant Colors */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                      Dominant Colors
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(state.palette.map((c) => c.hex).join(", "), "hex")}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ color: "var(--muted)" }}
                    >
                      {copied === "hex" ? <Check size={12} /> : <Copy size={12} />}
                      {copied === "hex" ? "Copied" : "Copy all"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {state.palette.map((color) => (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => copyText(color.hex, color.hex)}
                        className="flex items-center gap-3 p-2 rounded-lg text-left transition-colors hover:bg-[var(--surface-hover)]"
                      >
                        <span
                          className="w-10 h-10 rounded-lg shrink-0 border"
                          style={{ backgroundColor: color.hex, borderColor: "var(--border)" }}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium">{color.hex}</span>
                          <span className="block text-xs text-[var(--muted)]">
                            {(color.weight * 100).toFixed(1)}%
                          </span>
                        </span>
                        <span className="text-[11px] text-[var(--muted)]">
                          {copied === color.hex ? "Copied" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CSS Variables */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                      CSS Variables
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(cssVariables, "css")}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ color: "var(--muted)" }}
                    >
                      {copied === "css" ? <Check size={12} /> : <Copy size={12} />}
                      {copied === "css" ? "Copied" : "Copy CSS"}
                    </button>
                  </div>
                  <pre
                    className="overflow-auto rounded-lg p-3 text-xs leading-6 border"
                    style={{
                      background: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    {cssVariables}
                  </pre>
                </div>
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
