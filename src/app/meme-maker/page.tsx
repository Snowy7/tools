"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Smile,
  Download,
  Copy,
  Check,
  Upload,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FlipHorizontal,
  Type,
  Image as ImageIcon,
  Sticker,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface TextConfig {
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  align: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
  shadow: boolean;
}

interface CustomTextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
}

interface StickerItem {
  id: string;
  type: StickerType;
  x: number;
  y: number;
  size: number;
}

type StickerType =
  | "sunglasses"
  | "mustache"
  | "partyhat"
  | "speechbubble"
  | "arrow"
  | "star"
  | "heart";

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_TEXT: TextConfig = {
  text: "",
  fontSize: 48,
  fontFamily: "Impact",
  color: "#ffffff",
  strokeEnabled: true,
  strokeColor: "#000000",
  strokeWidth: 4,
  align: "center",
  bold: false,
  italic: false,
  shadow: false,
};

const FONT_FAMILIES = [
  "Impact",
  "Arial",
  "Comic Sans MS",
  "Courier New",
  "Times New Roman",
  "system-ui",
];

const STICKER_TYPES: { type: StickerType; label: string }[] = [
  { type: "sunglasses", label: "Sunglasses" },
  { type: "mustache", label: "Mustache" },
  { type: "partyhat", label: "Party Hat" },
  { type: "speechbubble", label: "Speech Bubble" },
  { type: "arrow", label: "Arrow" },
  { type: "star", label: "Star" },
  { type: "heart", label: "Heart" },
];

// ── Sticker Drawing ──────────────────────────────────────────────────────────

function drawSticker(
  ctx: CanvasRenderingContext2D,
  type: StickerType,
  cx: number,
  cy: number,
  size: number
) {
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);

  switch (type) {
    case "sunglasses": {
      ctx.fillStyle = "#111";
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
      // left lens
      ctx.beginPath();
      ctx.roundRect(-s * 0.45, -s * 0.15, s * 0.38, s * 0.28, 4);
      ctx.fill();
      ctx.stroke();
      // right lens
      ctx.beginPath();
      ctx.roundRect(s * 0.07, -s * 0.15, s * 0.38, s * 0.28, 4);
      ctx.fill();
      ctx.stroke();
      // bridge
      ctx.beginPath();
      ctx.moveTo(-s * 0.07, 0);
      ctx.quadraticCurveTo(0, -s * 0.08, s * 0.07, 0);
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 3;
      ctx.stroke();
      // arms
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.05);
      ctx.lineTo(-s * 0.55, -s * 0.1);
      ctx.moveTo(s * 0.45, -s * 0.05);
      ctx.lineTo(s * 0.55, -s * 0.1);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
    }
    case "mustache": {
      ctx.fillStyle = "#3d2b1f";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-s * 0.15, -s * 0.2, -s * 0.4, -s * 0.05);
      ctx.quadraticCurveTo(-s * 0.5, s * 0.15, -s * 0.3, s * 0.12);
      ctx.quadraticCurveTo(-s * 0.1, 0, 0, s * 0.05);
      ctx.quadraticCurveTo(s * 0.1, 0, s * 0.3, s * 0.12);
      ctx.quadraticCurveTo(s * 0.5, s * 0.15, s * 0.4, -s * 0.05);
      ctx.quadraticCurveTo(s * 0.15, -s * 0.2, 0, 0);
      ctx.fill();
      break;
    }
    case "partyhat": {
      ctx.fillStyle = "#ff4081";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.45);
      ctx.lineTo(-s * 0.25, s * 0.2);
      ctx.lineTo(s * 0.25, s * 0.2);
      ctx.closePath();
      ctx.fill();
      // stripes
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, -s * 0.15);
      ctx.lineTo(s * 0.17, -s * 0.15);
      ctx.moveTo(-s * 0.15, s * 0.05);
      ctx.lineTo(s * 0.22, s * 0.05);
      ctx.stroke();
      // pom
      ctx.fillStyle = "#ffeb3b";
      ctx.beginPath();
      ctx.arc(0, -s * 0.45, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "speechbubble": {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-s * 0.4, -s * 0.3, s * 0.8, s * 0.5, 8);
      ctx.fill();
      ctx.stroke();
      // tail
      ctx.beginPath();
      ctx.moveTo(-s * 0.05, s * 0.2);
      ctx.lineTo(-s * 0.15, s * 0.4);
      ctx.lineTo(s * 0.1, s * 0.2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.stroke();
      // dots
      ctx.fillStyle = "#999";
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(i * s * 0.12, -s * 0.05, s * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "arrow": {
      ctx.strokeStyle = "#f44336";
      ctx.fillStyle = "#f44336";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, 0);
      ctx.lineTo(s * 0.2, 0);
      ctx.stroke();
      // arrowhead
      ctx.beginPath();
      ctx.moveTo(s * 0.4, 0);
      ctx.lineTo(s * 0.15, -s * 0.15);
      ctx.lineTo(s * 0.15, s * 0.15);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "star": {
      ctx.fillStyle = "#ffc107";
      ctx.strokeStyle = "#ff8f00";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const innerAngle = outerAngle + Math.PI / 5;
        const ox = Math.cos(outerAngle) * s * 0.4;
        const oy = Math.sin(outerAngle) * s * 0.4;
        const ix = Math.cos(innerAngle) * s * 0.18;
        const iy = Math.sin(innerAngle) * s * 0.18;
        if (i === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(ox, oy);
        ctx.lineTo(ix, iy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "heart": {
      ctx.fillStyle = "#e91e63";
      ctx.beginPath();
      ctx.moveTo(0, s * 0.3);
      ctx.bezierCurveTo(-s * 0.05, s * 0.2, -s * 0.4, s * 0.05, -s * 0.4, -s * 0.15);
      ctx.bezierCurveTo(-s * 0.4, -s * 0.35, -s * 0.15, -s * 0.4, 0, -s * 0.2);
      ctx.bezierCurveTo(s * 0.15, -s * 0.4, s * 0.4, -s * 0.35, s * 0.4, -s * 0.15);
      ctx.bezierCurveTo(s * 0.4, s * 0.05, s * 0.05, s * 0.2, 0, s * 0.3);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

// ── Slider Component ─────────────────────────────────────────────────────────

function MemeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  onChange,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  onChange: (val: number) => void;
  suffix?: string;
}) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
          {label}
        </span>
        <span
          className="text-xs tabular-nums cursor-pointer select-none"
          style={{ color: "var(--muted)" }}
          onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
          title="Double-click to reset"
        >
          {value}
          {suffix}
        </span>
      </div>
      <div className="relative h-5 flex items-center">
        <div
          className="absolute h-1 rounded-full w-full"
          style={{ background: "var(--border)" }}
        />
        <div
          className="absolute h-1 rounded-full"
          style={{ background: "var(--accent)", width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
          className="absolute w-full h-5 opacity-0 cursor-pointer"
          style={{ zIndex: 2 }}
        />
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 shadow-sm pointer-events-none"
          style={{
            background: "var(--surface)",
            borderColor: "var(--accent)",
            left: `calc(${pct}% - 7px)`,
            zIndex: 1,
          }}
        />
      </div>
    </div>
  );
}

// ── Collapsible Section ──────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        className="flex items-center gap-1.5 w-full text-left mb-2 group cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown size={14} style={{ color: "var(--muted)" }} />
        ) : (
          <ChevronRight size={14} style={{ color: "var(--muted)" }} />
        )}
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          {title}
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{
          maxHeight: open ? "2000px" : "0px",
          opacity: open ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Text Config Panel ────────────────────────────────────────────────────────

function TextConfigPanel({
  label,
  config,
  onChange,
}: {
  label: string;
  config: TextConfig;
  onChange: (config: TextConfig) => void;
}) {
  const update = (partial: Partial<TextConfig>) => onChange({ ...config, ...partial });

  return (
    <CollapsibleSection title={label}>
      <div className="space-y-3">
        <input
          type="text"
          value={config.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder={`Enter ${label.toLowerCase()}...`}
          className="w-full px-2.5 py-1.5 rounded-md text-sm border-none outline-none"
          style={{
            background: "var(--surface-hover)",
            color: "var(--foreground)",
          }}
        />

        <MemeSlider
          label="Font Size"
          value={config.fontSize}
          min={16}
          max={120}
          defaultValue={48}
          onChange={(v) => update({ fontSize: v })}
          suffix="px"
        />

        <div>
          <span className="text-xs font-medium mb-1 block" style={{ color: "var(--foreground)" }}>
            Font Family
          </span>
          <select
            value={config.fontFamily}
            onChange={(e) => update({ fontFamily: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-md text-sm border-none outline-none cursor-pointer"
            style={{
              background: "var(--surface-hover)",
              color: "var(--foreground)",
            }}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <span className="text-xs font-medium mb-1 block" style={{ color: "var(--foreground)" }}>
              Color
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.color}
                onChange={(e) => update({ color: e.target.value })}
                className="w-7 h-7 rounded cursor-pointer border-none"
              />
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {config.color}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => update({ bold: !config.bold })}
              className="p-1.5 rounded-md cursor-pointer transition-colors"
              style={{
                background: config.bold ? "var(--accent)" : "var(--surface-hover)",
                color: config.bold ? "#fff" : "var(--foreground)",
              }}
              title="Bold"
            >
              <Bold size={14} />
            </button>
            <button
              onClick={() => update({ italic: !config.italic })}
              className="p-1.5 rounded-md cursor-pointer transition-colors"
              style={{
                background: config.italic ? "var(--accent)" : "var(--surface-hover)",
                color: config.italic ? "#fff" : "var(--foreground)",
              }}
              title="Italic"
            >
              <Italic size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs font-medium mr-2" style={{ color: "var(--foreground)" }}>
            Align
          </span>
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              onClick={() => update({ align: a })}
              className="p-1.5 rounded-md cursor-pointer transition-colors"
              style={{
                background: config.align === a ? "var(--accent)" : "var(--surface-hover)",
                color: config.align === a ? "#fff" : "var(--foreground)",
              }}
              title={a}
            >
              {a === "left" ? (
                <AlignLeft size={14} />
              ) : a === "center" ? (
                <AlignCenter size={14} />
              ) : (
                <AlignRight size={14} />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.strokeEnabled}
              onChange={(e) => update({ strokeEnabled: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            <span className="text-xs" style={{ color: "var(--foreground)" }}>
              Outline
            </span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.shadow}
              onChange={(e) => update({ shadow: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            <span className="text-xs" style={{ color: "var(--foreground)" }}>
              Shadow
            </span>
          </label>
        </div>

        {config.strokeEnabled && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                Stroke Color
              </span>
              <input
                type="color"
                value={config.strokeColor}
                onChange={(e) => update({ strokeColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-none"
              />
            </div>
            <MemeSlider
              label="Stroke Width"
              value={config.strokeWidth}
              min={1}
              max={8}
              defaultValue={4}
              onChange={(v) => update({ strokeWidth: v })}
              suffix="px"
            />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function MemeMakerPage() {
  // State
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [topText, setTopText] = useState<TextConfig>({ ...DEFAULT_TEXT });
  const [bottomText, setBottomText] = useState<TextConfig>({ ...DEFAULT_TEXT });
  const [customBoxes, setCustomBoxes] = useState<CustomTextBox[]>([]);
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [padding, setPadding] = useState(0);
  const [bgColor, setBgColor] = useState("#000000");
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Drag state
  const [dragTarget, setDragTarget] = useState<{
    type: "box" | "sticker";
    id: string;
  } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renderCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canvas dimensions
  const canvasWidth = image ? image.naturalWidth + padding * 2 : 800;
  const canvasHeight = image ? image.naturalHeight + padding * 2 : 600;

  // ── File Handling ────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setImage(img);
    };
    img.src = url;
  }, []);

  // Paste from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFile]);

  // ── Canvas Rendering ─────────────────────────────────────────────────────

  const renderToCanvas = useCallback(
    (targetCanvas: HTMLCanvasElement, w: number, h: number) => {
      const ctx = targetCanvas.getContext("2d");
      if (!ctx) return;

      targetCanvas.width = w;
      targetCanvas.height = h;

      // Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      // Image
      if (image) {
        ctx.save();
        const imgX = padding;
        const imgY = padding;
        const imgW = w - padding * 2;
        const imgH = h - padding * 2;

        // Brightness/contrast filter
        const b = 100 + brightness;
        const c = 100 + contrast;
        ctx.filter = `brightness(${b}%) contrast(${c}%)`;

        if (flipH) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(image, padding, imgY, imgW, imgH);
        } else {
          ctx.drawImage(image, imgX, imgY, imgW, imgH);
        }
        ctx.restore();
      }

      // Helper: draw text with config
      const drawTextLine = (
        text: string,
        x: number,
        y: number,
        config: TextConfig | CustomTextBox,
        maxWidth: number
      ) => {
        if (!text) return;
        ctx.save();

        const isBold = "bold" in config && config.bold;
        const isItalic = "italic" in config && config.italic;
        const fontStyle = `${isItalic ? "italic " : ""}${isBold ? "bold " : ""}`;
        const fontFamily = config.fontFamily;
        ctx.font = `${fontStyle}${config.fontSize}px "${fontFamily}", sans-serif`;
        ctx.textBaseline = "top";

        if ("align" in config) {
          ctx.textAlign = config.align;
        } else {
          ctx.textAlign = "left";
        }

        if ("shadow" in config && config.shadow) {
          ctx.shadowColor = "rgba(0,0,0,0.7)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }

        ctx.lineJoin = "round";

        if (config.strokeEnabled) {
          ctx.strokeStyle = config.strokeColor;
          ctx.lineWidth = config.strokeWidth;
          ctx.strokeText(text, x, y, maxWidth);
        }

        ctx.fillStyle = config.color;
        ctx.fillText(text, x, y, maxWidth);

        ctx.restore();
      };

      // Top text
      if (topText.text) {
        const tx =
          topText.align === "left"
            ? padding + 20
            : topText.align === "right"
              ? w - padding - 20
              : w / 2;
        const ty = padding + 20;
        drawTextLine(topText.text, tx, ty, topText, w - padding * 2 - 40);
      }

      // Bottom text
      if (bottomText.text) {
        const bx =
          bottomText.align === "left"
            ? padding + 20
            : bottomText.align === "right"
              ? w - padding - 20
              : w / 2;
        const by = h - padding - bottomText.fontSize - 20;
        drawTextLine(bottomText.text, bx, by, bottomText, w - padding * 2 - 40);
      }

      // Custom text boxes (positions stored as 0-100 percentages)
      for (const box of customBoxes) {
        const bx = (box.x / 100) * w;
        const by = (box.y / 100) * h;
        drawTextLine(box.text, bx, by, box, w);
      }

      // Stickers
      for (const sticker of stickers) {
        const sx = (sticker.x / 100) * w;
        const sy = (sticker.y / 100) * h;
        drawSticker(ctx, sticker.type, sx, sy, sticker.size);
      }
    },
    [image, topText, bottomText, customBoxes, stickers, padding, bgColor, brightness, contrast, flipH]
  );

  // Preview rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = previewContainerRef.current;
    if (!container) return;

    // Fit canvas into container
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const scale = Math.min(containerW / canvasWidth, containerH / canvasHeight, 1);
    const displayW = Math.round(canvasWidth * scale);
    const displayH = Math.round(canvasHeight * scale);

    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    renderToCanvas(canvas, canvasWidth, canvasHeight);
  }, [renderToCanvas, canvasWidth, canvasHeight]);

  // ── Drag Handling ────────────────────────────────────────────────────────

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      // Convert to percentage
      const pctX = (mx / canvasWidth) * 100;
      const pctY = (my / canvasHeight) * 100;

      // Check stickers (reverse order for top-most first)
      for (let i = stickers.length - 1; i >= 0; i--) {
        const s = stickers[i];
        const hitRadius = (s.size / canvasWidth) * 100 * 0.5;
        if (
          Math.abs(pctX - s.x) < hitRadius + 3 &&
          Math.abs(pctY - s.y) < (s.size / canvasHeight) * 100 * 0.5 + 3
        ) {
          setDragTarget({ type: "sticker", id: s.id });
          dragOffset.current = { x: pctX - s.x, y: pctY - s.y };
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }

      // Check custom text boxes
      for (let i = customBoxes.length - 1; i >= 0; i--) {
        const box = customBoxes[i];
        const boxH = (box.fontSize / canvasHeight) * 100;
        const boxW = Math.max(10, (box.text.length * box.fontSize * 0.6) / canvasWidth * 100);
        if (
          pctX >= box.x - 2 &&
          pctX <= box.x + boxW + 2 &&
          pctY >= box.y - 2 &&
          pctY <= box.y + boxH + 2
        ) {
          setDragTarget({ type: "box", id: box.id });
          dragOffset.current = { x: pctX - box.x, y: pctY - box.y };
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
    },
    [canvasWidth, canvasHeight, stickers, customBoxes]
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragTarget) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const pctX = Math.max(0, Math.min(100, (mx / canvasWidth) * 100 - dragOffset.current.x));
      const pctY = Math.max(0, Math.min(100, (my / canvasHeight) * 100 - dragOffset.current.y));

      if (dragTarget.type === "box") {
        setCustomBoxes((prev) =>
          prev.map((b) => (b.id === dragTarget.id ? { ...b, x: pctX, y: pctY } : b))
        );
      } else {
        setStickers((prev) =>
          prev.map((s) => (s.id === dragTarget.id ? { ...s, x: pctX, y: pctY } : s))
        );
      }
    },
    [dragTarget, canvasWidth, canvasHeight]
  );

  const handleCanvasPointerUp = useCallback(() => {
    setDragTarget(null);
  }, []);

  // ── Custom Text Box Helpers ──────────────────────────────────────────────

  const addCustomBox = () => {
    setCustomBoxes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: "Custom text",
        x: 30 + Math.random() * 20,
        y: 40 + Math.random() * 20,
        fontSize: 32,
        fontFamily: "Impact",
        color: "#ffffff",
        strokeEnabled: true,
        strokeColor: "#000000",
        strokeWidth: 3,
      },
    ]);
  };

  const updateBox = (id: string, partial: Partial<CustomTextBox>) => {
    setCustomBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...partial } : b)));
  };

  const removeBox = (id: string) => {
    setCustomBoxes((prev) => prev.filter((b) => b.id !== id));
  };

  // ── Sticker Helpers ──────────────────────────────────────────────────────

  const addSticker = (type: StickerType) => {
    setStickers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        x: 40 + Math.random() * 20,
        y: 40 + Math.random() * 20,
        size: 60,
      },
    ]);
  };

  const removeSticker = (id: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
  };

  // ── Export ───────────────────────────────────────────────────────────────

  const exportBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!renderCanvasRef.current) {
        renderCanvasRef.current = document.createElement("canvas");
      }
      renderToCanvas(renderCanvasRef.current, canvasWidth, canvasHeight);
      renderCanvasRef.current.toBlob((blob) => resolve(blob), "image/png");
    });
  }, [renderToCanvas, canvasWidth, canvasHeight]);

  const handleDownload = useCallback(async () => {
    const blob = await exportBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meme.png";
    a.click();
    URL.revokeObjectURL(url);
  }, [exportBlob]);

  const handleCopy = useCallback(async () => {
    const blob = await exportBlob();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: download instead
      handleDownload();
    }
  }, [exportBlob, handleDownload]);

  // ── Drop Zone ────────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ── Upload Screen ────────────────────────────────────────────────────────

  if (!image) {
    return (
      <div className="h-screen flex flex-col" style={{ background: "var(--background)" }}>
        <header
          className="flex items-center gap-3 px-4 h-12 shrink-0 border-b"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <Link
            href="/"
            className="p-1.5 rounded-md transition-colors hover:opacity-80"
            style={{ color: "var(--foreground)" }}
          >
            <ArrowLeft size={18} />
          </Link>
          <Smile size={18} style={{ color: "var(--accent)" }} />
          <h1 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Meme Maker
          </h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className="w-full max-w-lg rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer"
            style={{
              borderColor: isDragging ? "var(--accent)" : "var(--border)",
              background: isDragging ? "var(--surface-hover)" : "var(--surface)",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload
              size={40}
              className="mx-auto mb-4"
              style={{ color: "var(--muted)" }}
            />
            <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
              Drop an image here or click to upload
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              You can also paste an image from your clipboard
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
    );
  }

  // ── Main Editor ──────────────────────────────────────────────────────────

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 h-12 shrink-0 border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Link
          href="/"
          className="p-1.5 rounded-md transition-colors hover:opacity-80"
          style={{ color: "var(--foreground)" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <Smile size={18} style={{ color: "var(--accent)" }} />
        <h1 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Meme Maker
        </h1>

        <div className="flex-1" />

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
          style={{
            color: "var(--foreground)",
            background: "var(--surface-hover)",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} />
          Upload
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
          style={{
            color: "var(--foreground)",
            background: "var(--surface-hover)",
          }}
          onClick={handleCopy}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
          style={{
            color: "#fff",
            background: "var(--accent)",
          }}
          onClick={handleDownload}
        >
          <Download size={14} />
          Download
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Canvas Preview */}
        <div
          className="flex-[3] flex items-center justify-center p-4 min-w-0"
          ref={previewContainerRef}
          style={{ background: "var(--background)" }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <canvas
            ref={canvasRef}
            className="shadow-lg rounded"
            style={{ maxWidth: "100%", maxHeight: "100%", cursor: dragTarget ? "grabbing" : "default" }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
          />
        </div>

        {/* Sidebar */}
        <div
          className="flex-[2] max-w-sm border-l overflow-y-auto p-4"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          {/* Top Text */}
          <TextConfigPanel
            label="Top Text"
            config={topText}
            onChange={setTopText}
          />

          {/* Bottom Text */}
          <TextConfigPanel
            label="Bottom Text"
            config={bottomText}
            onChange={setBottomText}
          />

          {/* Custom Text Boxes */}
          <CollapsibleSection title="Custom Text Boxes" defaultOpen={false}>
            <button
              onClick={addCustomBox}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-md text-xs font-medium mb-3 cursor-pointer transition-colors"
              style={{
                background: "var(--surface-hover)",
                color: "var(--foreground)",
              }}
            >
              <Plus size={14} />
              Add Text Box
            </button>

            {customBoxes.map((box, idx) => (
              <div
                key={box.id}
                className="mb-4 p-3 rounded-lg"
                style={{ background: "var(--surface-hover)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                    Box {idx + 1}
                  </span>
                  <button
                    onClick={() => removeBox(box.id)}
                    className="p-1 rounded cursor-pointer transition-colors hover:opacity-70"
                    style={{ color: "var(--muted)" }}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <input
                  type="text"
                  value={box.text}
                  onChange={(e) => updateBox(box.id, { text: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md text-sm border-none outline-none mb-2"
                  style={{
                    background: "var(--surface)",
                    color: "var(--foreground)",
                  }}
                />

                <MemeSlider
                  label="X Position"
                  value={Math.round(box.x)}
                  min={0}
                  max={100}
                  defaultValue={50}
                  onChange={(v) => updateBox(box.id, { x: v })}
                  suffix="%"
                />
                <MemeSlider
                  label="Y Position"
                  value={Math.round(box.y)}
                  min={0}
                  max={100}
                  defaultValue={50}
                  onChange={(v) => updateBox(box.id, { y: v })}
                  suffix="%"
                />
                <MemeSlider
                  label="Font Size"
                  value={box.fontSize}
                  min={16}
                  max={120}
                  defaultValue={32}
                  onChange={(v) => updateBox(box.id, { fontSize: v })}
                  suffix="px"
                />

                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: "var(--foreground)" }}>
                      Color
                    </span>
                    <input
                      type="color"
                      value={box.color}
                      onChange={(e) => updateBox(box.id, { color: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border-none"
                    />
                  </div>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={box.strokeEnabled}
                      onChange={(e) => updateBox(box.id, { strokeEnabled: e.target.checked })}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-xs" style={{ color: "var(--foreground)" }}>
                      Outline
                    </span>
                  </label>
                  {box.strokeEnabled && (
                    <input
                      type="color"
                      value={box.strokeColor}
                      onChange={(e) => updateBox(box.id, { strokeColor: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border-none"
                      title="Stroke color"
                    />
                  )}
                </div>

                <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                  Drag on canvas to reposition
                </p>
              </div>
            ))}
          </CollapsibleSection>

          {/* Image Controls */}
          <CollapsibleSection title="Image Controls">
            <MemeSlider
              label="Padding"
              value={padding}
              min={0}
              max={40}
              defaultValue={0}
              onChange={setPadding}
              suffix="px"
            />

            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                  Background Color
                </span>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-none"
                />
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {bgColor}
                </span>
              </div>
            </div>

            <MemeSlider
              label="Brightness"
              value={brightness}
              min={-50}
              max={50}
              defaultValue={0}
              onChange={setBrightness}
            />
            <MemeSlider
              label="Contrast"
              value={contrast}
              min={-50}
              max={50}
              defaultValue={0}
              onChange={setContrast}
            />

            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={flipH}
                onChange={(e) => setFlipH(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <FlipHorizontal size={14} style={{ color: "var(--foreground)" }} />
              <span className="text-xs" style={{ color: "var(--foreground)" }}>
                Flip Horizontal
              </span>
            </label>
          </CollapsibleSection>

          {/* Stickers */}
          <CollapsibleSection title="Stickers" defaultOpen={false}>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {STICKER_TYPES.map(({ type, label }) => {
                // Mini preview canvas for each sticker
                return (
                  <button
                    key={type}
                    onClick={() => addSticker(type)}
                    className="flex flex-col items-center gap-1 p-2 rounded-md cursor-pointer transition-colors"
                    style={{ background: "var(--surface-hover)" }}
                    title={label}
                  >
                    <StickerPreview type={type} />
                    <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            {stickers.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                  Active Stickers
                </span>
                {stickers.map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded-md"
                    style={{ background: "var(--surface-hover)" }}
                  >
                    <span className="text-xs" style={{ color: "var(--foreground)" }}>
                      {STICKER_TYPES.find((st) => st.type === s.type)?.label} #{idx + 1}
                    </span>
                    <button
                      onClick={() => removeSticker(s.id)}
                      className="p-1 rounded cursor-pointer hover:opacity-70"
                      style={{ color: "var(--muted)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Drag stickers on canvas to reposition
                </p>
              </div>
            )}
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}

// ── Sticker Preview Component ────────────────────────────────────────────────

function StickerPreview({ type }: { type: StickerType }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 36;
    canvas.height = 36;
    ctx.clearRect(0, 0, 36, 36);
    drawSticker(ctx, type, 18, 18, 30);
  }, [type]);

  return <canvas ref={canvasRef} width={36} height={36} className="w-9 h-9" />;
}
