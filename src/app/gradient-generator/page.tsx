"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Paintbrush,
  Copy,
  Check,
  Plus,
  Trash2,
  Shuffle,
  Grid3X3,
  ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GradientType = "linear" | "radial" | "conic";
type RadialShape = "circle" | "ellipse";
type DirectionPreset =
  | "to top"
  | "to top right"
  | "to right"
  | "to bottom right"
  | "to bottom"
  | "to bottom left"
  | "to left"
  | "to top left";

interface ColorStop {
  id: string;
  color: string;
  position: number;
}

interface GradientState {
  type: GradientType;
  angle: number;
  direction: DirectionPreset | null;
  radialShape: RadialShape;
  radialPosX: number;
  radialPosY: number;
  conicStartAngle: number;
  conicPosX: number;
  conicPosY: number;
  stops: ColorStop[];
  useWebkitPrefix: boolean;
}

interface Preset {
  name: string;
  type: GradientType;
  angle: number;
  stops: { color: string; position: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _stopId = 0;
function makeId() {
  return `stop-${++_stopId}-${Date.now()}`;
}

function makeStop(color: string, position: number): ColorStop {
  return { id: makeId(), color, position };
}

function randomHex(): string {
  return (
    "#" +
    Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")
  );
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const PRESETS: Preset[] = [
  { name: "Ocean", type: "linear", angle: 135, stops: [{ color: "#667eea", position: 0 }, { color: "#764ba2", position: 100 }] },
  { name: "Sunset", type: "linear", angle: 90, stops: [{ color: "#f83600", position: 0 }, { color: "#f9d423", position: 100 }] },
  { name: "Mint", type: "linear", angle: 135, stops: [{ color: "#00b09b", position: 0 }, { color: "#96c93d", position: 100 }] },
  { name: "Fire", type: "linear", angle: 90, stops: [{ color: "#f12711", position: 0 }, { color: "#f5af19", position: 100 }] },
  { name: "Night", type: "linear", angle: 135, stops: [{ color: "#0f0c29", position: 0 }, { color: "#302b63", position: 50 }, { color: "#24243e", position: 100 }] },
  { name: "Sky", type: "linear", angle: 180, stops: [{ color: "#56ccf2", position: 0 }, { color: "#2f80ed", position: 100 }] },
  { name: "Peach", type: "linear", angle: 90, stops: [{ color: "#ffecd2", position: 0 }, { color: "#fcb69f", position: 100 }] },
  { name: "Lavender", type: "linear", angle: 135, stops: [{ color: "#a18cd1", position: 0 }, { color: "#fbc2eb", position: 100 }] },
  { name: "Emerald", type: "linear", angle: 135, stops: [{ color: "#11998e", position: 0 }, { color: "#38ef7d", position: 100 }] },
  { name: "Rose", type: "linear", angle: 90, stops: [{ color: "#ee9ca7", position: 0 }, { color: "#ffdde1", position: 100 }] },
  { name: "Slate", type: "linear", angle: 135, stops: [{ color: "#2c3e50", position: 0 }, { color: "#bdc3c7", position: 100 }] },
  { name: "Carbon", type: "linear", angle: 180, stops: [{ color: "#333333", position: 0 }, { color: "#0f0f0f", position: 100 }] },
  { name: "Aurora", type: "linear", angle: 135, stops: [{ color: "#00c6ff", position: 0 }, { color: "#0072ff", position: 50 }, { color: "#7c2ae8", position: 100 }] },
  { name: "Twilight", type: "linear", angle: 135, stops: [{ color: "#0a0a2e", position: 0 }, { color: "#5936b4", position: 50 }, { color: "#362583", position: 100 }] },
  { name: "Citrus", type: "linear", angle: 90, stops: [{ color: "#f7971e", position: 0 }, { color: "#ffd200", position: 100 }] },
  { name: "Berry", type: "linear", angle: 135, stops: [{ color: "#8e2de2", position: 0 }, { color: "#4a00e0", position: 100 }] },
];

// ---------------------------------------------------------------------------
// Direction grid labels
// ---------------------------------------------------------------------------

const DIRECTIONS: { label: string; value: DirectionPreset; arrow: string }[] = [
  { label: "TL", value: "to top left", arrow: "\u2196" },
  { label: "T", value: "to top", arrow: "\u2191" },
  { label: "TR", value: "to top right", arrow: "\u2197" },
  { label: "L", value: "to left", arrow: "\u2190" },
  { label: "", value: "to right", arrow: "" },
  { label: "R", value: "to right", arrow: "\u2192" },
  { label: "BL", value: "to bottom left", arrow: "\u2199" },
  { label: "B", value: "to bottom", arrow: "\u2193" },
  { label: "BR", value: "to bottom right", arrow: "\u2198" },
];

const ANGLE_PRESETS = [0, 45, 90, 135, 180];

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

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function GradientGeneratorPage() {
  const [state, setState] = useState<GradientState>({
    type: "linear",
    angle: 135,
    direction: null,
    radialShape: "ellipse",
    radialPosX: 50,
    radialPosY: 50,
    conicStartAngle: 0,
    conicPosX: 50,
    conicPosY: 50,
    stops: [makeStop("#667eea", 0), makeStop("#764ba2", 100)],
    useWebkitPrefix: false,
  });

  const [copied, setCopied] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  // ---- Updaters ----

  const update = useCallback(
    (patch: Partial<GradientState>) =>
      setState((s) => ({ ...s, ...patch })),
    [],
  );

  const updateStop = useCallback(
    (id: string, patch: Partial<ColorStop>) =>
      setState((s) => ({
        ...s,
        stops: s.stops.map((st) => (st.id === id ? { ...st, ...patch } : st)),
      })),
    [],
  );

  const removeStop = useCallback(
    (id: string) =>
      setState((s) => ({
        ...s,
        stops: s.stops.length > 2 ? s.stops.filter((st) => st.id !== id) : s.stops,
      })),
    [],
  );

  const addStop = useCallback(() => {
    setState((s) => {
      const sorted = [...s.stops].sort((a, b) => a.position - b.position);
      const last = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      const midPos = Math.round((last.position + prev.position) / 2);
      return { ...s, stops: [...s.stops, makeStop(randomHex(), midPos)] };
    });
  }, []);

  const randomize = useCallback(() => {
    const types: GradientType[] = ["linear", "radial", "conic"];
    const type = types[randomInt(0, 2)];
    const numStops = randomInt(2, 4);
    const stops: ColorStop[] = [];
    for (let i = 0; i < numStops; i++) {
      const pos = numStops === 1 ? 50 : Math.round((i / (numStops - 1)) * 100);
      stops.push(makeStop(randomHex(), pos));
    }
    update({
      type,
      angle: randomInt(0, 360),
      direction: null,
      radialShape: Math.random() > 0.5 ? "circle" : "ellipse",
      radialPosX: randomInt(20, 80),
      radialPosY: randomInt(20, 80),
      conicStartAngle: randomInt(0, 360),
      conicPosX: 50,
      conicPosY: 50,
      stops,
    });
  }, [update]);

  const loadPreset = useCallback(
    (p: Preset) => {
      update({
        type: p.type,
        angle: p.angle,
        direction: null,
        stops: p.stops.map((s) => makeStop(s.color, s.position)),
      });
    },
    [update],
  );

  // ---- CSS generation ----

  const stopsString = useMemo(
    () =>
      [...state.stops]
        .sort((a, b) => a.position - b.position)
        .map((s) => `${s.color} ${s.position}%`)
        .join(", "),
    [state.stops],
  );

  const gradientFunction = useMemo(() => {
    switch (state.type) {
      case "linear": {
        const dir = state.direction ?? `${state.angle}deg`;
        return `linear-gradient(${dir}, ${stopsString})`;
      }
      case "radial":
        return `radial-gradient(${state.radialShape} at ${state.radialPosX}% ${state.radialPosY}%, ${stopsString})`;
      case "conic":
        return `conic-gradient(from ${state.conicStartAngle}deg at ${state.conicPosX}% ${state.conicPosY}%, ${stopsString})`;
    }
  }, [state, stopsString]);

  const cssBackground = `background: ${gradientFunction};`;
  const cssBgImage = `background-image: ${gradientFunction};`;
  const cssWebkit = `-webkit-background-image: ${gradientFunction};`;

  const fullCSS = useMemo(() => {
    const lines = [cssBackground, cssBgImage];
    if (state.useWebkitPrefix) lines.push(cssWebkit);
    return lines.join("\n");
  }, [cssBackground, cssBgImage, cssWebkit, state.useWebkitPrefix]);

  const copyCSS = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullCSS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [fullCSS]);

  // ---- Render ----

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--background)] shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <Paintbrush size={18} className="text-[var(--accent)]" />
            <h1 className="text-sm font-semibold">Gradient Generator</h1>
          </div>
        </div>
        <button
          onClick={copyCSS}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied!" : "Copy CSS"}
        </button>
      </header>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Preview */}
        <div className="flex-[3] relative min-w-0">
          <div
            className="absolute inset-0"
            style={{ background: gradientFunction }}
          />
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
          )}
          {/* Overlay controls */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            <button
              onClick={() => setShowGrid((g) => !g)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md backdrop-blur-sm transition-colors"
              style={{
                background: showGrid
                  ? "rgba(255,255,255,0.25)"
                  : "rgba(0,0,0,0.35)",
                color: "#fff",
              }}
              title="Toggle grid overlay"
            >
              <Grid3X3 size={14} />
              Grid
            </button>
            <button
              onClick={randomize}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md backdrop-blur-sm transition-colors"
              style={{ background: "rgba(0,0,0,0.35)", color: "#fff" }}
              title="Randomize gradient"
            >
              <Shuffle size={14} />
              Random
            </button>
          </div>
        </div>

        {/* Right: Settings sidebar */}
        <div className="flex-[2] border-l border-[var(--border)] bg-[var(--background)] overflow-y-auto min-w-[280px] max-w-[440px]">
          {/* Gradient Type */}
          <Section title="Gradient Type" defaultOpen>
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
              {(["linear", "radial", "conic"] as GradientType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => update({ type: t, direction: null })}
                  className="flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors"
                  style={{
                    background:
                      state.type === t
                        ? "var(--accent)"
                        : "var(--surface)",
                    color: state.type === t ? "#fff" : "var(--foreground)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </Section>

          {/* Linear settings */}
          {state.type === "linear" && (
            <Section title="Direction & Angle" defaultOpen>
              <div className="flex flex-col gap-3">
                <div>
                  <Label>Angle ({state.angle}deg)</Label>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={state.angle}
                    onChange={(e) =>
                      update({
                        angle: Number(e.target.value),
                        direction: null,
                      })
                    }
                    className="w-full mt-1 accent-[var(--accent)]"
                  />
                  <div className="flex gap-1.5 mt-2">
                    {ANGLE_PRESETS.map((a) => (
                      <button
                        key={a}
                        onClick={() => update({ angle: a, direction: null })}
                        className="px-2 py-1 text-xs rounded border transition-colors"
                        style={{
                          borderColor: "var(--border)",
                          background:
                            state.angle === a && !state.direction
                              ? "var(--accent)"
                              : "var(--surface)",
                          color:
                            state.angle === a && !state.direction
                              ? "#fff"
                              : "var(--foreground)",
                        }}
                      >
                        {a}deg
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Direction Picker</Label>
                  <div className="grid grid-cols-3 gap-1 mt-1 w-fit">
                    {DIRECTIONS.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (d.arrow) update({ direction: d.value });
                        }}
                        disabled={!d.arrow}
                        className="w-9 h-9 flex items-center justify-center text-sm rounded border transition-colors disabled:opacity-0"
                        style={{
                          borderColor: d.arrow ? "var(--border)" : "transparent",
                          background:
                            state.direction === d.value
                              ? "var(--accent)"
                              : "var(--surface)",
                          color:
                            state.direction === d.value
                              ? "#fff"
                              : "var(--foreground)",
                        }}
                      >
                        {d.arrow}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Radial settings */}
          {state.type === "radial" && (
            <Section title="Radial Settings" defaultOpen>
              <div className="flex flex-col gap-3">
                <div>
                  <Label>Shape</Label>
                  <div className="flex rounded-lg border border-[var(--border)] overflow-hidden mt-1">
                    {(["circle", "ellipse"] as RadialShape[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => update({ radialShape: s })}
                        className="flex-1 px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                        style={{
                          background:
                            state.radialShape === s
                              ? "var(--accent)"
                              : "var(--surface)",
                          color:
                            state.radialShape === s
                              ? "#fff"
                              : "var(--foreground)",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Position X ({state.radialPosX}%)</Label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={state.radialPosX}
                    onChange={(e) =>
                      update({ radialPosX: Number(e.target.value) })
                    }
                    className="w-full mt-1 accent-[var(--accent)]"
                  />
                </div>
                <div>
                  <Label>Position Y ({state.radialPosY}%)</Label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={state.radialPosY}
                    onChange={(e) =>
                      update({ radialPosY: Number(e.target.value) })
                    }
                    className="w-full mt-1 accent-[var(--accent)]"
                  />
                </div>
              </div>
            </Section>
          )}

          {/* Conic settings */}
          {state.type === "conic" && (
            <Section title="Conic Settings" defaultOpen>
              <div className="flex flex-col gap-3">
                <div>
                  <Label>Start Angle ({state.conicStartAngle}deg)</Label>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={state.conicStartAngle}
                    onChange={(e) =>
                      update({ conicStartAngle: Number(e.target.value) })
                    }
                    className="w-full mt-1 accent-[var(--accent)]"
                  />
                </div>
                <div>
                  <Label>Center X ({state.conicPosX}%)</Label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={state.conicPosX}
                    onChange={(e) =>
                      update({ conicPosX: Number(e.target.value) })
                    }
                    className="w-full mt-1 accent-[var(--accent)]"
                  />
                </div>
                <div>
                  <Label>Center Y ({state.conicPosY}%)</Label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={state.conicPosY}
                    onChange={(e) =>
                      update({ conicPosY: Number(e.target.value) })
                    }
                    className="w-full mt-1 accent-[var(--accent)]"
                  />
                </div>
              </div>
            </Section>
          )}

          {/* Color Stops */}
          <Section title="Color Stops" defaultOpen>
            <div className="flex flex-col gap-2">
              {state.stops.map((stop, i) => (
                <div
                  key={stop.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                >
                  <input
                    type="color"
                    value={stop.color}
                    onChange={(e) =>
                      updateStop(stop.id, { color: e.target.value })
                    }
                    className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer bg-transparent p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={stop.color}
                    onChange={(e) =>
                      updateStop(stop.id, { color: e.target.value })
                    }
                    className="w-[72px] text-xs font-mono px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)]"
                    maxLength={7}
                  />
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={stop.position}
                      onChange={(e) =>
                        updateStop(stop.id, {
                          position: Number(e.target.value),
                        })
                      }
                      className="flex-1 accent-[var(--accent)]"
                    />
                    <span className="text-xs text-[var(--muted)] w-8 text-right tabular-nums shrink-0">
                      {stop.position}%
                    </span>
                  </div>
                  <button
                    onClick={() => removeStop(stop.id)}
                    disabled={state.stops.length <= 2}
                    className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--muted)] disabled:opacity-30 transition-colors shrink-0"
                    title="Remove stop"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={addStop}
                className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium rounded-lg border border-dashed border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <Plus size={14} />
                Add Stop
              </button>
            </div>
          </Section>

          {/* Presets */}
          <Section title="Presets" defaultOpen={false}>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => {
                const bg = `linear-gradient(135deg, ${p.stops
                  .map((s) => `${s.color} ${s.position}%`)
                  .join(", ")})`;
                return (
                  <button
                    key={p.name}
                    onClick={() => loadPreset(p)}
                    className="flex flex-col items-center gap-1 group"
                    title={p.name}
                  >
                    <div
                      className="w-full aspect-square rounded-lg border border-[var(--border)] group-hover:ring-2 ring-[var(--accent)] transition-all"
                      style={{ background: bg }}
                    />
                    <span className="text-[10px] text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* CSS Output */}
          <Section title="CSS Output" defaultOpen>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={state.useWebkitPrefix}
                    onChange={(e) =>
                      update({ useWebkitPrefix: e.target.checked })
                    }
                    className="accent-[var(--accent)]"
                  />
                  Include -webkit- prefix
                </label>
                <button
                  onClick={copyCSS}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="text-xs font-mono p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-x-auto whitespace-pre-wrap break-all select-all leading-relaxed">
                {fullCSS}
              </pre>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
