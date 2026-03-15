"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Gamepad2,
  Upload,
} from "lucide-react";
import { packSprites } from "@/lib/sprite-sheet";

interface UploadedSprite {
  name: string;
  width: number;
  height: number;
  image: HTMLImageElement;
}

export default function SpriteSheetStudioPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sprites, setSprites] = useState<UploadedSprite[]>([]);
  const [columns, setColumns] = useState(4);
  const [padding, setPadding] = useState(4);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);

  const packed = useMemo(
    () => packSprites(sprites.map((sprite) => ({ name: sprite.name, width: sprite.width, height: sprite.height })), columns, padding),
    [sprites, columns, padding],
  );

  async function handleFiles(fileList: FileList) {
    const nextSprites = await Promise.all(
      Array.from(fileList).map(
        (file) =>
          new Promise<UploadedSprite>((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => resolve({ name: file.name.replace(/\.[^.]+$/, ""), width: image.naturalWidth, height: image.naturalHeight, image });
            image.onerror = reject;
            image.src = url;
          }),
      ),
    );

    setSprites(nextSprites);
  }

  function buildAtlasCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = packed.width;
    canvas.height = packed.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas is unavailable");
    }
    ctx.clearRect(0, 0, packed.width, packed.height);
    packed.sprites.forEach((placement) => {
      const source = sprites.find((sprite) => sprite.name === placement.name);
      if (source) {
        ctx.drawImage(source.image, placement.x, placement.y);
      }
    });
    return canvas;
  }

  function buildMetadata(): string {
    return JSON.stringify(
      {
        meta: {
          width: packed.width,
          height: packed.height,
          columns: packed.columns,
          rows: packed.rows,
          padding,
        },
        frames: packed.sprites.reduce<Record<string, { x: number; y: number; width: number; height: number }>>((accumulator, sprite) => {
          accumulator[sprite.name] = {
            x: sprite.x,
            y: sprite.y,
            width: sprite.width,
            height: sprite.height,
          };
          return accumulator;
        }, {}),
      },
      null,
      2,
    );
  }

  function downloadAtlas() {
    const canvas = buildAtlasCanvas();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "sprite-atlas.png";
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function downloadMetadata() {
    const blob = new Blob([buildMetadata()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sprite-atlas.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyMetadata() {
    await navigator.clipboard.writeText(buildMetadata());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) {
      void handleFiles(event.dataTransfer.files);
    }
  }, []);

  const hasSprites = sprites.length > 0;

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
          <Gamepad2 size={14} />
          <span className="text-sm font-semibold">Sprite Sheet Studio</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
          >
            <Upload size={12} />
            Upload
          </button>
          {hasSprites && (
            <>
              <button
                type="button"
                onClick={downloadAtlas}
                className="inline-flex items-center gap-1.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] text-xs px-2.5 py-1"
              >
                <Download size={12} />
                Atlas PNG
              </button>
              <button
                type="button"
                onClick={downloadMetadata}
                className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
              >
                <Download size={12} />
                JSON
              </button>
            </>
          )}
        </div>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void handleFiles(event.target.files);
        }}
      />

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {!hasSprites ? (
          /* Empty state: centered drop zone */
          <div className="flex-1 flex items-center justify-center p-8">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-4 w-full max-w-md py-16 px-8 rounded-xl border-2 border-dashed transition-colors ${
                dragging
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
                  Select multiple PNGs or WebPs
                </p>
              </div>
            </button>
          </div>
        ) : (
          /* Three-panel layout */
          <>
            {/* Left sidebar */}
            <div className="w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto flex flex-col">
              {/* Sprite thumbnails */}
              <div className="p-3 border-b border-[var(--border)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                  Frames ({sprites.length})
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {sprites.map((sprite) => (
                    <div
                      key={sprite.name}
                      className="aspect-square rounded border border-[var(--border)] bg-[var(--background)] overflow-hidden flex items-center justify-center p-0.5"
                      title={sprite.name}
                    >
                      <img
                        src={sprite.image.src}
                        alt={sprite.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div className="p-3 border-b border-[var(--border)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
                  Settings
                </p>
                <div className="space-y-3">
                  <label className="block">
                    <span className="flex items-center justify-between text-xs text-[var(--foreground)] mb-1">
                      Columns
                      <span className="font-semibold">{columns}</span>
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={columns}
                      onChange={(event) => setColumns(Number(event.target.value))}
                      className="w-full h-1 rounded-full appearance-none bg-[var(--border)] accent-[var(--accent)]"
                    />
                  </label>
                  <label className="block">
                    <span className="flex items-center justify-between text-xs text-[var(--foreground)] mb-1">
                      Padding
                      <span className="font-semibold">{padding}px</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={32}
                      value={padding}
                      onChange={(event) => setPadding(Number(event.target.value))}
                      className="w-full h-1 rounded-full appearance-none bg-[var(--border)] accent-[var(--accent)]"
                    />
                  </label>
                </div>
              </div>

              {/* Stats */}
              <div className="p-3 border-b border-[var(--border)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                  Stats
                </p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Atlas size</span>
                    <span className="font-semibold text-[var(--foreground)]">{packed.width} x {packed.height}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Frame count</span>
                    <span className="font-semibold text-[var(--foreground)]">{sprites.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Grid</span>
                    <span className="font-semibold text-[var(--foreground)]">{packed.columns} x {packed.rows}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-3 space-y-1.5">
                <button
                  type="button"
                  onClick={downloadAtlas}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] text-xs px-2.5 py-1.5 font-medium"
                >
                  <Download size={12} />
                  Download Atlas PNG
                </button>
                <button
                  type="button"
                  onClick={downloadMetadata}
                  className="w-full inline-flex items-center justify-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1.5 text-[var(--foreground)] font-medium"
                >
                  <Download size={12} />
                  Download JSON
                </button>
                <button
                  type="button"
                  onClick={copyMetadata}
                  className="w-full inline-flex items-center justify-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1.5 text-[var(--foreground)] font-medium"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy JSON"}
                </button>
              </div>
            </div>

            {/* Center: Atlas preview */}
            <div className="flex-1 overflow-auto p-4">
              <div
                className="inline-block rounded-lg p-4"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, var(--border) 25%, transparent 25%), linear-gradient(-45deg, var(--border) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--border) 75%), linear-gradient(-45deg, transparent 75%, var(--border) 75%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                }}
              >
                <div
                  className="relative"
                  style={{ width: packed.width, height: packed.height }}
                >
                  {packed.sprites.map((sprite) => {
                    const source = sprites.find((item) => item.name === sprite.name);
                    return source ? (
                      <img
                        key={sprite.name}
                        src={source.image.src}
                        alt={sprite.name}
                        className="absolute"
                        style={{ left: sprite.x, top: sprite.y, width: sprite.width, height: sprite.height }}
                      />
                    ) : null;
                  })}
                </div>
              </div>
            </div>

            {/* Right sidebar: JSON metadata */}
            <div className="w-72 flex-shrink-0 border-l border-[var(--border)] bg-[var(--surface)] overflow-y-auto flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Frame Metadata
                </span>
                <button
                  type="button"
                  onClick={copyMetadata}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-3 text-xs leading-5 font-mono text-[var(--foreground)] bg-[var(--background)]">
                {buildMetadata()}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
