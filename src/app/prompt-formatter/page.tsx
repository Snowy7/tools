"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  Copy,
  FileText,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  Variable,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Tag {
  id: string;
  text: string;
  weight: number;
}

interface VariableEntry {
  id: string;
  key: string;
  value: string;
}

interface HistoryEntry {
  id: string;
  positive: string;
  negative: string;
  timestamp: number;
}

interface Template {
  name: string;
  category: string;
  positive: Tag[];
  negative: Tag[];
}

/* ------------------------------------------------------------------ */
/*  Presets                                                             */
/* ------------------------------------------------------------------ */

const TEMPLATES: Template[] = [
  {
    name: "Portrait Photo",
    category: "Photography",
    positive: [
      { id: "t1", text: "portrait photograph", weight: 1.3 },
      { id: "t2", text: "beautiful lighting", weight: 1.2 },
      { id: "t3", text: "shallow depth of field", weight: 1.1 },
      { id: "t4", text: "sharp focus", weight: 1.0 },
      { id: "t5", text: "professional", weight: 1.0 },
      { id: "t6", text: "85mm lens", weight: 1.0 },
    ],
    negative: [
      { id: "n1", text: "blurry", weight: 1.0 },
      { id: "n2", text: "distorted", weight: 1.0 },
      { id: "n3", text: "low quality", weight: 1.0 },
    ],
  },
  {
    name: "Landscape",
    category: "Photography",
    positive: [
      { id: "t1", text: "landscape photograph", weight: 1.3 },
      { id: "t2", text: "golden hour", weight: 1.2 },
      { id: "t3", text: "dramatic sky", weight: 1.1 },
      { id: "t4", text: "wide angle", weight: 1.0 },
      { id: "t5", text: "high detail", weight: 1.1 },
      { id: "t6", text: "4k", weight: 1.0 },
    ],
    negative: [
      { id: "n1", text: "oversaturated", weight: 1.0 },
      { id: "n2", text: "blurry", weight: 1.0 },
      { id: "n3", text: "watermark", weight: 1.0 },
    ],
  },
  {
    name: "Product Photo",
    category: "Commercial",
    positive: [
      { id: "t1", text: "product photography", weight: 1.3 },
      { id: "t2", text: "studio lighting", weight: 1.2 },
      { id: "t3", text: "white background", weight: 1.1 },
      { id: "t4", text: "commercial quality", weight: 1.1 },
      { id: "t5", text: "sharp", weight: 1.0 },
      { id: "t6", text: "centered composition", weight: 1.0 },
    ],
    negative: [
      { id: "n1", text: "shadows", weight: 1.0 },
      { id: "n2", text: "cluttered", weight: 1.0 },
      { id: "n3", text: "low resolution", weight: 1.0 },
    ],
  },
  {
    name: "Anime",
    category: "Illustration",
    positive: [
      { id: "t1", text: "anime style", weight: 1.3 },
      { id: "t2", text: "masterpiece", weight: 1.2 },
      { id: "t3", text: "best quality", weight: 1.2 },
      { id: "t4", text: "detailed eyes", weight: 1.1 },
      { id: "t5", text: "vivid colors", weight: 1.0 },
      { id: "t6", text: "illustration", weight: 1.0 },
    ],
    negative: [
      { id: "n1", text: "bad anatomy", weight: 1.2 },
      { id: "n2", text: "extra fingers", weight: 1.1 },
      { id: "n3", text: "lowres", weight: 1.0 },
      { id: "n4", text: "bad hands", weight: 1.1 },
    ],
  },
  {
    name: "Concept Art",
    category: "Illustration",
    positive: [
      { id: "t1", text: "concept art", weight: 1.3 },
      { id: "t2", text: "digital painting", weight: 1.2 },
      { id: "t3", text: "highly detailed", weight: 1.1 },
      { id: "t4", text: "artstation", weight: 1.0 },
      { id: "t5", text: "cinematic lighting", weight: 1.1 },
      { id: "t6", text: "epic composition", weight: 1.0 },
    ],
    negative: [
      { id: "n1", text: "photo", weight: 1.0 },
      { id: "n2", text: "blurry", weight: 1.0 },
      { id: "n3", text: "amateur", weight: 1.0 },
    ],
  },
  {
    name: "Cinematic",
    category: "Photography",
    positive: [
      { id: "t1", text: "cinematic shot", weight: 1.3 },
      { id: "t2", text: "film grain", weight: 1.0 },
      { id: "t3", text: "anamorphic lens", weight: 1.1 },
      { id: "t4", text: "dramatic lighting", weight: 1.2 },
      { id: "t5", text: "color graded", weight: 1.1 },
      { id: "t6", text: "moody atmosphere", weight: 1.0 },
    ],
    negative: [
      { id: "n1", text: "flat", weight: 1.0 },
      { id: "n2", text: "overexposed", weight: 1.0 },
      { id: "n3", text: "cartoon", weight: 1.0 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let _uid = 0;
function uid() {
  return `id_${Date.now()}_${++_uid}`;
}

function formatTag(tag: Tag): string {
  if (tag.weight === 1.0) return tag.text;
  return `(${tag.text}:${tag.weight.toFixed(1)})`;
}

function formatPrompt(tags: Tag[], variables: VariableEntry[]): string {
  let result = tags.map(formatTag).join(", ");
  for (const v of variables) {
    if (v.key && v.value) {
      result = result.replaceAll(`{${v.key}}`, v.value);
    }
  }
  return result;
}

function parseTagsFromText(text: string): Tag[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const weightMatch = s.match(/^\((.+?):(\d+\.?\d*)\)$/);
      if (weightMatch) {
        return { id: uid(), text: weightMatch[1], weight: parseFloat(weightMatch[2]) };
      }
      return { id: uid(), text: s, weight: 1.0 };
    });
}

const HISTORY_KEY = "prompt-formatter-history";

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 50)));
}

/* ------------------------------------------------------------------ */
/*  Tag Pill                                                           */
/* ------------------------------------------------------------------ */

function TagPill({
  tag,
  onRemove,
  onWeightChange,
}: {
  tag: Tag;
  onRemove: () => void;
  onWeightChange: (w: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md text-[13px] leading-none"
      style={{
        background: tag.weight > 1.0 ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "var(--surface-hover)",
        border: "1px solid var(--border)",
        padding: "4px 6px",
      }}
    >
      <button
        className="cursor-pointer hover:opacity-70 shrink-0"
        onClick={() => setExpanded(!expanded)}
        title="Adjust weight"
      >
        {tag.text}
        {tag.weight !== 1.0 && (
          <span style={{ color: "var(--accent)", marginLeft: 2, fontWeight: 600 }}>
            :{tag.weight.toFixed(1)}
          </span>
        )}
      </button>
      {expanded && (
        <input
          type="range"
          min="0.1"
          max="2.0"
          step="0.1"
          value={tag.weight}
          onChange={(e) => onWeightChange(parseFloat(e.target.value))}
          className="w-16 h-3 accent-[var(--accent)]"
          title={`Weight: ${tag.weight.toFixed(1)}`}
        />
      )}
      <button
        className="cursor-pointer hover:opacity-60 shrink-0"
        onClick={onRemove}
        title="Remove tag"
        style={{ color: "var(--muted)" }}
      >
        <X size={12} />
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Tag Input                                                          */
/* ------------------------------------------------------------------ */

function TagInput({
  tags,
  setTags,
  placeholder,
}: {
  tags: Tag[];
  setTags: (t: Tag[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "," || e.key === "Enter") && input.trim()) {
      e.preventDefault();
      const newTags = parseTagsFromText(input);
      setTags([...tags, ...newTags]);
      setInput("");
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 rounded-lg cursor-text min-h-[72px]"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <TagPill
          key={tag.id}
          tag={tag}
          onRemove={() => setTags(tags.filter((t) => t.id !== tag.id))}
          onWeightChange={(w) =>
            setTags(tags.map((t) => (t.id === tag.id ? { ...t, weight: w } : t)))
          }
        />
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
        style={{ color: "var(--foreground)" }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function PromptFormatterPage() {
  /* State */
  const [positiveTags, setPositiveTags] = useState<Tag[]>([]);
  const [negativeTags, setNegativeTags] = useState<Tag[]>([]);
  const [variables, setVariables] = useState<VariableEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"positive" | "negative" | "variables">("positive");

  /* Load history on mount */
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  /* Formatted prompts */
  const positivePrompt = useMemo(
    () => formatPrompt(positiveTags, variables),
    [positiveTags, variables],
  );
  const negativePrompt = useMemo(
    () => formatPrompt(negativeTags, variables),
    [negativeTags, variables],
  );

  const totalChars = positivePrompt.length + negativePrompt.length;

  /* Copy */
  const copyText = useCallback(
    async (text: string, field: string) => {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    },
    [],
  );

  /* Save to history */
  const saveToHistory = useCallback(() => {
    if (!positivePrompt && !negativePrompt) return;
    const entry: HistoryEntry = {
      id: uid(),
      positive: positivePrompt,
      negative: negativePrompt,
      timestamp: Date.now(),
    };
    const updated = [entry, ...history.filter((h) => h.positive !== entry.positive || h.negative !== entry.negative)].slice(0, 50);
    setHistory(updated);
    saveHistory(updated);
  }, [positivePrompt, negativePrompt, history]);

  /* Apply template */
  const applyTemplate = useCallback((template: Template) => {
    setPositiveTags(template.positive.map((t) => ({ ...t, id: uid() })));
    setNegativeTags(template.negative.map((t) => ({ ...t, id: uid() })));
    setShowTemplates(false);
  }, []);

  /* Apply history entry */
  const applyHistory = useCallback((entry: HistoryEntry) => {
    setPositiveTags(parseTagsFromText(entry.positive));
    setNegativeTags(parseTagsFromText(entry.negative));
    setShowHistory(false);
  }, []);

  /* Variables management */
  const addVariable = useCallback(() => {
    setVariables((prev) => [...prev, { id: uid(), key: "", value: "" }]);
  }, []);

  const updateVariable = useCallback(
    (id: string, field: "key" | "value", val: string) => {
      setVariables((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: val } : v)));
    },
    [],
  );

  const removeVariable = useCallback((id: string) => {
    setVariables((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setPositiveTags([]);
    setNegativeTags([]);
    setVariables([]);
  }, []);

  /* Template categories */
  const templateCategories = useMemo(() => {
    const cats = new Map<string, Template[]>();
    for (const t of TEMPLATES) {
      if (!cats.has(t.category)) cats.set(t.category, []);
      cats.get(t.category)!.push(t);
    }
    return cats;
  }, []);

  /* Inline style helpers */
  const btnStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  const btnPrimary: React.CSSProperties = {
    ...btnStyle,
    background: "var(--accent)",
    border: "1px solid var(--accent)",
    color: "#fff",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "var(--muted)",
    marginBottom: 6,
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <Link
          href="/"
          className="flex items-center justify-center rounded-md"
          style={{
            width: 32,
            height: 32,
            background: "var(--surface-hover)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
          title="Back"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--accent)" }} />
          <h1 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Prompt Formatter
          </h1>
        </div>
        <div className="flex-1" />

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {totalChars} chars
          </span>

          <div className="relative">
            <button style={btnStyle} onClick={() => { setShowTemplates(!showTemplates); setShowHistory(false); }}>
              <FileText size={14} /> Templates <ChevronDown size={12} />
            </button>
            {showTemplates && (
              <div
                className="absolute right-0 top-full mt-1 w-64 rounded-lg shadow-lg z-50 overflow-auto"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  maxHeight: 360,
                }}
              >
                {Array.from(templateCategories.entries()).map(([cat, templates]) => (
                  <div key={cat}>
                    <div className="px-3 py-1.5 text-xs font-semibold" style={{ color: "var(--muted)", background: "var(--surface-hover)" }}>
                      {cat}
                    </div>
                    {templates.map((t) => (
                      <button
                        key={t.name}
                        className="w-full text-left px-3 py-2 text-sm cursor-pointer"
                        style={{ color: "var(--foreground)" }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                        onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={() => applyTemplate(t)}
                      >
                        {t.name}
                        <span className="block text-xs" style={{ color: "var(--muted)" }}>
                          {t.positive.length} positive, {t.negative.length} negative
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button style={btnStyle} onClick={() => { setShowHistory(!showHistory); setShowTemplates(false); }}>
              <Clock size={14} /> History
            </button>
            {showHistory && (
              <div
                className="absolute right-0 top-full mt-1 w-80 rounded-lg shadow-lg z-50 overflow-auto"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  maxHeight: 360,
                }}
              >
                {history.length === 0 ? (
                  <div className="p-4 text-sm text-center" style={{ color: "var(--muted)" }}>
                    No history yet. Copy a prompt to save it.
                  </div>
                ) : (
                  history.map((h) => (
                    <button
                      key={h.id}
                      className="w-full text-left px-3 py-2 text-sm cursor-pointer"
                      style={{ color: "var(--foreground)", borderBottom: "1px solid var(--border)" }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                      onClick={() => applyHistory(h)}
                    >
                      <span className="block truncate">{h.positive || "(empty positive)"}</span>
                      <span className="block text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button style={btnStyle} onClick={clearAll} title="Clear all">
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Editor */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: "1px solid var(--border)" }}>
          {/* Tabs */}
          <div className="flex shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            {(["positive", "negative", "variables"] as const).map((tab) => (
              <button
                key={tab}
                className="flex-1 py-2 text-sm font-medium cursor-pointer capitalize"
                style={{
                  color: activeTab === tab ? "var(--accent)" : "var(--muted)",
                  borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                  background: "transparent",
                }}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "positive" && `Positive (${positiveTags.length})`}
                {tab === "negative" && `Negative (${negativeTags.length})`}
                {tab === "variables" && `Variables (${variables.length})`}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === "positive" && (
              <div>
                <div style={sectionLabel}>Positive Prompt Tags</div>
                <TagInput
                  tags={positiveTags}
                  setTags={setPositiveTags}
                  placeholder="Type tags separated by commas... e.g. portrait, sharp focus, (beautiful:1.3)"
                />
                <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                  Click a tag to adjust its weight. Use {"{variable}"} syntax for substitution.
                </p>
              </div>
            )}

            {activeTab === "negative" && (
              <div>
                <div style={sectionLabel}>Negative Prompt Tags</div>
                <TagInput
                  tags={negativeTags}
                  setTags={setNegativeTags}
                  placeholder="Type negative tags... e.g. blurry, low quality, bad anatomy"
                />
                <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                  These tags will be used as the negative prompt to avoid unwanted features.
                </p>
              </div>
            )}

            {activeTab === "variables" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div style={sectionLabel} className="mb-0">
                    Variables
                  </div>
                  <button style={btnStyle} onClick={addVariable}>
                    <Plus size={14} /> Add
                  </button>
                </div>
                <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
                  Define variables as {"{key}"} in your tags, then set values here. They get substituted in the output.
                </p>
                {variables.length === 0 ? (
                  <div
                    className="rounded-lg p-6 text-center text-sm"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
                  >
                    <Variable size={24} className="mx-auto mb-2 opacity-40" />
                    No variables defined. Click &quot;Add&quot; to create one.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {variables.map((v) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <span className="text-sm shrink-0" style={{ color: "var(--muted)" }}>{"{"}</span>
                        <input
                          value={v.key}
                          onChange={(e) => updateVariable(v.id, "key", e.target.value)}
                          placeholder="key"
                          className="flex-1 rounded-md px-2 py-1.5 text-sm outline-none"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            color: "var(--foreground)",
                          }}
                        />
                        <span className="text-sm shrink-0" style={{ color: "var(--muted)" }}>{"}"} =</span>
                        <input
                          value={v.value}
                          onChange={(e) => updateVariable(v.id, "value", e.target.value)}
                          placeholder="value"
                          className="flex-[2] rounded-md px-2 py-1.5 text-sm outline-none"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            color: "var(--foreground)",
                          }}
                        />
                        <button
                          className="cursor-pointer shrink-0 p-1 rounded hover:opacity-70"
                          style={{ color: "var(--muted)" }}
                          onClick={() => removeVariable(v.id)}
                          title="Remove variable"
                        >
                          <Minus size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Output */}
        <div className="w-[420px] shrink-0 flex flex-col overflow-hidden" style={{ background: "var(--surface)" }}>
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide shrink-0" style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
            Formatted Output
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
            {/* Positive Output */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  POSITIVE ({positivePrompt.length} chars)
                </span>
                <button
                  style={{ ...btnStyle, padding: "3px 8px", fontSize: 12 }}
                  onClick={() => {
                    copyText(positivePrompt, "positive");
                    saveToHistory();
                  }}
                >
                  {copiedField === "positive" ? <Check size={12} /> : <Copy size={12} />}
                  {copiedField === "positive" ? "Copied" : "Copy"}
                </button>
              </div>
              <div
                className="rounded-lg p-3 text-sm whitespace-pre-wrap break-words min-h-[60px]"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: positivePrompt ? "var(--foreground)" : "var(--muted)",
                }}
              >
                {positivePrompt || "Add positive tags to generate prompt..."}
              </div>
            </div>

            {/* Negative Output */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  NEGATIVE ({negativePrompt.length} chars)
                </span>
                <button
                  style={{ ...btnStyle, padding: "3px 8px", fontSize: 12 }}
                  onClick={() => {
                    copyText(negativePrompt, "negative");
                    saveToHistory();
                  }}
                >
                  {copiedField === "negative" ? <Check size={12} /> : <Copy size={12} />}
                  {copiedField === "negative" ? "Copied" : "Copy"}
                </button>
              </div>
              <div
                className="rounded-lg p-3 text-sm whitespace-pre-wrap break-words min-h-[60px]"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: negativePrompt ? "var(--foreground)" : "var(--muted)",
                }}
              >
                {negativePrompt || "Add negative tags to generate prompt..."}
              </div>
            </div>

            {/* Copy Both */}
            <button
              style={btnPrimary}
              className="w-full justify-center"
              onClick={() => {
                const full = `${positivePrompt}\n\nNegative prompt: ${negativePrompt}`;
                copyText(full, "both");
                saveToHistory();
              }}
            >
              {copiedField === "both" ? <Check size={14} /> : <Copy size={14} />}
              {copiedField === "both" ? "Copied Both" : "Copy Full Prompt"}
            </button>

            {/* Active Variables Preview */}
            {variables.filter((v) => v.key && v.value).length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
                  ACTIVE VARIABLES
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variables
                    .filter((v) => v.key && v.value)
                    .map((v) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center gap-1 rounded-md text-xs px-2 py-1"
                        style={{
                          background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                          border: "1px solid var(--border)",
                          color: "var(--foreground)",
                        }}
                      >
                        <Variable size={10} style={{ color: "var(--accent)" }} />
                        {"{"}
                        {v.key}
                        {"}"} = {v.value}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
