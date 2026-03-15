"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Binary,
  Check,
  Copy,
  ChevronDown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Parse a string in a given base to a BigInt. Supports negative and 0x/0b/0o prefixes for 16/2/8. */
function parseBigInt(value: string, base: number): bigint | null {
  const s = value.trim();
  if (!s) return null;

  let negative = false;
  let raw = s;
  if (raw.startsWith("-")) {
    negative = true;
    raw = raw.slice(1);
  }

  // strip common prefixes
  if (base === 16 && raw.toLowerCase().startsWith("0x")) raw = raw.slice(2);
  if (base === 2 && raw.toLowerCase().startsWith("0b")) raw = raw.slice(2);
  if (base === 8 && raw.toLowerCase().startsWith("0o")) raw = raw.slice(2);

  // remove grouping spaces/underscores
  raw = raw.replace(/[\s_]/g, "");
  if (!raw) return null;

  const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
  const allowed = digits.slice(0, base);
  if (!raw.split("").every((c) => allowed.includes(c.toLowerCase()))) return null;

  let result = BigInt(0);
  const baseBig = BigInt(base);
  for (const ch of raw.toLowerCase()) {
    result = result * baseBig + BigInt(digits.indexOf(ch));
  }
  return negative ? -result : result;
}

/** Convert BigInt to string in given base, uppercase for hex. */
function toBigIntString(n: bigint, base: number): string {
  if (n === BigInt(0)) return "0";
  const negative = n < BigInt(0);
  let abs = negative ? -n : n;
  const digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const baseBig = BigInt(base);
  let result = "";
  while (abs > BigInt(0)) {
    result = digits[Number(abs % baseBig)] + result;
    abs = abs / baseBig;
  }
  return negative ? "-" + result : result;
}

/** Group binary string by n digits from right. */
function groupBinary(bin: string, groupSize: number): string {
  const negative = bin.startsWith("-");
  const raw = negative ? bin.slice(1) : bin;
  const padded = raw.padStart(Math.ceil(raw.length / groupSize) * groupSize, "0");
  const groups = [];
  for (let i = 0; i < padded.length; i += groupSize) {
    groups.push(padded.slice(i, i + groupSize));
  }
  return (negative ? "-" : "") + groups.join(" ");
}

/** Two's complement representation for a given bit width. */
function twosComplement(n: bigint, bits: number): string {
  if (n >= BigInt(0)) {
    return toBigIntString(n, 2).padStart(bits, "0");
  }
  const mask = (BigInt(1) << BigInt(bits)) - BigInt(1);
  const tc = (mask + BigInt(1) + n) & mask;
  return toBigIntString(tc, 2).padStart(bits, "0");
}

/** Determine minimum bits needed for two's complement. */
function minTwosComplementBits(n: bigint): number {
  if (n >= BigInt(0)) {
    const len = toBigIntString(n, 2).length;
    return len + 1; // sign bit
  }
  // for negative, find smallest power of 2 bit-width that can represent
  for (const bits of [8, 16, 32, 64]) {
    const min = -(BigInt(1) << BigInt(bits - 1));
    const max = (BigInt(1) << BigInt(bits - 1)) - BigInt(1);
    if (n >= min && n <= max) return bits;
  }
  return 64;
}

/* ------------------------------------------------------------------ */
/*  Preset bases                                                       */
/* ------------------------------------------------------------------ */

interface BaseField {
  label: string;
  base: number;
  prefix: string;
}

const PRESET_BASES: BaseField[] = [
  { label: "Binary", base: 2, prefix: "0b" },
  { label: "Octal", base: 8, prefix: "0o" },
  { label: "Decimal", base: 10, prefix: "" },
  { label: "Hexadecimal", base: 16, prefix: "0x" },
];

type BitwiseOp = "AND" | "OR" | "XOR" | "NOT" | "SHL" | "SHR";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BaseConverterPage() {
  /* Main conversion state */
  const [values, setValues] = useState<Record<number, string>>({ 2: "", 8: "", 10: "42", 16: "" });
  const [activeBase, setActiveBase] = useState(10);
  const [customBase, setCustomBase] = useState(36);
  const [customValue, setCustomValue] = useState("");
  const [groupSize, setGroupSize] = useState<4 | 8>(4);
  const [copied, setCopied] = useState<string | null>(null);

  /* Bitwise operation state */
  const [bitwiseA, setBitwiseA] = useState("255");
  const [bitwiseB, setBitwiseB] = useState("15");
  const [bitwiseOp, setBitwiseOp] = useState<BitwiseOp>("AND");
  const [shiftAmount, setShiftAmount] = useState("1");

  /* Current canonical value as BigInt */
  const currentValue = useMemo(() => {
    return parseBigInt(values[activeBase] ?? "", activeBase);
  }, [values, activeBase]);

  /* Computed conversions */
  const conversions = useMemo(() => {
    if (currentValue === null) return null;
    const result: Record<number, string> = {};
    for (const b of PRESET_BASES) {
      result[b.base] = toBigIntString(currentValue, b.base);
    }
    result[customBase] = toBigIntString(currentValue, customBase);
    return result;
  }, [currentValue, customBase]);

  /* Update a specific base field and recompute all others */
  const handleChange = useCallback((base: number, raw: string) => {
    if (base === customBase) {
      // custom field
      setCustomValue(raw);
    }
    setValues((prev) => ({ ...prev, [base]: raw }));
    setActiveBase(base);

    const parsed = parseBigInt(raw, base);
    if (parsed !== null) {
      const next: Record<number, string> = {};
      for (const b of PRESET_BASES) {
        next[b.base] = b.base === base ? raw : toBigIntString(parsed, b.base);
      }
      setValues(next);
      if (base !== customBase) {
        setCustomValue(toBigIntString(parsed, customBase));
      }
    }
  }, [customBase]);

  const handleCustomBaseChange = useCallback((newBase: number) => {
    setCustomBase(newBase);
    if (currentValue !== null) {
      setCustomValue(toBigIntString(currentValue, newBase));
    }
  }, [currentValue]);

  const handleCustomValueChange = useCallback((raw: string) => {
    setCustomValue(raw);
    const parsed = parseBigInt(raw, customBase);
    if (parsed !== null) {
      const next: Record<number, string> = {};
      for (const b of PRESET_BASES) {
        next[b.base] = toBigIntString(parsed, b.base);
      }
      setValues(next);
      setActiveBase(customBase);
    }
  }, [customBase]);

  /* Bit visualization */
  const bitCells = useMemo(() => {
    if (currentValue === null) return null;
    const bits = minTwosComplementBits(currentValue);
    const bitWidth = Math.max(8, Math.ceil(bits / 8) * 8);
    const tc = twosComplement(currentValue, bitWidth);
    return tc.split("");
  }, [currentValue]);

  /* Conversion steps */
  const conversionSteps = useMemo(() => {
    if (currentValue === null) return null;
    const dec = currentValue.toString();
    const steps: string[] = [];
    steps.push(`Decimal: ${dec}`);
    steps.push(`Binary:  ${toBigIntString(currentValue, 2)} (each digit is a power of 2)`);
    steps.push(`Octal:   ${toBigIntString(currentValue, 8)} (group binary by 3 bits)`);
    steps.push(`Hex:     ${toBigIntString(currentValue, 16)} (group binary by 4 bits)`);
    if (currentValue < BigInt(0)) {
      const bits = minTwosComplementBits(currentValue);
      steps.push(`Two's complement (${bits}-bit): ${twosComplement(currentValue, bits)}`);
    }
    return steps;
  }, [currentValue]);

  /* Bitwise result */
  const bitwiseResult = useMemo(() => {
    const a = parseBigInt(bitwiseA, 10);
    const b = parseBigInt(bitwiseB, 10);
    const shift = parseInt(shiftAmount) || 0;
    if (a === null) return null;

    let result: bigint;
    let formula: string;
    switch (bitwiseOp) {
      case "AND":
        if (b === null) return null;
        result = a & b;
        formula = `${a} & ${b}`;
        break;
      case "OR":
        if (b === null) return null;
        result = a | b;
        formula = `${a} | ${b}`;
        break;
      case "XOR":
        if (b === null) return null;
        result = a ^ b;
        formula = `${a} ^ ${b}`;
        break;
      case "NOT":
        result = ~a;
        formula = `~${a}`;
        break;
      case "SHL":
        result = a << BigInt(shift);
        formula = `${a} << ${shift}`;
        break;
      case "SHR":
        result = a >> BigInt(shift);
        formula = `${a} >> ${shift}`;
        break;
      default:
        return null;
    }

    return {
      decimal: result.toString(),
      binary: toBigIntString(result, 2),
      hex: toBigIntString(result, 16),
      formula,
    };
  }, [bitwiseA, bitwiseB, bitwiseOp, shiftAmount]);

  /* Copy helper */
  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const needsSecondOperand = bitwiseOp !== "NOT" && bitwiseOp !== "SHL" && bitwiseOp !== "SHR";
  const needsShift = bitwiseOp === "SHL" || bitwiseOp === "SHR";

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
          <Binary size={14} />
          <span className="text-sm font-semibold">Number Base Converter</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 space-y-4">

          {/* ---- Preset base fields ---- */}
          <section className="space-y-2">
            {PRESET_BASES.map((b) => {
              const display = activeBase === b.base ? values[b.base] ?? "" : (conversions?.[b.base] ?? values[b.base] ?? "");
              return (
                <div key={b.base} className="flex items-center gap-2">
                  <label className="text-xs font-medium text-[var(--muted)] w-24 flex-shrink-0 text-right">
                    {b.label}
                    <span className="text-[10px] opacity-60 ml-1">(base {b.base})</span>
                  </label>
                  <div className="flex-1 relative">
                    {b.prefix && (
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--muted)]">
                        {b.prefix}
                      </span>
                    )}
                    <input
                      type="text"
                      value={display}
                      onChange={(e) => handleChange(b.base, e.target.value)}
                      onFocus={() => setActiveBase(b.base)}
                      placeholder="0"
                      spellCheck={false}
                      className={`w-full font-mono text-sm px-3 py-2 rounded-lg border bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors ${
                        b.prefix ? "pl-8" : ""
                      } ${activeBase === b.base ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(display, `base-${b.base}`)}
                    className="w-7 h-7 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)] flex-shrink-0"
                    title="Copy"
                  >
                    {copied === `base-${b.base}` ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
              );
            })}

            {/* Custom base */}
            <div className="flex items-center gap-2">
              <div className="w-24 flex-shrink-0 flex items-center justify-end gap-1">
                <span className="text-xs font-medium text-[var(--muted)]">Base</span>
                <div className="relative">
                  <select
                    value={customBase}
                    onChange={(e) => handleCustomBaseChange(Number(e.target.value))}
                    className="appearance-none text-xs font-mono font-medium bg-[var(--surface)] border border-[var(--border)] rounded-md pl-2 pr-5 py-0.5 text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {Array.from({ length: 35 }, (_, i) => i + 2).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                </div>
              </div>
              <input
                type="text"
                value={activeBase === customBase ? (values[customBase] ?? customValue) : (conversions?.[customBase] ?? customValue)}
                onChange={(e) => handleCustomValueChange(e.target.value)}
                onFocus={() => setActiveBase(customBase)}
                placeholder="0"
                spellCheck={false}
                className={`flex-1 font-mono text-sm px-3 py-2 rounded-lg border bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-colors ${
                  activeBase === customBase ? "border-[var(--accent)]" : "border-[var(--border)]"
                }`}
              />
              <button
                type="button"
                onClick={() => copyToClipboard(conversions?.[customBase] ?? customValue, "custom")}
                className="w-7 h-7 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)] flex-shrink-0"
                title="Copy"
              >
                {copied === "custom" ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
          </section>

          {/* ---- Bit Visualization ---- */}
          {bitCells && bitCells.length <= 64 && (
            <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-[var(--foreground)]">Bit Visualization</h3>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--muted)]">Group by:</span>
                  <button
                    type="button"
                    onClick={() => setGroupSize(4)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${groupSize === 4 ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"}`}
                  >
                    4
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupSize(8)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${groupSize === 8 ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"}`}
                  >
                    8
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-0.5">
                {bitCells.map((bit, i) => {
                  const groupBoundary = i > 0 && i % groupSize === 0;
                  return (
                    <div key={i} className={`flex items-center ${groupBoundary ? "ml-2" : ""}`}>
                      <div
                        className={`w-6 h-6 rounded text-[10px] font-mono font-bold flex items-center justify-center transition-colors ${
                          bit === "1"
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]"
                        }`}
                      >
                        {bit}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 text-[10px] text-[var(--muted)] font-mono">
                {bitCells.length}-bit {currentValue !== null && currentValue < BigInt(0) ? "(two's complement)" : ""} ={" "}
                {currentValue !== null ? groupBinary(conversions?.[2] ?? toBigIntString(currentValue, 2), groupSize) : ""}
              </div>
            </section>
          )}

          {/* ---- Conversion Steps ---- */}
          {conversionSteps && (
            <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <h3 className="text-xs font-semibold text-[var(--foreground)] mb-2">Conversion Steps</h3>
              <div className="space-y-0.5">
                {conversionSteps.map((step, i) => (
                  <div key={i} className="text-xs font-mono text-[var(--muted)] leading-relaxed">
                    {step}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- Bitwise Operations ---- */}
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <h3 className="text-xs font-semibold text-[var(--foreground)] mb-3">Bitwise Operations</h3>

            <div className="flex flex-wrap items-end gap-3 mb-3">
              {/* Operand A */}
              <div className="flex-1 min-w-[120px]">
                <label className="text-[10px] text-[var(--muted)] font-medium block mb-1">Operand A (decimal)</label>
                <input
                  type="text"
                  value={bitwiseA}
                  onChange={(e) => setBitwiseA(e.target.value)}
                  className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="255"
                />
              </div>

              {/* Operation */}
              <div className="w-24">
                <label className="text-[10px] text-[var(--muted)] font-medium block mb-1">Operation</label>
                <div className="relative">
                  <select
                    value={bitwiseOp}
                    onChange={(e) => setBitwiseOp(e.target.value as BitwiseOp)}
                    className="appearance-none w-full text-sm font-mono font-medium bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                    <option value="XOR">XOR</option>
                    <option value="NOT">NOT</option>
                    <option value="SHL">&lt;&lt; SHL</option>
                    <option value="SHR">&gt;&gt; SHR</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                </div>
              </div>

              {/* Operand B */}
              {needsSecondOperand && (
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[10px] text-[var(--muted)] font-medium block mb-1">Operand B (decimal)</label>
                  <input
                    type="text"
                    value={bitwiseB}
                    onChange={(e) => setBitwiseB(e.target.value)}
                    className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder="15"
                  />
                </div>
              )}

              {/* Shift amount */}
              {needsShift && (
                <div className="w-24">
                  <label className="text-[10px] text-[var(--muted)] font-medium block mb-1">Shift by</label>
                  <input
                    type="text"
                    value={shiftAmount}
                    onChange={(e) => setShiftAmount(e.target.value)}
                    className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder="1"
                  />
                </div>
              )}
            </div>

            {/* Result */}
            {bitwiseResult && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 space-y-1.5">
                <div className="text-xs text-[var(--muted)] font-mono mb-1">{bitwiseResult.formula}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--muted)] w-10">DEC</span>
                  <span className="text-sm font-mono text-[var(--foreground)] flex-1">{bitwiseResult.decimal}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bitwiseResult.decimal, "bw-dec")}
                    className="w-6 h-6 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
                  >
                    {copied === "bw-dec" ? <Check size={10} /> : <Copy size={10} />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--muted)] w-10">BIN</span>
                  <span className="text-sm font-mono text-[var(--foreground)] flex-1 break-all">{bitwiseResult.binary}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bitwiseResult.binary, "bw-bin")}
                    className="w-6 h-6 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
                  >
                    {copied === "bw-bin" ? <Check size={10} /> : <Copy size={10} />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--muted)] w-10">HEX</span>
                  <span className="text-sm font-mono text-[var(--foreground)] flex-1">{bitwiseResult.hex}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bitwiseResult.hex, "bw-hex")}
                    className="w-6 h-6 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
                  >
                    {copied === "bw-hex" ? <Check size={10} /> : <Copy size={10} />}
                  </button>
                </div>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
