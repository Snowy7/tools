"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Grid3X3,
  Upload,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  MousePointer2,
  Wand2,
  ClipboardCopy,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TileInfo {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TilemapSlicerPage() {
  // Image state
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tile settings
  const [tileWidth, setTileWidth] = useState(32);
  const [tileHeight, setTileHeight] = useState(32);
  const [margin, setMargin] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // Grid overlay settings
  const [showGrid, setShowGrid] = useState(true);
  const [gridColor, setGridColor] = useState("#ff0000");
  const [gridOpacity, setGridOpacity] = useState(0.5);
  const [gridLineWidth, setGridLineWidth] = useState(1);

  // Selection
  const [selectedTiles, setSelectedTiles] = useState<Set<number>>(new Set());
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragStart, setDragStart] = useState<{ row: number; col: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ row: number; col: number } | null>(null);
  const [dragAddMode, setDragAddMode] = useState(true);

  // Zoom / pan
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  // UI
  const [copiedMeta, setCopiedMeta] = useState(false);
  const [sectionOpen, setSectionOpen] = useState({ tileSize: true, gridOverlay: true, selection: true });

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Compute tiles
  // -------------------------------------------------------------------------

  const tiles = useMemo<TileInfo[]>(() => {
    if (!image) return [];
    const result: TileInfo[] = [];
    let id = 0;
    const stepX = tileWidth + margin;
    const stepY = tileHeight + margin;
    const cols = Math.floor((image.naturalWidth - offsetX + margin) / stepX);
    const rows = Math.floor((image.naturalHeight - offsetY + margin) / stepY);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        result.push({
          id,
          row,
          col,
          x: offsetX + col * stepX,
          y: offsetY + row * stepY,
          width: tileWidth,
          height: tileHeight,
        });
        id++;
      }
    }
    return result;
  }, [image, tileWidth, tileHeight, margin, offsetX, offsetY]);

  const columns = useMemo(() => {
    if (!image) return 0;
    const stepX = tileWidth + margin;
    return Math.floor((image.naturalWidth - offsetX + margin) / stepX);
  }, [image, tileWidth, margin, offsetX]);

  const rows = useMemo(() => {
    if (!image) return 0;
    const stepY = tileHeight + margin;
    return Math.floor((image.naturalHeight - offsetY + margin) / stepY);
  }, [image, tileHeight, margin, offsetY]);

  // -------------------------------------------------------------------------
  // Image loading
  // -------------------------------------------------------------------------

  const loadImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageUrl(url);
      setSelectedTiles(new Set());
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    };
    img.src = url;
  }, []);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const file = fileList[0];
      if (file && (file.type === "image/png" || file.type === "image/webp")) {
        loadImage(file);
      }
    },
    [loadImage],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      if (event.dataTransfer.files?.length) {
        handleFiles(event.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  // -------------------------------------------------------------------------
  // Auto-detect tile size
  // -------------------------------------------------------------------------

  const autoDetectTileSize = useCallback(() => {
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;

    // Detect empty columns (alpha < 10 for entire column)
    function isEmptyColumn(x: number): boolean {
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] > 10) return false;
      }
      return true;
    }

    function isEmptyRow(y: number): boolean {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] > 10) return false;
      }
      return true;
    }

    // Find first non-empty column/row for offset
    let detectedOffsetX = 0;
    for (let x = 0; x < width; x++) {
      if (!isEmptyColumn(x)) { detectedOffsetX = x; break; }
    }
    let detectedOffsetY = 0;
    for (let y = 0; y < height; y++) {
      if (!isEmptyRow(y)) { detectedOffsetY = y; break; }
    }

    // Find first empty column after offset to guess tile width
    let detectedWidth = 32;
    for (let x = detectedOffsetX + 1; x < width; x++) {
      if (isEmptyColumn(x)) {
        detectedWidth = x - detectedOffsetX;
        break;
      }
    }

    let detectedHeight = 32;
    for (let y = detectedOffsetY + 1; y < height; y++) {
      if (isEmptyRow(y)) {
        detectedHeight = y - detectedOffsetY;
        break;
      }
    }

    // Clamp to valid ranges
    setTileWidth(clamp(detectedWidth, 8, 256));
    setTileHeight(clamp(detectedHeight, 8, 256));
    setOffsetX(clamp(detectedOffsetX, 0, 32));
    setOffsetY(clamp(detectedOffsetY, 0, 32));
  }, [image]);

  // -------------------------------------------------------------------------
  // Canvas rendering
  // -------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displayWidth = image.naturalWidth * zoom;
    const displayHeight = image.naturalHeight * zoom;
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.imageSmoothingEnabled = zoom < 1;
    ctx.drawImage(image, 0, 0, displayWidth, displayHeight);

    // Draw selection overlay
    const selectionColor = "rgba(59, 130, 246, 0.3)";
    for (const tile of tiles) {
      if (selectedTiles.has(tile.id)) {
        ctx.fillStyle = selectionColor;
        ctx.fillRect(tile.x * zoom, tile.y * zoom, tile.width * zoom, tile.height * zoom);
      }
    }

    // Draw drag-selection preview
    if (isDragSelecting && dragStart && dragEnd) {
      const minRow = Math.min(dragStart.row, dragEnd.row);
      const maxRow = Math.max(dragStart.row, dragEnd.row);
      const minCol = Math.min(dragStart.col, dragEnd.col);
      const maxCol = Math.max(dragStart.col, dragEnd.col);
      const previewColor = dragAddMode ? "rgba(59, 130, 246, 0.2)" : "rgba(239, 68, 68, 0.2)";
      for (const tile of tiles) {
        if (tile.row >= minRow && tile.row <= maxRow && tile.col >= minCol && tile.col <= maxCol) {
          if (dragAddMode ? !selectedTiles.has(tile.id) : selectedTiles.has(tile.id)) {
            ctx.fillStyle = previewColor;
            ctx.fillRect(tile.x * zoom, tile.y * zoom, tile.width * zoom, tile.height * zoom);
          }
        }
      }
    }

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = gridColor + Math.round(gridOpacity * 255).toString(16).padStart(2, "0");
      ctx.lineWidth = gridLineWidth;
      for (const tile of tiles) {
        ctx.strokeRect(
          tile.x * zoom + 0.5,
          tile.y * zoom + 0.5,
          tile.width * zoom - 1,
          tile.height * zoom - 1,
        );
      }
    }
  }, [image, zoom, tiles, selectedTiles, showGrid, gridColor, gridOpacity, gridLineWidth, isDragSelecting, dragStart, dragEnd, dragAddMode]);

  // -------------------------------------------------------------------------
  // Canvas interaction - tile clicks and drag selection
  // -------------------------------------------------------------------------

  const getTileAtCanvasPos = useCallback(
    (clientX: number, clientY: number): TileInfo | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / zoom;
      const y = (clientY - rect.top) / zoom;
      for (const tile of tiles) {
        if (x >= tile.x && x < tile.x + tile.width && y >= tile.y && y < tile.y + tile.height) {
          return tile;
        }
      }
      return null;
    },
    [tiles, zoom],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        // Middle click or alt+click = pan
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY, offsetX: panOffset.x, offsetY: panOffset.y };
        e.preventDefault();
        return;
      }
      if (e.button !== 0) return;

      const tile = getTileAtCanvasPos(e.clientX, e.clientY);
      if (!tile) return;

      // Start drag selection
      setIsDragSelecting(true);
      setDragStart({ row: tile.row, col: tile.col });
      setDragEnd({ row: tile.row, col: tile.col });
      setDragAddMode(!selectedTiles.has(tile.id));
    },
    [getTileAtCanvasPos, selectedTiles, panOffset],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPanOffset({
          x: panStartRef.current.offsetX + (e.clientX - panStartRef.current.x),
          y: panStartRef.current.offsetY + (e.clientY - panStartRef.current.y),
        });
        return;
      }
      if (!isDragSelecting) return;
      const tile = getTileAtCanvasPos(e.clientX, e.clientY);
      if (tile) {
        setDragEnd({ row: tile.row, col: tile.col });
      }
    },
    [isDragSelecting, isPanning, getTileAtCanvasPos],
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (!isDragSelecting || !dragStart || !dragEnd) {
      setIsDragSelecting(false);
      return;
    }

    const minRow = Math.min(dragStart.row, dragEnd.row);
    const maxRow = Math.max(dragStart.row, dragEnd.row);
    const minCol = Math.min(dragStart.col, dragEnd.col);
    const maxCol = Math.max(dragStart.col, dragEnd.col);

    setSelectedTiles((prev) => {
      const next = new Set(prev);
      for (const tile of tiles) {
        if (tile.row >= minRow && tile.row <= maxRow && tile.col >= minCol && tile.col <= maxCol) {
          if (dragAddMode) {
            next.add(tile.id);
          } else {
            next.delete(tile.id);
          }
        }
      }
      return next;
    });

    setIsDragSelecting(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragSelecting, dragStart, dragEnd, tiles, dragAddMode]);

  // -------------------------------------------------------------------------
  // Zoom
  // -------------------------------------------------------------------------

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prev) => clamp(prev * delta, 0.1, 10));
    },
    [],
  );

  const fitZoom = useCallback(() => {
    if (!image || !containerRef.current) return;
    const container = containerRef.current;
    const scaleX = (container.clientWidth - 32) / image.naturalWidth;
    const scaleY = (container.clientHeight - 32) / image.naturalHeight;
    setZoom(Math.min(scaleX, scaleY, 1));
    setPanOffset({ x: 0, y: 0 });
  }, [image]);

  // -------------------------------------------------------------------------
  // Selection helpers
  // -------------------------------------------------------------------------

  const selectAll = useCallback(() => {
    setSelectedTiles(new Set(tiles.map((t) => t.id)));
  }, [tiles]);

  const deselectAll = useCallback(() => {
    setSelectedTiles(new Set());
  }, []);

  const invertSelection = useCallback(() => {
    setSelectedTiles((prev) => {
      const next = new Set<number>();
      for (const tile of tiles) {
        if (!prev.has(tile.id)) next.add(tile.id);
      }
      return next;
    });
  }, [tiles]);

  const toggleTile = useCallback((id: number) => {
    setSelectedTiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Tile extraction
  // -------------------------------------------------------------------------

  function extractTileBlob(tile: TileInfo): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!image) { resolve(null); return; }
      const canvas = document.createElement("canvas");
      canvas.width = tile.width;
      canvas.height = tile.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(image, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadTiles(tilesToExport: TileInfo[]) {
    for (const tile of tilesToExport) {
      const blob = await extractTileBlob(tile);
      if (blob) {
        downloadBlob(blob, `tile_${tile.row}_${tile.col}.png`);
        // Small delay to prevent browser throttling
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }

  function downloadSelectedTiles() {
    const selected = tiles.filter((t) => selectedTiles.has(t.id));
    if (selected.length === 0) return;
    void downloadTiles(selected);
  }

  function downloadAllTiles() {
    void downloadTiles(tiles);
  }

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  function buildMetadata(tilesToInclude?: TileInfo[]): string {
    const included = tilesToInclude ?? tiles;
    return JSON.stringify(
      {
        tileWidth,
        tileHeight,
        columns,
        rows,
        tiles: included.map((t) => ({
          id: t.id,
          row: t.row,
          col: t.col,
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.height,
        })),
      },
      null,
      2,
    );
  }

  function downloadMetadata() {
    const blob = new Blob([buildMetadata()], { type: "application/json" });
    downloadBlob(blob, "tilemap-metadata.json");
  }

  async function copyMetadata() {
    await navigator.clipboard.writeText(buildMetadata());
    setCopiedMeta(true);
    window.setTimeout(() => setCopiedMeta(false), 1500);
  }

  // -------------------------------------------------------------------------
  // Section toggle helper
  // -------------------------------------------------------------------------

  function toggleSection(key: keyof typeof sectionOpen) {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // -------------------------------------------------------------------------
  // Tile thumbnail generation
  // -------------------------------------------------------------------------

  function getTileThumbnailUrl(tile: TileInfo): string {
    if (!image) return "";
    const canvas = document.createElement("canvas");
    canvas.width = tile.width;
    canvas.height = tile.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(image, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
    return canvas.toDataURL("image/png");
  }

  // Cache thumbnails
  const tileThumbnails = useMemo(() => {
    if (!image || tiles.length === 0) return new Map<number, string>();
    const map = new Map<number, string>();
    for (const tile of tiles) {
      map.set(tile.id, getTileThumbnailUrl(tile));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, tiles]);

  // -------------------------------------------------------------------------
  // Number input helper
  // -------------------------------------------------------------------------

  function NumberInput({
    label,
    value,
    onChange,
    min,
    max,
    suffix,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    suffix?: string;
  }) {
    return (
      <label className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--muted)] whitespace-nowrap">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(clamp(Number(e.target.value) || min, min, max))}
            className="w-16 text-right text-xs bg-[var(--background)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
          />
          {suffix && <span className="text-[10px] text-[var(--muted)]">{suffix}</span>}
        </div>
      </label>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const hasImage = image !== null;
  const selectedCount = selectedTiles.size;

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
          <Grid3X3 size={14} />
          <span className="text-sm font-semibold">Tilemap Slicer</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {hasImage && (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
              >
                <Upload size={12} />
                Replace
              </button>
              <button
                type="button"
                onClick={downloadSelectedTiles}
                disabled={selectedCount === 0}
                className="inline-flex items-center gap-1.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] text-xs px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={12} />
                Selected ({selectedCount})
              </button>
              <button
                type="button"
                onClick={downloadAllTiles}
                disabled={tiles.length === 0}
                className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)] disabled:opacity-40"
              >
                <Download size={12} />
                All Tiles
              </button>
              <button
                type="button"
                onClick={downloadMetadata}
                className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
              >
                <Download size={12} />
                JSON
              </button>
              <button
                type="button"
                onClick={copyMetadata}
                className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
              >
                {copiedMeta ? <Check size={12} /> : <ClipboardCopy size={12} />}
                {copiedMeta ? "Copied" : "Copy JSON"}
              </button>
            </>
          )}
        </div>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
        }}
      />

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {!hasImage ? (
          /* Empty state: centered drop zone */
          <div className="flex-1 flex items-center justify-center p-8">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
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
                  Drop a tileset image or click to upload
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Supports PNG and WebP tileset images
                </p>
              </div>
            </button>
          </div>
        ) : (
          <>
            {/* Left sidebar */}
            <div className="w-72 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto flex flex-col">
              {/* Tile Size section */}
              <div className="border-b border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => toggleSection("tileSize")}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--surface-hover)]"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Tile Size
                  </span>
                  {sectionOpen.tileSize ? <ChevronDown size={12} className="text-[var(--muted)]" /> : <ChevronRight size={12} className="text-[var(--muted)]" />}
                </button>
                {sectionOpen.tileSize && (
                  <div className="px-3 pb-3 space-y-2">
                    <NumberInput label="Width" value={tileWidth} onChange={setTileWidth} min={8} max={256} suffix="px" />
                    <NumberInput label="Height" value={tileHeight} onChange={setTileHeight} min={8} max={256} suffix="px" />
                    <NumberInput label="Margin" value={margin} onChange={setMargin} min={0} max={16} suffix="px" />
                    <NumberInput label="Offset X" value={offsetX} onChange={setOffsetX} min={0} max={32} suffix="px" />
                    <NumberInput label="Offset Y" value={offsetY} onChange={setOffsetY} min={0} max={32} suffix="px" />
                    <button
                      type="button"
                      onClick={autoDetectTileSize}
                      className="w-full inline-flex items-center justify-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1.5 text-[var(--foreground)] font-medium mt-1"
                    >
                      <Wand2 size={12} />
                      Auto-detect
                    </button>
                  </div>
                )}
              </div>

              {/* Grid Overlay section */}
              <div className="border-b border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => toggleSection("gridOverlay")}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--surface-hover)]"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Grid Overlay
                  </span>
                  {sectionOpen.gridOverlay ? <ChevronDown size={12} className="text-[var(--muted)]" /> : <ChevronRight size={12} className="text-[var(--muted)]" />}
                </button>
                {sectionOpen.gridOverlay && (
                  <div className="px-3 pb-3 space-y-2">
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[var(--muted)]">Show grid</span>
                      <button
                        type="button"
                        onClick={() => setShowGrid((v) => !v)}
                        className={`w-8 h-4.5 rounded-full relative transition-colors ${
                          showGrid ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                            showGrid ? "left-[calc(100%-1rem)]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[var(--muted)]">Color</span>
                      <input
                        type="color"
                        value={gridColor}
                        onChange={(e) => setGridColor(e.target.value)}
                        className="w-6 h-6 rounded border border-[var(--border)] cursor-pointer bg-transparent"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[var(--muted)]">Opacity</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={gridOpacity}
                        onChange={(e) => setGridOpacity(Number(e.target.value))}
                        className="w-20 h-1 rounded-full appearance-none bg-[var(--border)] accent-[var(--accent)]"
                      />
                    </label>
                    <NumberInput label="Line width" value={gridLineWidth} onChange={setGridLineWidth} min={1} max={3} suffix="px" />
                  </div>
                )}
              </div>

              {/* Selection section */}
              <div className="border-b border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => toggleSection("selection")}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--surface-hover)]"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Selection
                  </span>
                  {sectionOpen.selection ? <ChevronDown size={12} className="text-[var(--muted)]" /> : <ChevronRight size={12} className="text-[var(--muted)]" />}
                </button>
                {sectionOpen.selection && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">Selected</span>
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        {selectedCount} / {tiles.length}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="flex-1 text-[10px] border border-[var(--border)] rounded px-1.5 py-1 hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={deselectAll}
                        className="flex-1 text-[10px] border border-[var(--border)] rounded px-1.5 py-1 hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                      >
                        None
                      </button>
                      <button
                        type="button"
                        onClick={invertSelection}
                        className="flex-1 text-[10px] border border-[var(--border)] rounded px-1.5 py-1 hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                      >
                        Invert
                      </button>
                    </div>
                    <p className="text-[10px] text-[var(--muted)] leading-relaxed">
                      Click a tile to select. Drag to select multiple. Alt+drag to pan.
                    </p>
                  </div>
                )}
              </div>

              {/* Tile list */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-3 py-2 flex-shrink-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Tiles ({tiles.length})
                  </span>
                </div>
                <div className="px-2 pb-2 space-y-0.5">
                  {tiles.map((tile) => {
                    const isSelected = selectedTiles.has(tile.id);
                    return (
                      <button
                        key={tile.id}
                        type="button"
                        onClick={() => toggleTile(tile.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors ${
                          isSelected
                            ? "bg-[var(--accent)]/10 border border-[var(--accent)]/40"
                            : "border border-transparent hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        <div
                          className="w-6 h-6 flex-shrink-0 rounded border border-[var(--border)] bg-[var(--background)] overflow-hidden flex items-center justify-center"
                          style={{
                            backgroundImage:
                              "linear-gradient(45deg, var(--border) 25%, transparent 25%), linear-gradient(-45deg, var(--border) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--border) 75%), linear-gradient(-45deg, transparent 75%, var(--border) 75%)",
                            backgroundSize: "6px 6px",
                            backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0",
                          }}
                        >
                          {tileThumbnails.has(tile.id) && (
                            <img
                              src={tileThumbnails.get(tile.id)!}
                              alt={`Tile ${tile.id}`}
                              className="w-full h-full object-contain"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-medium text-[var(--foreground)]">
                            #{tile.id}
                          </span>
                          <span className="text-[10px] text-[var(--muted)] ml-1.5">
                            R{tile.row} C{tile.col}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--muted)] flex-shrink-0">
                          {tile.x},{tile.y}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Center: Tileset preview */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Zoom toolbar */}
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
                <button
                  type="button"
                  onClick={fitZoom}
                  className="inline-flex items-center gap-1 text-[11px] border border-[var(--border)] rounded px-2 py-0.5 hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                >
                  <Maximize size={10} />
                  Fit
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="text-[11px] border border-[var(--border)] rounded px-2 py-0.5 hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => clamp(z * 0.8, 0.1, 10))}
                  className="w-6 h-6 flex items-center justify-center border border-[var(--border)] rounded hover:bg-[var(--surface-hover)] text-[var(--muted)]"
                >
                  <ZoomOut size={11} />
                </button>
                <span className="text-[11px] text-[var(--muted)] w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => clamp(z * 1.25, 0.1, 10))}
                  className="w-6 h-6 flex items-center justify-center border border-[var(--border)] rounded hover:bg-[var(--surface-hover)] text-[var(--muted)]"
                >
                  <ZoomIn size={11} />
                </button>
                <div className="ml-auto flex items-center gap-2 text-[11px] text-[var(--muted)]">
                  <span>{image.naturalWidth} x {image.naturalHeight}px</span>
                  <span className="text-[var(--border)]">|</span>
                  <span>{columns} x {rows} tiles</span>
                </div>
              </div>

              {/* Canvas area */}
              <div
                ref={containerRef}
                className="flex-1 overflow-auto"
                onWheel={handleWheel}
                style={{ cursor: isPanning ? "grabbing" : "crosshair" }}
              >
                <div
                  className="inline-block min-w-full min-h-full p-4"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                  }}
                >
                  <div
                    className="inline-block rounded"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg, var(--border) 25%, transparent 25%), linear-gradient(-45deg, var(--border) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--border) 75%), linear-gradient(-45deg, transparent 75%, var(--border) 75%)",
                      backgroundSize: "16px 16px",
                      backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      className="block"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
