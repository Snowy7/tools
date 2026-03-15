"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Layers,
  Copy,
  Check,
  Plus,
  Trash2,
  ChevronDown,
  Eye,
  Palette,
  Sparkles,
  Code,
  Box,
  Type,
  Square,
  Circle,
  RectangleHorizontal,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShadowMode = "box-shadow" | "text-shadow";
type PreviewShape = "box" | "text" | "button" | "card" | "circle";

interface ShadowLayer {
  id: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  inset: boolean;
}

interface Preset {
  name: string;
  mode: ShadowMode;
  layers: Omit<ShadowLayer, "id">[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _layerId = 0;
function makeId() {
  return `layer-${++_layerId}-${Date.now()}`;
}

function makeLayer(overrides: Partial<Omit<ShadowLayer, "id">> = {}): ShadowLayer {
  return {
    id: makeId(),
    offsetX: 0,
    offsetY: 4,
    blur: 12,
    spread: 0,
    color: "#000000",
    opacity: 0.15,
    inset: false,
    ...overrides,
  };
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function buildBoxShadowString(layers: ShadowLayer[]): string {
  if (layers.length === 0) return "none";
  return layers
    .map((l) => {
      const parts: string[] = [];
      if (l.inset) parts.push("inset");
      parts.push(`${l.offsetX}px`);
      parts.push(`${l.offsetY}px`);
      parts.push(`${l.blur}px`);
      parts.push(`${l.spread}px`);
      parts.push(hexToRgba(l.color, l.opacity));
      return parts.join(" ");
    })
    .join(",\n    ");
}

function buildTextShadowString(layers: ShadowLayer[]): string {
  if (layers.length === 0) return "none";
  return layers
    .map((l) => {
      return `${l.offsetX}px ${l.offsetY}px ${l.blur}px ${hexToRgba(l.color, l.opacity)}`;
    })
    .join(",\n    ");
}

function getClosestTailwindClass(layers: ShadowLayer[], mode: ShadowMode): string {
  if (mode === "text-shadow") return "/* no built-in Tailwind text-shadow utility */";
  if (layers.length === 0) return "shadow-none";
  if (layers.length > 1) return "/* custom multi-layer — use arbitrary value */";
  const l = layers[0];
  if (l.inset) return "shadow-inner";
  const totalMag = Math.abs(l.offsetX) + Math.abs(l.offsetY) + l.blur + l.spread;
  if (totalMag === 0) return "shadow-none";
  if (totalMag <= 4) return "shadow-sm";
  if (totalMag <= 12) return "shadow";
  if (totalMag <= 20) return "shadow-md";
  if (totalMag <= 35) return "shadow-lg";
  if (totalMag <= 55) return "shadow-xl";
  return "shadow-2xl";
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const PRESETS: Preset[] = [
  {
    name: "Subtle",
    mode: "box-shadow",
    layers: [{ offsetX: 0, offsetY: 1, blur: 3, spread: 0, color: "#000000", opacity: 0.1, inset: false }],
  },
  {
    name: "Medium",
    mode: "box-shadow",
    layers: [{ offsetX: 0, offsetY: 4, blur: 6, spread: -1, color: "#000000", opacity: 0.1, inset: false }, { offsetX: 0, offsetY: 2, blur: 4, spread: -2, color: "#000000", opacity: 0.1, inset: false }],
  },
  {
    name: "Large",
    mode: "box-shadow",
    layers: [{ offsetX: 0, offsetY: 10, blur: 15, spread: -3, color: "#000000", opacity: 0.1, inset: false }, { offsetX: 0, offsetY: 4, blur: 6, spread: -4, color: "#000000", opacity: 0.1, inset: false }],
  },
  {
    name: "Elevated",
    mode: "box-shadow",
    layers: [{ offsetX: 0, offsetY: 20, blur: 25, spread: -5, color: "#000000", opacity: 0.1, inset: false }, { offsetX: 0, offsetY: 8, blur: 10, spread: -6, color: "#000000", opacity: 0.1, inset: false }],
  },
  {
    name: "Inner Glow",
    mode: "box-shadow",
    layers: [{ offsetX: 0, offsetY: 0, blur: 15, spread: 0, color: "#3b82f6", opacity: 0.35, inset: true }],
  },
  {
    name: "Neon",
    mode: "box-shadow",
    layers: [
      { offsetX: 0, offsetY: 0, blur: 5, spread: 0, color: "#8b5cf6", opacity: 0.6, inset: false },
      { offsetX: 0, offsetY: 0, blur: 20, spread: 0, color: "#8b5cf6", opacity: 0.4, inset: false },
      { offsetX: 0, offsetY: 0, blur: 40, spread: 0, color: "#8b5cf6", opacity: 0.2, inset: false },
    ],
  },
  {
    name: "Layered",
    mode: "box-shadow",
    layers: [
      { offsetX: 0, offsetY: 1, blur: 1, spread: 0, color: "#000000", opacity: 0.06, inset: false },
      { offsetX: 0, offsetY: 2, blur: 2, spread: 0, color: "#000000", opacity: 0.06, inset: false },
      { offsetX: 0, offsetY: 4, blur: 4, spread: 0, color: "#000000", opacity: 0.06, inset: false },
      { offsetX: 0, offsetY: 8, blur: 8, spread: 0, color: "#000000", opacity: 0.06, inset: false },
      { offsetX: 0, offsetY: 16, blur: 16, spread: 0, color: "#000000", opacity: 0.06, inset: false },
    ],
  },
  {
    name: "Hard Edge",
    mode: "box-shadow",
    layers: [{ offsetX: 4, offsetY: 4, blur: 0, spread: 0, color: "#000000", opacity: 0.25, inset: false }],
  },
  {
    name: "Emboss",
    mode: "box-shadow",
    layers: [
      { offsetX: 0, offsetY: -2, blur: 4, spread: 0, color: "#ffffff", opacity: 0.3, inset: true },
      { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "#000000", opacity: 0.15, inset: true },
    ],
  },
  {
    name: "Text Glow",
    mode: "text-shadow",
    layers: [
      { offsetX: 0, offsetY: 0, blur: 10, spread: 0, color: "#3b82f6", opacity: 0.8, inset: false },
      { offsetX: 0, offsetY: 0, blur: 30, spread: 0, color: "#3b82f6", opacity: 0.4, inset: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// Reusable UI components
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
      {children}
    </label>
  );
}

function Section({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown
          size={16}
          className="transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && <div className="px-4 pb-4 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
  suffix = "px",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        <span className="text-xs font-mono text-[var(--foreground)]">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)] h-1.5 cursor-pointer"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shape icons for preview selector
// ---------------------------------------------------------------------------

const SHAPE_OPTIONS: { value: PreviewShape; label: string; icon: React.ReactNode }[] = [
  { value: "box", label: "Box", icon: <Square size={14} /> },
  { value: "text", label: "Text", icon: <Type size={14} /> },
  { value: "button", label: "Button", icon: <RectangleHorizontal size={14} /> },
  { value: "card", label: "Card", icon: <Box size={14} /> },
  { value: "circle", label: "Circle", icon: <Circle size={14} /> },
];

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ShadowGeneratorPage() {
  const [mode, setMode] = useState<ShadowMode>("box-shadow");
  const [layers, setLayers] = useState<ShadowLayer[]>([
    makeLayer({ offsetX: 0, offsetY: 4, blur: 6, spread: -1, color: "#000000", opacity: 0.1 }),
    makeLayer({ offsetX: 0, offsetY: 2, blur: 4, spread: -2, color: "#000000", opacity: 0.1 }),
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedTw, setCopiedTw] = useState(false);

  // Preview options
  const [previewShape, setPreviewShape] = useState<PreviewShape>("card");
  const [previewSize, setPreviewSize] = useState(200);
  const [previewRadius, setPreviewRadius] = useState(12);
  const [previewBg, setPreviewBg] = useState("#ffffff");
  const [pageBg, setPageBg] = useState("#e5e7eb");

  // ---- Layer management ----

  const addLayer = useCallback(() => {
    setLayers((prev) => {
      const nl = makeLayer();
      return [...prev, nl];
    });
  }, []);

  const removeLayer = useCallback((id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setActiveLayerId((prev) => (prev === id ? null : prev));
  }, []);

  const updateLayer = useCallback((id: string, patch: Partial<ShadowLayer>) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const loadPreset = useCallback((preset: Preset) => {
    setMode(preset.mode);
    const newLayers = preset.layers.map((l) => makeLayer(l));
    setLayers(newLayers);
    setActiveLayerId(null);
  }, []);

  // ---- CSS output ----

  const cssString = useMemo(() => {
    if (mode === "box-shadow") return buildBoxShadowString(layers);
    return buildTextShadowString(layers);
  }, [layers, mode]);

  const fullCssOutput = useMemo(() => {
    return `${mode}: ${cssString};`;
  }, [mode, cssString]);

  const tailwindClass = useMemo(() => getClosestTailwindClass(layers, mode), [layers, mode]);

  const shadowStyle = useMemo(() => {
    if (mode === "box-shadow") return { boxShadow: cssString };
    return { textShadow: cssString };
  }, [mode, cssString]);

  // ---- Clipboard ----

  const copyToClipboard = useCallback(async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 1500);
    } catch { /* ignore */ }
  }, []);

  // ---- Active layer ----

  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId) ?? null,
    [layers, activeLayerId],
  );

  // ---- Render preview element ----

  const renderPreview = () => {
    const baseStyle: React.CSSProperties = {
      backgroundColor: previewBg,
      borderRadius: previewShape === "circle" ? "50%" : `${previewRadius}px`,
      ...(mode === "box-shadow" ? { boxShadow: cssString } : {}),
    };

    const textStyle: React.CSSProperties = mode === "text-shadow" ? { textShadow: cssString } : {};

    switch (previewShape) {
      case "box":
        return (
          <div
            style={{ ...baseStyle, width: previewSize, height: previewSize }}
          />
        );
      case "circle":
        return (
          <div
            style={{ ...baseStyle, width: previewSize, height: previewSize }}
          />
        );
      case "text":
        return (
          <div className="flex flex-col items-center gap-2" style={textStyle}>
            <span className="text-4xl font-bold" style={{ color: previewBg === "#ffffff" ? "#1f2937" : previewBg }}>
              Shadow Text
            </span>
            <span className="text-lg" style={{ color: previewBg === "#ffffff" ? "#6b7280" : previewBg }}>
              Preview your text-shadow
            </span>
          </div>
        );
      case "button":
        return (
          <button
            type="button"
            className="font-medium transition-colors cursor-default"
            style={{
              ...baseStyle,
              width: Math.max(previewSize, 120),
              height: Math.min(previewSize * 0.3, 56),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: "#1f2937",
              ...textStyle,
            }}
          >
            Button
          </button>
        );
      case "card":
      default:
        return (
          <div
            style={{
              ...baseStyle,
              width: previewSize,
              height: previewSize * 0.75,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                width: "60%",
                height: 12,
                borderRadius: 6,
                backgroundColor: "rgba(0,0,0,0.08)",
                ...textStyle,
              }}
            />
            <div
              style={{
                width: "80%",
                height: 8,
                borderRadius: 4,
                backgroundColor: "rgba(0,0,0,0.05)",
              }}
            />
            <div
              style={{
                width: "45%",
                height: 8,
                borderRadius: 4,
                backgroundColor: "rgba(0,0,0,0.05)",
              }}
            />
          </div>
        );
    }
  };

  // ---- Render ----

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Back to tools"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-[var(--accent)]" />
            <h1 className="text-sm font-semibold">Shadow Generator</h1>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-[var(--background)] rounded-lg p-0.5 border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setMode("box-shadow")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === "box-shadow"
                ? "bg-[var(--accent)] text-white"
                : "hover:bg-[var(--surface-hover)]"
            }`}
          >
            Box Shadow
          </button>
          <button
            type="button"
            onClick={() => setMode("text-shadow")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === "text-shadow"
                ? "bg-[var(--accent)] text-white"
                : "hover:bg-[var(--surface-hover)]"
            }`}
          >
            Text Shadow
          </button>
        </div>
      </header>

      {/* ---- Main layout ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* ---- Left: Preview ---- */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            className="flex-1 flex items-center justify-center transition-colors"
            style={{ backgroundColor: pageBg }}
          >
            {renderPreview()}
          </div>

          {/* Preview controls bar */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--border)] bg-[var(--surface)] flex-wrap">
            {/* Shape selector */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--muted)] mr-1">Shape</span>
              {SHAPE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setPreviewShape(s.value)}
                  className={`p-1.5 rounded transition-colors ${
                    previewShape === s.value
                      ? "bg-[var(--accent)] text-white"
                      : "hover:bg-[var(--surface-hover)] text-[var(--muted)]"
                  }`}
                  title={s.label}
                >
                  {s.icon}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-[var(--border)]" />

            {/* Size */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted)]">Size</span>
              <input
                type="range"
                min={60}
                max={400}
                value={previewSize}
                onChange={(e) => setPreviewSize(Number(e.target.value))}
                className="w-20 accent-[var(--accent)] h-1 cursor-pointer"
              />
              <span className="text-xs font-mono w-8">{previewSize}</span>
            </div>

            {/* Radius */}
            {previewShape !== "circle" && previewShape !== "text" && (
              <>
                <div className="w-px h-5 bg-[var(--border)]" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--muted)]">Radius</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={previewRadius}
                    onChange={(e) => setPreviewRadius(Number(e.target.value))}
                    className="w-16 accent-[var(--accent)] h-1 cursor-pointer"
                  />
                  <span className="text-xs font-mono w-8">{previewRadius}</span>
                </div>
              </>
            )}

            <div className="w-px h-5 bg-[var(--border)]" />

            {/* Element bg */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--muted)]">Element</span>
              <input
                type="color"
                value={previewBg}
                onChange={(e) => setPreviewBg(e.target.value)}
                className="w-6 h-6 rounded border border-[var(--border)] cursor-pointer bg-transparent"
              />
            </div>

            {/* Page bg */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--muted)]">Page</span>
              <input
                type="color"
                value={pageBg}
                onChange={(e) => setPageBg(e.target.value)}
                className="w-6 h-6 rounded border border-[var(--border)] cursor-pointer bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* ---- Right: Controls Sidebar ---- */}
        <aside className="w-80 shrink-0 border-l border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-y-auto">
          {/* Layers section */}
          <Section title={`Layers (${layers.length})`} icon={<Layers size={14} />} defaultOpen>
            <div className="flex flex-col gap-1">
              {layers.map((layer, i) => (
                <div
                  key={layer.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                    activeLayerId === layer.id
                      ? "bg-[var(--accent)] bg-opacity-10 ring-1 ring-[var(--accent)]"
                      : "hover:bg-[var(--surface-hover)]"
                  }`}
                  onClick={() => setActiveLayerId(layer.id === activeLayerId ? null : layer.id)}
                >
                  <div
                    className="w-4 h-4 rounded-sm border border-[var(--border)] shrink-0"
                    style={{ backgroundColor: hexToRgba(layer.color, layer.opacity) }}
                  />
                  <span className="text-xs flex-1 truncate">
                    Layer {i + 1}
                    {layer.inset && mode === "box-shadow" ? " (inset)" : ""}
                  </span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">
                    {layer.offsetX},{layer.offsetY} b{layer.blur}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(layer.id);
                    }}
                    className="p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors text-[var(--muted)]"
                    aria-label={`Remove layer ${i + 1}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLayer}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-medium rounded-md border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              <Plus size={12} />
              Add Layer
            </button>
          </Section>

          {/* Active layer controls */}
          {activeLayer && (
            <Section
              title={`Layer ${layers.findIndex((l) => l.id === activeLayer.id) + 1} Settings`}
              icon={<Eye size={14} />}
              defaultOpen
            >
              <SliderRow
                label="Offset X"
                value={activeLayer.offsetX}
                min={-50}
                max={50}
                onChange={(v) => updateLayer(activeLayer.id, { offsetX: v })}
              />
              <SliderRow
                label="Offset Y"
                value={activeLayer.offsetY}
                min={-50}
                max={50}
                onChange={(v) => updateLayer(activeLayer.id, { offsetY: v })}
              />
              <SliderRow
                label="Blur"
                value={activeLayer.blur}
                min={0}
                max={100}
                onChange={(v) => updateLayer(activeLayer.id, { blur: v })}
              />
              {mode === "box-shadow" && (
                <SliderRow
                  label="Spread"
                  value={activeLayer.spread}
                  min={-50}
                  max={100}
                  onChange={(v) => updateLayer(activeLayer.id, { spread: v })}
                />
              )}
              <SliderRow
                label="Opacity"
                value={Math.round(activeLayer.opacity * 100)}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => updateLayer(activeLayer.id, { opacity: v / 100 })}
              />

              {/* Color */}
              <div className="flex items-center gap-2">
                <Label>Color</Label>
                <input
                  type="color"
                  value={activeLayer.color}
                  onChange={(e) => updateLayer(activeLayer.id, { color: e.target.value })}
                  className="w-8 h-6 rounded border border-[var(--border)] cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono text-[var(--muted)]">{activeLayer.color}</span>
              </div>

              {/* Inset toggle */}
              {mode === "box-shadow" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeLayer.inset}
                    onChange={(e) => updateLayer(activeLayer.id, { inset: e.target.checked })}
                    className="accent-[var(--accent)] cursor-pointer"
                  />
                  <span className="text-xs">Inset</span>
                </label>
              )}
            </Section>
          )}

          {/* Presets */}
          <Section title="Presets" icon={<Sparkles size={14} />} defaultOpen={false}>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => loadPreset(preset)}
                  className="px-2 py-2 text-xs font-medium rounded-md border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] transition-colors text-left"
                >
                  <div className="flex items-center gap-1.5">
                    {preset.mode === "text-shadow" ? (
                      <Type size={10} className="text-[var(--muted)]" />
                    ) : (
                      <Square size={10} className="text-[var(--muted)]" />
                    )}
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5">
                    {preset.layers.length} layer{preset.layers.length > 1 ? "s" : ""}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* CSS Output */}
          <Section title="CSS Output" icon={<Code size={14} />} defaultOpen>
            <div className="relative">
              <pre className="text-xs font-mono bg-[var(--background)] border border-[var(--border)] rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all text-[var(--foreground)]">
                {fullCssOutput}
              </pre>
              <button
                type="button"
                onClick={() => copyToClipboard(fullCssOutput, setCopied)}
                className="absolute top-2 right-2 p-1 rounded hover:bg-[var(--surface-hover)] transition-colors"
                aria-label="Copy CSS"
              >
                {copied ? (
                  <Check size={14} className="text-green-500" />
                ) : (
                  <Copy size={14} className="text-[var(--muted)]" />
                )}
              </button>
            </div>

            {/* Tailwind output */}
            <div className="mt-1">
              <Label>Tailwind Class</Label>
              <div className="relative mt-1">
                <pre className="text-xs font-mono bg-[var(--background)] border border-[var(--border)] rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all text-[var(--foreground)]">
                  {tailwindClass}
                </pre>
                <button
                  type="button"
                  onClick={() => copyToClipboard(tailwindClass, setCopiedTw)}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-[var(--surface-hover)] transition-colors"
                  aria-label="Copy Tailwind class"
                >
                  {copiedTw ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <Copy size={14} className="text-[var(--muted)]" />
                  )}
                </button>
              </div>
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}
