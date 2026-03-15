"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Copy,
  Star,
  Trash2,
  Clock,
  Table,
  Info,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UnitDef {
  label: string;
  symbol: string;
}

interface CategoryDef {
  name: string;
  icon: string;
  units: Record<string, UnitDef>;
  factors?: Record<string, number>; // relative to base (smallest) unit
  convert?: (value: number, from: string, to: string) => number;
  formula?: (from: string, to: string) => string;
}

interface HistoryEntry {
  id: number;
  category: string;
  fromValue: string;
  fromUnit: string;
  toValue: string;
  toUnit: string;
  timestamp: number;
}

interface FavoritePair {
  category: string;
  fromUnit: string;
  toUnit: string;
}

/* ------------------------------------------------------------------ */
/*  Conversion data                                                    */
/* ------------------------------------------------------------------ */

const CATEGORIES: Record<string, CategoryDef> = {
  length: {
    name: "Length",
    icon: "📏",
    units: {
      mm: { label: "Millimeter", symbol: "mm" },
      cm: { label: "Centimeter", symbol: "cm" },
      m: { label: "Meter", symbol: "m" },
      km: { label: "Kilometer", symbol: "km" },
      in: { label: "Inch", symbol: "in" },
      ft: { label: "Foot", symbol: "ft" },
      yd: { label: "Yard", symbol: "yd" },
      mi: { label: "Mile", symbol: "mi" },
      nm: { label: "Nautical Mile", symbol: "nm" },
    },
    factors: {
      mm: 1,
      cm: 10,
      m: 1000,
      km: 1_000_000,
      in: 25.4,
      ft: 304.8,
      yd: 914.4,
      mi: 1_609_344,
      nm: 1_852_000,
    },
  },
  weight: {
    name: "Weight",
    icon: "⚖️",
    units: {
      mg: { label: "Milligram", symbol: "mg" },
      g: { label: "Gram", symbol: "g" },
      kg: { label: "Kilogram", symbol: "kg" },
      lb: { label: "Pound", symbol: "lb" },
      oz: { label: "Ounce", symbol: "oz" },
      ton: { label: "Metric Ton", symbol: "t" },
      stone: { label: "Stone", symbol: "st" },
    },
    factors: {
      mg: 1,
      g: 1000,
      kg: 1_000_000,
      lb: 453_592.37,
      oz: 28_349.523,
      ton: 1_000_000_000,
      stone: 6_350_293.18,
    },
  },
  temperature: {
    name: "Temperature",
    icon: "🌡️",
    units: {
      C: { label: "Celsius", symbol: "°C" },
      F: { label: "Fahrenheit", symbol: "°F" },
      K: { label: "Kelvin", symbol: "K" },
    },
    convert: (value: number, from: string, to: string) => {
      if (from === to) return value;
      // Convert to Celsius first
      let celsius: number;
      if (from === "C") celsius = value;
      else if (from === "F") celsius = (value - 32) * (5 / 9);
      else celsius = value - 273.15; // K
      // Convert from Celsius to target
      if (to === "C") return celsius;
      if (to === "F") return celsius * (9 / 5) + 32;
      return celsius + 273.15; // K
    },
    formula: (from: string, to: string) => {
      const formulas: Record<string, string> = {
        "C-F": "°C * 9/5 + 32 = °F",
        "F-C": "(°F - 32) * 5/9 = °C",
        "C-K": "°C + 273.15 = K",
        "K-C": "K - 273.15 = °C",
        "F-K": "(°F - 32) * 5/9 + 273.15 = K",
        "K-F": "(K - 273.15) * 9/5 + 32 = °F",
      };
      return formulas[`${from}-${to}`] || `${from} = ${to}`;
    },
  },
  area: {
    name: "Area",
    icon: "📐",
    units: {
      mm2: { label: "Square Millimeter", symbol: "mm\u00B2" },
      cm2: { label: "Square Centimeter", symbol: "cm\u00B2" },
      m2: { label: "Square Meter", symbol: "m\u00B2" },
      km2: { label: "Square Kilometer", symbol: "km\u00B2" },
      in2: { label: "Square Inch", symbol: "in\u00B2" },
      ft2: { label: "Square Foot", symbol: "ft\u00B2" },
      yd2: { label: "Square Yard", symbol: "yd\u00B2" },
      mi2: { label: "Square Mile", symbol: "mi\u00B2" },
      acres: { label: "Acre", symbol: "ac" },
      hectares: { label: "Hectare", symbol: "ha" },
    },
    factors: {
      mm2: 1,
      cm2: 100,
      m2: 1_000_000,
      km2: 1_000_000_000_000,
      in2: 645.16,
      ft2: 92_903.04,
      yd2: 836_127.36,
      mi2: 2_589_988_110_336,
      acres: 4_046_856_422.4,
      hectares: 10_000_000_000,
    },
  },
  volume: {
    name: "Volume",
    icon: "🧪",
    units: {
      mL: { label: "Milliliter", symbol: "mL" },
      L: { label: "Liter", symbol: "L" },
      galUS: { label: "Gallon (US)", symbol: "gal (US)" },
      galUK: { label: "Gallon (UK)", symbol: "gal (UK)" },
      floz: { label: "Fluid Ounce (US)", symbol: "fl oz" },
      cup: { label: "Cup (US)", symbol: "cup" },
      pint: { label: "Pint (US)", symbol: "pt" },
      quart: { label: "Quart (US)", symbol: "qt" },
      m3: { label: "Cubic Meter", symbol: "m\u00B3" },
    },
    factors: {
      mL: 1,
      L: 1000,
      galUS: 3785.411784,
      galUK: 4546.09,
      floz: 29.5735295625,
      cup: 236.588236,
      pint: 473.176473,
      quart: 946.352946,
      m3: 1_000_000,
    },
  },
  speed: {
    name: "Speed",
    icon: "💨",
    units: {
      ms: { label: "Meters/second", symbol: "m/s" },
      kmh: { label: "Kilometers/hour", symbol: "km/h" },
      mph: { label: "Miles/hour", symbol: "mph" },
      knots: { label: "Knots", symbol: "kn" },
      fts: { label: "Feet/second", symbol: "ft/s" },
    },
    factors: {
      ms: 1,
      kmh: 0.277778,
      mph: 0.44704,
      knots: 0.514444,
      fts: 0.3048,
    },
  },
  time: {
    name: "Time",
    icon: "⏱️",
    units: {
      ms: { label: "Millisecond", symbol: "ms" },
      s: { label: "Second", symbol: "s" },
      min: { label: "Minute", symbol: "min" },
      hr: { label: "Hour", symbol: "hr" },
      day: { label: "Day", symbol: "day" },
      week: { label: "Week", symbol: "wk" },
      month: { label: "Month (30d)", symbol: "mo" },
      year: { label: "Year (365d)", symbol: "yr" },
    },
    factors: {
      ms: 1,
      s: 1000,
      min: 60_000,
      hr: 3_600_000,
      day: 86_400_000,
      week: 604_800_000,
      month: 2_592_000_000,
      year: 31_536_000_000,
    },
  },
  data: {
    name: "Data",
    icon: "💾",
    units: {
      bit: { label: "Bit", symbol: "bit" },
      byte: { label: "Byte", symbol: "B" },
      KB: { label: "Kilobyte (SI)", symbol: "KB" },
      MB: { label: "Megabyte (SI)", symbol: "MB" },
      GB: { label: "Gigabyte (SI)", symbol: "GB" },
      TB: { label: "Terabyte (SI)", symbol: "TB" },
      PB: { label: "Petabyte (SI)", symbol: "PB" },
      KiB: { label: "Kibibyte", symbol: "KiB" },
      MiB: { label: "Mebibyte", symbol: "MiB" },
      GiB: { label: "Gibibyte", symbol: "GiB" },
    },
    factors: {
      bit: 1,
      byte: 8,
      KB: 8_000,
      MB: 8_000_000,
      GB: 8_000_000_000,
      TB: 8_000_000_000_000,
      PB: 8_000_000_000_000_000,
      KiB: 8_192,
      MiB: 8_388_608,
      GiB: 8_589_934_592,
    },
  },
  css: {
    name: "CSS/Web",
    icon: "🌐",
    units: {
      px: { label: "Pixels", symbol: "px" },
      rem: { label: "Root Em", symbol: "rem" },
      em: { label: "Em", symbol: "em" },
      pt: { label: "Points", symbol: "pt" },
      vw: { label: "Viewport Width %", symbol: "vw" },
      vh: { label: "Viewport Height %", symbol: "vh" },
    },
  },
  pressure: {
    name: "Pressure",
    icon: "🔵",
    units: {
      Pa: { label: "Pascal", symbol: "Pa" },
      kPa: { label: "Kilopascal", symbol: "kPa" },
      bar: { label: "Bar", symbol: "bar" },
      atm: { label: "Atmosphere", symbol: "atm" },
      psi: { label: "PSI", symbol: "psi" },
      mmHg: { label: "mmHg", symbol: "mmHg" },
    },
    factors: {
      Pa: 1,
      kPa: 1000,
      bar: 100_000,
      atm: 101_325,
      psi: 6894.757,
      mmHg: 133.322,
    },
  },
};

/* ------------------------------------------------------------------ */
/*  CSS conversion (special: needs baseFontSize + viewport)            */
/* ------------------------------------------------------------------ */

function convertCSS(
  value: number,
  from: string,
  to: string,
  baseFontSize: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  // Convert everything to px first
  const toPx: Record<string, (v: number) => number> = {
    px: (v) => v,
    rem: (v) => v * baseFontSize,
    em: (v) => v * baseFontSize,
    pt: (v) => v * (4 / 3),
    vw: (v) => (v / 100) * viewportWidth,
    vh: (v) => (v / 100) * viewportHeight,
  };
  const fromPx: Record<string, (v: number) => number> = {
    px: (v) => v,
    rem: (v) => v / baseFontSize,
    em: (v) => v / baseFontSize,
    pt: (v) => v / (4 / 3),
    vw: (v) => (v / viewportWidth) * 100,
    vh: (v) => (v / viewportHeight) * 100,
  };
  const px = toPx[from]?.(value) ?? value;
  return fromPx[to]?.(px) ?? px;
}

function getCSSFormula(from: string, to: string, baseFontSize: number): string {
  if (from === to) return `1 ${from} = 1 ${to}`;
  // Describe via px intermediate
  const descriptions: Record<string, string> = {
    px: "px",
    rem: `rem (* ${baseFontSize}px)`,
    em: `em (* ${baseFontSize}px)`,
    pt: "pt (* 1.333px)",
    vw: "vw (% of viewport width)",
    vh: "vh (% of viewport height)",
  };
  return `${descriptions[from] || from} -> px -> ${descriptions[to] || to}`;
}

/* ------------------------------------------------------------------ */
/*  Generic factor-based conversion                                    */
/* ------------------------------------------------------------------ */

function convertByFactor(
  value: number,
  fromFactor: number,
  toFactor: number,
): number {
  return (value * fromFactor) / toFactor;
}

function getFactorFormula(
  cat: CategoryDef,
  from: string,
  to: string,
): string {
  if (!cat.factors) return "";
  const ff = cat.factors[from];
  const tf = cat.factors[to];
  if (ff === undefined || tf === undefined) return "";
  const fromSym = cat.units[from].symbol;
  const toSym = cat.units[to].symbol;
  if (from === to) return `1 ${fromSym} = 1 ${toSym}`;
  const ratio = ff / tf;
  const display = ratio >= 0.0001 && ratio < 1_000_000
    ? parseFloat(ratio.toPrecision(8))
    : ratio.toExponential(4);
  return `1 ${fromSym} = ${display} ${toSym}`;
}

/* ------------------------------------------------------------------ */
/*  Smart number formatting                                            */
/* ------------------------------------------------------------------ */

function formatResult(n: number): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e15 || (abs < 1e-10 && abs > 0)) return n.toExponential(6);
  if (Number.isInteger(n) && abs < 1e15) return n.toLocaleString("en-US");
  // Show enough decimals for precision
  const str = n.toPrecision(10);
  // Remove trailing zeros
  return parseFloat(str).toString();
}

/* ------------------------------------------------------------------ */
/*  LocalStorage helpers                                               */
/* ------------------------------------------------------------------ */

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded, ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

let nextHistoryId = 0;

export default function UnitConverterPage() {
  const [activeCategory, setActiveCategory] = useState("length");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("ft");
  const [fromValue, setFromValue] = useState("1");
  const [toValue, setToValue] = useState("");
  const [lastEdited, setLastEdited] = useState<"from" | "to">("from");
  const [copied, setCopied] = useState(false);
  const [baseFontSize, setBaseFontSize] = useState(16);
  const [viewportWidth, setViewportWidth] = useState(1920);
  const [viewportHeight, setViewportHeight] = useState(1080);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoritePair[]>([]);
  const [showTable, setShowTable] = useState(true);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Load persisted state
  useEffect(() => {
    setHistory(loadJSON<HistoryEntry[]>("uc-history", []));
    setFavorites(loadJSON<FavoritePair[]>("uc-favorites", []));
    if (typeof window !== "undefined") {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    }
  }, []);

  // Persist
  useEffect(() => { saveJSON("uc-history", history); }, [history]);
  useEffect(() => { saveJSON("uc-favorites", favorites); }, [favorites]);

  const cat = CATEGORIES[activeCategory];
  const unitKeys = useMemo(() => Object.keys(cat.units), [cat]);

  // ----- core convert function -----
  const convert = useCallback(
    (value: number, from: string, to: string): number => {
      if (from === to) return value;
      if (cat.convert) return cat.convert(value, from, to);
      if (activeCategory === "css") {
        return convertCSS(value, from, to, baseFontSize, viewportWidth, viewportHeight);
      }
      if (cat.factors) {
        return convertByFactor(value, cat.factors[from], cat.factors[to]);
      }
      return value;
    },
    [cat, activeCategory, baseFontSize, viewportWidth, viewportHeight],
  );

  // ----- recalc on dependency changes -----
  useEffect(() => {
    if (lastEdited === "from") {
      const v = parseFloat(fromValue);
      if (!isNaN(v)) {
        setToValue(formatResult(convert(v, fromUnit, toUnit)));
      } else {
        setToValue("");
      }
    } else {
      const v = parseFloat(toValue);
      if (!isNaN(v)) {
        setFromValue(formatResult(convert(v, toUnit, fromUnit)));
      } else {
        setFromValue("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUnit, toUnit, convert]);

  // ----- handlers -----
  const handleFromChange = (raw: string) => {
    setFromValue(raw);
    setLastEdited("from");
    const v = parseFloat(raw);
    if (!isNaN(v)) {
      setToValue(formatResult(convert(v, fromUnit, toUnit)));
    } else {
      setToValue("");
    }
  };

  const handleToChange = (raw: string) => {
    setToValue(raw);
    setLastEdited("to");
    const v = parseFloat(raw);
    if (!isNaN(v)) {
      setFromValue(formatResult(convert(v, toUnit, fromUnit)));
    } else {
      setFromValue("");
    }
  };

  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
    setFromValue(toValue);
    setToValue(fromValue);
    setLastEdited((prev) => (prev === "from" ? "to" : "from"));
  };

  const handleCategoryChange = (key: string) => {
    setActiveCategory(key);
    const units = Object.keys(CATEGORIES[key].units);
    setFromUnit(units[0]);
    setToUnit(units[1] || units[0]);
    setFromValue("1");
    setLastEdited("from");
  };

  const addToHistory = useCallback(() => {
    if (!fromValue || !toValue) return;
    setHistory((prev) => {
      const entry: HistoryEntry = {
        id: ++nextHistoryId,
        category: activeCategory,
        fromValue,
        fromUnit,
        toValue,
        toUnit,
        timestamp: Date.now(),
      };
      return [entry, ...prev].slice(0, 10);
    });
  }, [fromValue, toValue, activeCategory, fromUnit, toUnit]);

  // Add to history when user stops typing (debounced via blur)
  const handleInputBlur = () => {
    addToHistory();
  };

  const copyResult = async () => {
    const text = lastEdited === "from" ? toValue : fromValue;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard not available */ }
  };

  const isFavorite = useMemo(
    () =>
      favorites.some(
        (f) =>
          f.category === activeCategory &&
          ((f.fromUnit === fromUnit && f.toUnit === toUnit) ||
            (f.fromUnit === toUnit && f.toUnit === fromUnit)),
      ),
    [favorites, activeCategory, fromUnit, toUnit],
  );

  const toggleFavorite = () => {
    if (isFavorite) {
      setFavorites((prev) =>
        prev.filter(
          (f) =>
            !(
              f.category === activeCategory &&
              ((f.fromUnit === fromUnit && f.toUnit === toUnit) ||
                (f.fromUnit === toUnit && f.toUnit === fromUnit))
            ),
        ),
      );
    } else {
      setFavorites((prev) => [
        ...prev,
        { category: activeCategory, fromUnit, toUnit },
      ]);
    }
  };

  const loadFavorite = (fav: FavoritePair) => {
    setActiveCategory(fav.category);
    setFromUnit(fav.fromUnit);
    setToUnit(fav.toUnit);
    setFromValue("1");
    setLastEdited("from");
  };

  // ----- formula display -----
  const formulaText = useMemo(() => {
    if (fromUnit === toUnit) return `1 ${cat.units[fromUnit].symbol} = 1 ${cat.units[toUnit].symbol}`;
    if (cat.formula) return cat.formula(fromUnit, toUnit);
    if (activeCategory === "css") return getCSSFormula(fromUnit, toUnit, baseFontSize);
    return getFactorFormula(cat, fromUnit, toUnit);
  }, [cat, fromUnit, toUnit, activeCategory, baseFontSize]);

  // ----- conversion table (all units) -----
  const conversionTable = useMemo(() => {
    const sourceValue = lastEdited === "from" ? parseFloat(fromValue) : parseFloat(toValue);
    const sourceUnit = lastEdited === "from" ? fromUnit : toUnit;
    if (isNaN(sourceValue)) return [];
    return unitKeys.map((key) => ({
      key,
      label: cat.units[key].label,
      symbol: cat.units[key].symbol,
      value: formatResult(convert(sourceValue, sourceUnit, key)),
      isSource: key === sourceUnit,
    }));
  }, [unitKeys, cat, fromValue, toValue, fromUnit, toUnit, lastEdited, convert]);

  /* ---- styles (reusable) ---- */
  const inputClass =
    "w-full bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-lg px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all placeholder:text-[var(--muted)]";
  const selectClass =
    "w-full bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all cursor-pointer";
  const btnClass =
    "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all";
  const btnPrimary = `${btnClass} bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]`;
  const btnGhost = `${btnClass} text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]`;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* ---- header ---- */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] shrink-0">
        <Link
          href="/"
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Back to home"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-base font-semibold text-[var(--foreground)]">
          Unit Converter
        </h1>
        <div className="flex-1" />
        <button
          onClick={toggleFavorite}
          className={`${btnGhost} ${isFavorite ? "text-yellow-500" : ""}`}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
        </button>
        <button onClick={copyResult} className={btnGhost} title="Copy result" aria-label="Copy result">
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
        </button>
      </header>

      {/* ---- category tabs ---- */}
      <div
        ref={tabsRef}
        className="flex gap-1 px-4 py-2 overflow-x-auto border-b border-[var(--border)] shrink-0 scrollbar-none"
        role="tablist"
        aria-label="Unit categories"
      >
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeCategory === key}
            onClick={() => handleCategoryChange(key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeCategory === key
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <span className="mr-1">{c.icon}</span>
            {c.name}
          </button>
        ))}
      </div>

      {/* ---- main content (scrollable) ---- */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
          {/* CSS base font size / viewport inputs */}
          {activeCategory === "css" && (
            <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                Base font size
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={baseFontSize}
                  onChange={(e) => setBaseFontSize(Math.max(1, Number(e.target.value) || 16))}
                  className="w-16 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)] font-mono"
                />
                <span className="text-[var(--muted)]">px</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                Viewport
                <input
                  type="number"
                  min={1}
                  value={viewportWidth}
                  onChange={(e) => setViewportWidth(Math.max(1, Number(e.target.value) || 1920))}
                  className="w-20 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)] font-mono"
                />
                <span className="text-[var(--muted)]">x</span>
                <input
                  type="number"
                  min={1}
                  value={viewportHeight}
                  onChange={(e) => setViewportHeight(Math.max(1, Number(e.target.value) || 1080))}
                  className="w-20 bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)] font-mono"
                />
                <span className="text-[var(--muted)]">px</span>
              </label>
            </div>
          )}

          {/* ---- converter inputs ---- */}
          <div className="flex items-start gap-3">
            {/* FROM */}
            <div className="flex-1 flex flex-col gap-2">
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className={selectClass}
                aria-label="From unit"
              >
                {unitKeys.map((key) => (
                  <option key={key} value={key}>
                    {cat.units[key].symbol} — {cat.units[key].label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                value={fromValue}
                onChange={(e) => handleFromChange(e.target.value)}
                onBlur={handleInputBlur}
                placeholder="0"
                className={inputClass}
                aria-label={`Value in ${cat.units[fromUnit]?.label ?? fromUnit}`}
              />
            </div>

            {/* SWAP */}
            <button
              onClick={handleSwap}
              className="mt-8 shrink-0 flex items-center justify-center w-10 h-10 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
              aria-label="Swap units"
            >
              <ArrowLeftRight size={18} />
            </button>

            {/* TO */}
            <div className="flex-1 flex flex-col gap-2">
              <select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                className={selectClass}
                aria-label="To unit"
              >
                {unitKeys.map((key) => (
                  <option key={key} value={key}>
                    {cat.units[key].symbol} — {cat.units[key].label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                value={toValue}
                onChange={(e) => handleToChange(e.target.value)}
                onBlur={handleInputBlur}
                placeholder="0"
                className={inputClass}
                aria-label={`Value in ${cat.units[toUnit]?.label ?? toUnit}`}
              />
            </div>
          </div>

          {/* ---- formula ---- */}
          {formulaText && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--muted)]">
              <Info size={14} className="shrink-0" />
              <span className="font-mono">{formulaText}</span>
            </div>
          )}

          {/* ---- favorites ---- */}
          {favorites.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Favorites
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {favorites.map((fav, i) => {
                  const fc = CATEGORIES[fav.category];
                  if (!fc) return null;
                  return (
                    <button
                      key={i}
                      onClick={() => loadFavorite(fav)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-xs text-[var(--foreground)] transition-all"
                    >
                      <span>{fc.icon}</span>
                      <span className="font-mono">
                        {fc.units[fav.fromUnit]?.symbol} → {fc.units[fav.toUnit]?.symbol}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---- conversion table ---- */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowTable((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider hover:text-[var(--foreground)] transition-colors"
            >
              <Table size={14} />
              All conversions
              <span className="text-[10px] font-normal normal-case">
                ({showTable ? "hide" : "show"})
              </span>
            </button>
            {showTable && conversionTable.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="bg-[var(--surface)]">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-[var(--muted)]">
                        Unit
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--muted)]">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversionTable.map((row) => (
                      <tr
                        key={row.key}
                        className={`border-t border-[var(--border)] transition-colors ${
                          row.isSource
                            ? "bg-[var(--accent)]/10"
                            : "hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        <td className="px-3 py-1.5 text-[var(--foreground)]">
                          <span className="font-mono text-xs mr-1.5 text-[var(--accent)]">
                            {row.symbol}
                          </span>
                          <span className="text-[var(--muted)] text-xs">{row.label}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-[var(--foreground)]">
                          {row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---- history ---- */}
          {history.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                  <Clock size={14} />
                  Recent conversions
                </h3>
                <button
                  onClick={() => setHistory([])}
                  className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-red-500 transition-colors"
                  aria-label="Clear history"
                >
                  <Trash2 size={12} />
                  Clear
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {history.map((entry) => {
                  const hc = CATEGORIES[entry.category];
                  if (!hc) return null;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => {
                        setActiveCategory(entry.category);
                        setFromUnit(entry.fromUnit);
                        setToUnit(entry.toUnit);
                        setFromValue(entry.fromValue);
                        setToValue(entry.toValue);
                        setLastEdited("from");
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] text-xs transition-all text-left"
                    >
                      <span>{hc.icon}</span>
                      <span className="font-mono text-[var(--foreground)]">
                        {entry.fromValue} {hc.units[entry.fromUnit]?.symbol}
                      </span>
                      <span className="text-[var(--muted)]">=</span>
                      <span className="font-mono text-[var(--foreground)]">
                        {entry.toValue} {hc.units[entry.toUnit]?.symbol}
                      </span>
                      <span className="ml-auto text-[var(--muted)] text-[10px]">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
