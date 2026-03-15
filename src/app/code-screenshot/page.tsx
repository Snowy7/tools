"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Code2,
  Download,
  Copy,
  Check,
  ChevronDown,
  Monitor,
  Type,
  Palette,
  Settings2,
  Eye,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Theme {
  name: string;
  bg: string;
  text: string;
  keyword: string;
  string: string;
  comment: string;
  number: string;
  function: string;
  lineNumber: string;
  operator?: string;
  type?: string;
}

type Language =
  | "javascript"
  | "typescript"
  | "python"
  | "html"
  | "css"
  | "json"
  | "rust"
  | "go"
  | "java"
  | "c"
  | "sql"
  | "bash"
  | "plaintext";

type WindowStyle = "macos" | "windows" | "none";
type BackgroundType = "solid" | "gradient" | "transparent";

interface Token {
  text: string;
  color: string;
}

interface ScreenshotSettings {
  theme: string;
  language: Language;
  fontFamily: string;
  fontSize: number;
  showWindowChrome: boolean;
  windowTitle: string;
  windowStyle: WindowStyle;
  backgroundType: BackgroundType;
  bgSolid: string;
  bgGradient1: string;
  bgGradient2: string;
  bgGradientAngle: number;
  padding: number;
  showLineNumbers: boolean;
  lineHeight: number;
  tabSize: number;
  highlightedLines: string;
  maxWidth: number;
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

const THEMES: Theme[] = [
  {
    name: "Monokai",
    bg: "#272822",
    text: "#f8f8f2",
    keyword: "#f92672",
    string: "#e6db74",
    comment: "#75715e",
    number: "#ae81ff",
    function: "#a6e22e",
    lineNumber: "#90908a",
    operator: "#f92672",
    type: "#66d9ef",
  },
  {
    name: "Dracula",
    bg: "#282a36",
    text: "#f8f8f2",
    keyword: "#ff79c6",
    string: "#f1fa8c",
    comment: "#6272a4",
    number: "#bd93f9",
    function: "#50fa7b",
    lineNumber: "#6272a4",
    operator: "#ff79c6",
    type: "#8be9fd",
  },
  {
    name: "GitHub Light",
    bg: "#ffffff",
    text: "#24292e",
    keyword: "#d73a49",
    string: "#032f62",
    comment: "#6a737d",
    number: "#005cc5",
    function: "#6f42c1",
    lineNumber: "#babbbd",
    operator: "#d73a49",
    type: "#005cc5",
  },
  {
    name: "GitHub Dark",
    bg: "#0d1117",
    text: "#c9d1d9",
    keyword: "#ff7b72",
    string: "#a5d6ff",
    comment: "#8b949e",
    number: "#79c0ff",
    function: "#d2a8ff",
    lineNumber: "#484f58",
    operator: "#ff7b72",
    type: "#79c0ff",
  },
  {
    name: "One Dark",
    bg: "#282c34",
    text: "#abb2bf",
    keyword: "#c678dd",
    string: "#98c379",
    comment: "#5c6370",
    number: "#d19a66",
    function: "#61afef",
    lineNumber: "#4b5263",
    operator: "#56b6c2",
    type: "#e5c07b",
  },
  {
    name: "Solarized Light",
    bg: "#fdf6e3",
    text: "#657b83",
    keyword: "#859900",
    string: "#2aa198",
    comment: "#93a1a1",
    number: "#d33682",
    function: "#268bd2",
    lineNumber: "#c0b99f",
    operator: "#859900",
    type: "#b58900",
  },
  {
    name: "Solarized Dark",
    bg: "#002b36",
    text: "#839496",
    keyword: "#859900",
    string: "#2aa198",
    comment: "#586e75",
    number: "#d33682",
    function: "#268bd2",
    lineNumber: "#4e6467",
    operator: "#859900",
    type: "#b58900",
  },
  {
    name: "Nord",
    bg: "#2e3440",
    text: "#d8dee9",
    keyword: "#81a1c1",
    string: "#a3be8c",
    comment: "#616e88",
    number: "#b48ead",
    function: "#88c0d0",
    lineNumber: "#4c566a",
    operator: "#81a1c1",
    type: "#8fbcbb",
  },
  {
    name: "Vitesse Dark",
    bg: "#121212",
    text: "#dbd7ca",
    keyword: "#4d9375",
    string: "#c98a7d",
    comment: "#758575",
    number: "#4c9a91",
    function: "#80a665",
    lineNumber: "#444444",
    operator: "#cb7676",
    type: "#5da9a7",
  },
  {
    name: "Night Owl",
    bg: "#011627",
    text: "#d6deeb",
    keyword: "#c792ea",
    string: "#ecc48d",
    comment: "#637777",
    number: "#f78c6c",
    function: "#82aaff",
    lineNumber: "#4b6479",
    operator: "#7fdbca",
    type: "#addb67",
  },
];

// ---------------------------------------------------------------------------
// Language keywords
// ---------------------------------------------------------------------------

const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  javascript: [
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "switch", "case", "break", "continue", "new", "this", "class",
    "extends", "import", "export", "default", "from", "async", "await",
    "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of",
    "null", "undefined", "true", "false", "yield", "delete", "void",
  ],
  typescript: [
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "switch", "case", "break", "continue", "new", "this", "class",
    "extends", "import", "export", "default", "from", "async", "await",
    "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of",
    "null", "undefined", "true", "false", "yield", "delete", "void",
    "interface", "type", "enum", "namespace", "module", "declare", "abstract",
    "implements", "readonly", "private", "protected", "public", "static",
    "as", "is", "keyof", "never", "unknown", "any",
  ],
  python: [
    "def", "class", "return", "if", "elif", "else", "for", "while", "break",
    "continue", "import", "from", "as", "try", "except", "finally", "raise",
    "with", "yield", "lambda", "pass", "del", "and", "or", "not", "in", "is",
    "True", "False", "None", "self", "async", "await", "global", "nonlocal",
  ],
  html: [
    "div", "span", "p", "a", "img", "input", "button", "form", "head", "body",
    "html", "script", "style", "link", "meta", "title", "h1", "h2", "h3",
    "ul", "ol", "li", "table", "tr", "td", "th", "section", "article",
    "header", "footer", "nav", "main",
  ],
  css: [
    "display", "position", "margin", "padding", "border", "width", "height",
    "color", "background", "font", "text", "flex", "grid", "align", "justify",
    "overflow", "z-index", "opacity", "transform", "transition", "animation",
    "none", "block", "inline", "relative", "absolute", "fixed", "sticky",
    "important", "inherit", "initial", "unset",
  ],
  json: [],
  rust: [
    "fn", "let", "mut", "const", "if", "else", "for", "while", "loop",
    "match", "return", "struct", "enum", "impl", "trait", "use", "mod",
    "pub", "self", "super", "crate", "as", "in", "ref", "move", "async",
    "await", "where", "type", "true", "false", "Some", "None", "Ok", "Err",
    "unsafe", "extern", "dyn", "static",
  ],
  go: [
    "func", "var", "const", "if", "else", "for", "range", "switch", "case",
    "default", "return", "struct", "interface", "type", "map", "chan",
    "package", "import", "go", "defer", "select", "break", "continue",
    "fallthrough", "goto", "nil", "true", "false", "make", "new", "append",
    "len", "cap",
  ],
  java: [
    "public", "private", "protected", "static", "final", "abstract", "class",
    "interface", "extends", "implements", "new", "return", "if", "else",
    "for", "while", "do", "switch", "case", "break", "continue", "try",
    "catch", "finally", "throw", "throws", "import", "package", "void",
    "int", "long", "double", "float", "boolean", "char", "byte", "short",
    "null", "true", "false", "this", "super", "instanceof",
  ],
  c: [
    "int", "char", "float", "double", "void", "long", "short", "unsigned",
    "signed", "const", "static", "extern", "struct", "union", "enum",
    "typedef", "if", "else", "for", "while", "do", "switch", "case",
    "break", "continue", "return", "sizeof", "NULL", "include", "define",
    "ifdef", "ifndef", "endif", "pragma",
  ],
  sql: [
    "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
    "DELETE", "CREATE", "TABLE", "ALTER", "DROP", "INDEX", "VIEW", "JOIN",
    "INNER", "LEFT", "RIGHT", "OUTER", "ON", "AND", "OR", "NOT", "NULL",
    "IS", "IN", "LIKE", "BETWEEN", "ORDER", "BY", "GROUP", "HAVING",
    "LIMIT", "OFFSET", "AS", "DISTINCT", "COUNT", "SUM", "AVG", "MAX", "MIN",
    "select", "from", "where", "insert", "into", "values", "update", "set",
    "delete", "create", "table", "alter", "drop", "join", "inner", "left",
    "right", "outer", "on", "and", "or", "not", "null", "is", "in", "like",
    "between", "order", "by", "group", "having", "limit", "offset", "as",
    "distinct", "count", "sum", "avg", "max", "min",
  ],
  bash: [
    "if", "then", "else", "elif", "fi", "for", "while", "do", "done",
    "case", "esac", "function", "return", "exit", "echo", "read", "export",
    "source", "alias", "unalias", "set", "unset", "local", "shift",
    "true", "false", "in",
  ],
  plaintext: [],
};

const LANGUAGE_LABELS: Record<Language, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  rust: "Rust",
  go: "Go",
  java: "Java",
  c: "C / C++",
  sql: "SQL",
  bash: "Bash",
  plaintext: "Plain Text",
};

const COMMENT_PATTERNS: Record<string, { line: string; blockStart?: string; blockEnd?: string }> = {
  javascript: { line: "//", blockStart: "/*", blockEnd: "*/" },
  typescript: { line: "//", blockStart: "/*", blockEnd: "*/" },
  python: { line: "#" },
  html: { line: "<!--", blockStart: "<!--", blockEnd: "-->" },
  css: { line: "/*", blockStart: "/*", blockEnd: "*/" },
  json: { line: "//" },
  rust: { line: "//", blockStart: "/*", blockEnd: "*/" },
  go: { line: "//", blockStart: "/*", blockEnd: "*/" },
  java: { line: "//", blockStart: "/*", blockEnd: "*/" },
  c: { line: "//", blockStart: "/*", blockEnd: "*/" },
  sql: { line: "--" },
  bash: { line: "#" },
  plaintext: { line: "" },
};

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

const FONTS = [
  { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
  { label: "Fira Code", value: "'Fira Code', monospace" },
  { label: "Source Code Pro", value: "'Source Code Pro', monospace" },
  { label: "Menlo", value: "Menlo, monospace" },
  { label: "Consolas", value: "Consolas, monospace" },
  { label: "System Mono", value: "monospace" },
];

// ---------------------------------------------------------------------------
// Default code
// ---------------------------------------------------------------------------

const DEFAULT_CODE = `function fibonacci(n) {
  // Return the nth Fibonacci number
  if (n <= 1) return n;

  let prev = 0;
  let curr = 1;

  for (let i = 2; i <= n; i++) {
    const next = prev + curr;
    prev = curr;
    curr = next;
  }

  return curr;
}

// Calculate the first 10 numbers
const results = Array.from({ length: 10 }, (_, i) => fibonacci(i));
console.log("Fibonacci:", results);`;

// ---------------------------------------------------------------------------
// Syntax highlighting engine
// ---------------------------------------------------------------------------

function highlightLine(line: string, lang: Language, theme: Theme): Token[] {
  if (lang === "plaintext" || lang === "json") {
    return highlightGeneric(line, lang, theme);
  }

  const tokens: Token[] = [];
  const keywords = LANGUAGE_KEYWORDS[lang] || [];
  const commentPattern = COMMENT_PATTERNS[lang];
  let remaining = line;

  while (remaining.length > 0) {
    // Check for line comments
    if (commentPattern?.line && remaining.trimStart().startsWith(commentPattern.line)) {
      const leadingSpaces = remaining.length - remaining.trimStart().length;
      if (leadingSpaces > 0) {
        tokens.push({ text: remaining.slice(0, leadingSpaces), color: theme.text });
      }
      tokens.push({ text: remaining.slice(leadingSpaces), color: theme.comment });
      remaining = "";
      continue;
    }

    // Leading whitespace
    const wsMatch = remaining.match(/^(\s+)/);
    if (wsMatch) {
      tokens.push({ text: wsMatch[1], color: theme.text });
      remaining = remaining.slice(wsMatch[1].length);
      continue;
    }

    // Strings (double, single, backtick)
    const strMatch = remaining.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/);
    if (strMatch) {
      tokens.push({ text: strMatch[1], color: theme.string });
      remaining = remaining.slice(strMatch[1].length);
      continue;
    }

    // Numbers
    const numMatch = remaining.match(/^(\b\d+\.?\d*(?:e[+-]?\d+)?\b)/i);
    if (numMatch) {
      tokens.push({ text: numMatch[1], color: theme.number });
      remaining = remaining.slice(numMatch[1].length);
      continue;
    }

    // HTML tags (for html lang)
    if (lang === "html") {
      const tagMatch = remaining.match(/^(<\/?[a-zA-Z][a-zA-Z0-9]*)/);
      if (tagMatch) {
        tokens.push({ text: tagMatch[1], color: theme.keyword });
        remaining = remaining.slice(tagMatch[1].length);
        continue;
      }
      const attrMatch = remaining.match(/^([a-zA-Z-]+)(=)/);
      if (attrMatch) {
        tokens.push({ text: attrMatch[1], color: theme.function });
        tokens.push({ text: attrMatch[2], color: theme.text });
        remaining = remaining.slice(attrMatch[0].length);
        continue;
      }
    }

    // CSS properties and values
    if (lang === "css") {
      const propMatch = remaining.match(/^([a-z-]+)(\s*:)/);
      if (propMatch) {
        tokens.push({ text: propMatch[1], color: theme.function });
        tokens.push({ text: propMatch[2], color: theme.text });
        remaining = remaining.slice(propMatch[0].length);
        continue;
      }
      const hexMatch = remaining.match(/^(#[0-9a-fA-F]{3,8})/);
      if (hexMatch) {
        tokens.push({ text: hexMatch[1], color: theme.number });
        remaining = remaining.slice(hexMatch[1].length);
        continue;
      }
      const unitMatch = remaining.match(/^(\d+\.?\d*)(px|em|rem|%|vh|vw|deg|s|ms)/);
      if (unitMatch) {
        tokens.push({ text: unitMatch[1], color: theme.number });
        tokens.push({ text: unitMatch[2], color: theme.keyword });
        remaining = remaining.slice(unitMatch[0].length);
        continue;
      }
    }

    // Identifiers / keywords
    const idMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (idMatch) {
      const word = idMatch[1];
      // Check if followed by ( for function detection
      const afterWord = remaining.slice(word.length);
      if (keywords.includes(word)) {
        tokens.push({ text: word, color: theme.keyword });
      } else if (afterWord.match(/^\s*\(/)) {
        tokens.push({ text: word, color: theme.function });
      } else if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
        tokens.push({ text: word, color: theme.type || theme.keyword });
      } else {
        tokens.push({ text: word, color: theme.text });
      }
      remaining = remaining.slice(word.length);
      continue;
    }

    // Operators and punctuation
    const opMatch = remaining.match(/^([=!<>]=?|[+\-*/%&|^~]|=>|\.{3}|[{}()\[\];:.,?]|&&|\|\|)/);
    if (opMatch) {
      tokens.push({ text: opMatch[1], color: theme.operator || theme.text });
      remaining = remaining.slice(opMatch[1].length);
      continue;
    }

    // Angle brackets for HTML/closing tags
    const angleMatch = remaining.match(/^([<>\/])/);
    if (angleMatch) {
      tokens.push({ text: angleMatch[1], color: theme.text });
      remaining = remaining.slice(1);
      continue;
    }

    // Any other character
    tokens.push({ text: remaining[0], color: theme.text });
    remaining = remaining.slice(1);
  }

  return tokens;
}

function highlightGeneric(line: string, lang: Language, theme: Theme): Token[] {
  if (lang === "json") {
    const tokens: Token[] = [];
    let remaining = line;
    while (remaining.length > 0) {
      const wsMatch = remaining.match(/^(\s+)/);
      if (wsMatch) {
        tokens.push({ text: wsMatch[1], color: theme.text });
        remaining = remaining.slice(wsMatch[1].length);
        continue;
      }
      // JSON keys (quoted strings followed by :)
      const keyMatch = remaining.match(/^("(?:[^"\\]|\\.)*")(\s*:)/);
      if (keyMatch) {
        tokens.push({ text: keyMatch[1], color: theme.function });
        tokens.push({ text: keyMatch[2], color: theme.text });
        remaining = remaining.slice(keyMatch[0].length);
        continue;
      }
      const strMatch = remaining.match(/^("(?:[^"\\]|\\.)*")/);
      if (strMatch) {
        tokens.push({ text: strMatch[1], color: theme.string });
        remaining = remaining.slice(strMatch[1].length);
        continue;
      }
      const numMatch = remaining.match(/^(-?\d+\.?\d*(?:e[+-]?\d+)?)/i);
      if (numMatch) {
        tokens.push({ text: numMatch[1], color: theme.number });
        remaining = remaining.slice(numMatch[1].length);
        continue;
      }
      const boolMatch = remaining.match(/^(true|false|null)\b/);
      if (boolMatch) {
        tokens.push({ text: boolMatch[1], color: theme.keyword });
        remaining = remaining.slice(boolMatch[1].length);
        continue;
      }
      tokens.push({ text: remaining[0], color: theme.text });
      remaining = remaining.slice(1);
    }
    return tokens;
  }
  return [{ text: line, color: theme.text }];
}

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

export default function CodeScreenshotPage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [settings, setSettings] = useState<ScreenshotSettings>({
    theme: "Monokai",
    language: "javascript",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14,
    showWindowChrome: true,
    windowTitle: "fibonacci.js",
    windowStyle: "macos",
    backgroundType: "gradient",
    bgSolid: "#667eea",
    bgGradient1: "#667eea",
    bgGradient2: "#764ba2",
    bgGradientAngle: 135,
    padding: 32,
    showLineNumbers: true,
    lineHeight: 1.6,
    tabSize: 2,
    highlightedLines: "",
    maxWidth: 680,
  });

  const update = useCallback(
    (patch: Partial<ScreenshotSettings>) =>
      setSettings((s) => ({ ...s, ...patch })),
    [],
  );

  const currentTheme = useMemo(
    () => THEMES.find((t) => t.name === settings.theme) || THEMES[0],
    [settings.theme],
  );

  const highlightedLineSet = useMemo(() => {
    const set = new Set<number>();
    if (!settings.highlightedLines.trim()) return set;
    settings.highlightedLines.split(",").forEach((part) => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const n = parseInt(trimmed, 10);
      if (!isNaN(n)) set.add(n);
    });
    return set;
  }, [settings.highlightedLines]);

  const lines = useMemo(() => code.split("\n"), [code]);

  const tokenizedLines = useMemo(
    () => lines.map((line) => highlightLine(line, settings.language, currentTheme)),
    [lines, settings.language, currentTheme],
  );

  // --- Background style ---
  const bgStyle = useMemo((): React.CSSProperties => {
    switch (settings.backgroundType) {
      case "solid":
        return { background: settings.bgSolid };
      case "gradient":
        return {
          background: `linear-gradient(${settings.bgGradientAngle}deg, ${settings.bgGradient1}, ${settings.bgGradient2})`,
        };
      case "transparent":
        return {
          background:
            "repeating-conic-gradient(#e0e0e0 0% 25%, #ffffff 0% 50%) 0 0 / 16px 16px",
        };
    }
  }, [settings.backgroundType, settings.bgSolid, settings.bgGradient1, settings.bgGradient2, settings.bgGradientAngle]);

  // --- Canvas export ---
  const exportPNG = useCallback(async () => {
    setExporting(true);
    try {
      const dpr = window.devicePixelRatio || 2;
      const padding = settings.padding;
      const chromeHeight = settings.showWindowChrome ? 40 : 0;
      const codePaddingX = 20;
      const codePaddingY = 16;
      const lineNumWidth = settings.showLineNumbers ? 48 : 0;
      const fontSize = settings.fontSize;
      const lineH = fontSize * settings.lineHeight;

      // Measure max line width
      const measureCanvas = document.createElement("canvas");
      const measureCtx = measureCanvas.getContext("2d")!;
      measureCtx.font = `${fontSize}px ${settings.fontFamily}`;

      let maxLineW = 0;
      for (const line of lines) {
        const expanded = line.replace(/\t/g, " ".repeat(settings.tabSize));
        const w = measureCtx.measureText(expanded).width;
        if (w > maxLineW) maxLineW = w;
      }

      const codeAreaW = Math.min(
        Math.max(maxLineW + lineNumWidth + codePaddingX * 2 + 20, 300),
        settings.maxWidth,
      );
      const codeAreaH = lines.length * lineH + codePaddingY * 2 + chromeHeight;

      const canvasW = codeAreaW + padding * 2;
      const canvasH = codeAreaH + padding * 2;

      const canvas = document.createElement("canvas");
      canvas.width = canvasW * dpr;
      canvas.height = canvasH * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);

      // Background
      if (settings.backgroundType === "transparent") {
        // transparent = fully transparent in export
        ctx.clearRect(0, 0, canvasW, canvasH);
      } else if (settings.backgroundType === "solid") {
        ctx.fillStyle = settings.bgSolid;
        ctx.fillRect(0, 0, canvasW, canvasH);
      } else {
        // gradient
        const angle = (settings.bgGradientAngle * Math.PI) / 180;
        const cx = canvasW / 2;
        const cy = canvasH / 2;
        const len = Math.sqrt(canvasW * canvasW + canvasH * canvasH) / 2;
        const grad = ctx.createLinearGradient(
          cx - Math.cos(angle) * len,
          cy - Math.sin(angle) * len,
          cx + Math.cos(angle) * len,
          cy + Math.sin(angle) * len,
        );
        grad.addColorStop(0, settings.bgGradient1);
        grad.addColorStop(1, settings.bgGradient2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvasW, canvasH);
      }

      // Window container (rounded rect)
      const winX = padding;
      const winY = padding;
      const winW = codeAreaW;
      const winH = codeAreaH;
      const radius = 10;

      ctx.beginPath();
      ctx.roundRect(winX, winY, winW, winH, radius);
      ctx.fillStyle = currentTheme.bg;
      ctx.fill();

      // Shadow
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
      ctx.beginPath();
      ctx.roundRect(winX, winY, winW, winH, radius);
      ctx.fillStyle = currentTheme.bg;
      ctx.fill();
      ctx.restore();

      // Re-draw window bg on top to ensure crisp
      ctx.beginPath();
      ctx.roundRect(winX, winY, winW, winH, radius);
      ctx.fillStyle = currentTheme.bg;
      ctx.fill();

      // Window chrome
      if (settings.showWindowChrome) {
        if (settings.windowStyle === "macos") {
          const dotY = winY + 20;
          const dotStartX = winX + 18;
          const colors = ["#ff5f57", "#ffbd2e", "#28c840"];
          colors.forEach((color, i) => {
            ctx.beginPath();
            ctx.arc(dotStartX + i * 22, dotY, 6, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
          });
        } else if (settings.windowStyle === "windows") {
          const btnY = winY + 10;
          const btnStartX = winX + winW - 80;
          // minimize
          ctx.fillStyle = currentTheme.lineNumber;
          ctx.fillRect(btnStartX, btnY + 14, 12, 2);
          // maximize
          ctx.strokeStyle = currentTheme.lineNumber;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(btnStartX + 24, btnY + 6, 12, 12);
          // close
          ctx.beginPath();
          ctx.moveTo(btnStartX + 48, btnY + 6);
          ctx.lineTo(btnStartX + 60, btnY + 18);
          ctx.moveTo(btnStartX + 60, btnY + 6);
          ctx.lineTo(btnStartX + 48, btnY + 18);
          ctx.strokeStyle = currentTheme.lineNumber;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Title
        if (settings.windowTitle) {
          ctx.font = `12px ${settings.fontFamily}`;
          ctx.fillStyle = currentTheme.lineNumber;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(settings.windowTitle, winX + winW / 2, winY + 20);
          ctx.textAlign = "start";
          ctx.textBaseline = "alphabetic";
        }
      }

      // Code lines
      ctx.font = `${fontSize}px ${settings.fontFamily}`;
      const codeStartY = winY + chromeHeight + codePaddingY + fontSize;
      const codeStartX = winX + codePaddingX;

      lines.forEach((rawLine, i) => {
        const y = codeStartY + i * lineH;
        const lineNum = i + 1;
        const isHighlighted = highlightedLineSet.has(lineNum);

        // Line highlight background
        if (isHighlighted) {
          ctx.fillStyle = currentTheme.keyword + "18";
          ctx.fillRect(winX, y - fontSize, winW, lineH);
        }

        // Line number
        if (settings.showLineNumbers) {
          ctx.fillStyle = currentTheme.lineNumber;
          ctx.textAlign = "right";
          ctx.fillText(String(lineNum), codeStartX + lineNumWidth - 12, y);
          ctx.textAlign = "start";
        }

        // Tokens
        const tokens = tokenizedLines[i];
        let x = codeStartX + lineNumWidth;
        for (const token of tokens) {
          const text = token.text.replace(/\t/g, " ".repeat(settings.tabSize));
          ctx.fillStyle = token.color;
          ctx.fillText(text, x, y);
          x += ctx.measureText(text).width;
        }
      });

      // Export
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "code-screenshot.png";
        a.click();
        URL.revokeObjectURL(url);
        setExporting(false);
      }, "image/png");
    } catch {
      setExporting(false);
    }
  }, [settings, lines, tokenizedLines, currentTheme, highlightedLineSet]);

  // --- Copy to clipboard ---
  const copyImage = useCallback(async () => {
    // Just copy the code text for now
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [code]);

  // --- Render ---

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
            <Code2 size={18} className="text-[var(--accent)]" />
            <h1 className="text-sm font-semibold">Code Screenshot</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyImage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy Code"}
          </button>
          <button
            onClick={exportPNG}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-60"
          >
            <Download size={14} />
            {exporting ? "Exporting..." : "Export PNG"}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Preview */}
        <div className="flex-[3] flex flex-col min-w-0">
          {/* Preview area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8" style={bgStyle}>
            <div
              ref={previewRef}
              className="relative"
              style={{ maxWidth: settings.maxWidth, width: "100%" }}
            >
              {/* Window container */}
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: currentTheme.bg,
                  boxShadow: "0 20px 68px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset",
                }}
              >
                {/* Window chrome */}
                {settings.showWindowChrome && settings.windowStyle !== "none" && (
                  <div
                    className="flex items-center h-10 px-4 select-none"
                    style={{ background: currentTheme.bg }}
                  >
                    {settings.windowStyle === "macos" && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
                        <div className="w-3 h-3 rounded-full" style={{ background: "#ffbd2e" }} />
                        <div className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
                      </div>
                    )}
                    {settings.windowTitle && (
                      <div
                        className="flex-1 text-center text-xs"
                        style={{ color: currentTheme.lineNumber }}
                      >
                        {settings.windowTitle}
                      </div>
                    )}
                    {settings.windowStyle === "windows" && (
                      <div className="ml-auto flex items-center gap-3">
                        <div className="w-3 h-[2px]" style={{ background: currentTheme.lineNumber }} />
                        <div
                          className="w-3 h-3 border"
                          style={{ borderColor: currentTheme.lineNumber }}
                        />
                        <svg width="12" height="12" viewBox="0 0 12 12">
                          <path
                            d="M1 1L11 11M11 1L1 11"
                            stroke={currentTheme.lineNumber}
                            strokeWidth="1.5"
                            fill="none"
                          />
                        </svg>
                      </div>
                    )}
                    {!settings.windowTitle && settings.windowStyle === "macos" && (
                      <div className="flex-1" />
                    )}
                  </div>
                )}

                {/* Code area */}
                <div
                  className="overflow-x-auto"
                  style={{
                    padding: "16px 20px",
                    fontFamily: settings.fontFamily,
                    fontSize: settings.fontSize,
                    lineHeight: settings.lineHeight,
                  }}
                >
                  {lines.map((rawLine, i) => {
                    const lineNum = i + 1;
                    const isHighlighted = highlightedLineSet.has(lineNum);
                    const tokens = tokenizedLines[i];

                    return (
                      <div
                        key={i}
                        className="flex"
                        style={{
                          background: isHighlighted
                            ? currentTheme.keyword + "18"
                            : "transparent",
                          minHeight: settings.fontSize * settings.lineHeight,
                        }}
                      >
                        {settings.showLineNumbers && (
                          <span
                            className="select-none text-right shrink-0 pr-4"
                            style={{
                              width: 48,
                              color: currentTheme.lineNumber,
                            }}
                          >
                            {lineNum}
                          </span>
                        )}
                        <span className="whitespace-pre" style={{ tabSize: settings.tabSize }}>
                          {tokens.map((token, j) => (
                            <span key={j} style={{ color: token.color }}>
                              {token.text}
                            </span>
                          ))}
                          {tokens.length === 0 && "\u200B"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Code input */}
          <div className="border-t border-[var(--border)] bg-[var(--surface)]">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here..."
              spellCheck={false}
              className="w-full h-32 p-4 text-sm font-mono resize-none bg-transparent outline-none"
              style={{
                fontFamily: settings.fontFamily,
                fontSize: 13,
                tabSize: settings.tabSize,
                lineHeight: 1.5,
              }}
            />
          </div>
        </div>

        {/* Right: Settings sidebar */}
        <div className="flex-[2] border-l border-[var(--border)] bg-[var(--background)] overflow-y-auto min-w-[280px] max-w-[440px]">
          {/* Theme */}
          <Section title="Theme" icon={<Palette size={14} />} defaultOpen>
            <div className="grid grid-cols-5 gap-2">
              {THEMES.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => update({ theme: theme.name })}
                  className="flex flex-col items-center gap-1 group"
                  title={theme.name}
                >
                  <div
                    className="w-full aspect-square rounded-lg border transition-all"
                    style={{
                      background: theme.bg,
                      borderColor:
                        settings.theme === theme.name
                          ? "var(--accent)"
                          : "var(--border)",
                      boxShadow:
                        settings.theme === theme.name
                          ? "0 0 0 2px var(--accent)"
                          : "none",
                    }}
                  >
                    <div className="p-1.5 flex flex-col gap-0.5">
                      <div
                        className="h-[3px] w-3/4 rounded-full"
                        style={{ background: theme.keyword }}
                      />
                      <div
                        className="h-[3px] w-1/2 rounded-full"
                        style={{ background: theme.string }}
                      />
                      <div
                        className="h-[3px] w-2/3 rounded-full"
                        style={{ background: theme.function }}
                      />
                    </div>
                  </div>
                  <span
                    className="text-[10px] truncate w-full text-center transition-colors"
                    style={{
                      color:
                        settings.theme === theme.name
                          ? "var(--foreground)"
                          : "var(--muted)",
                    }}
                  >
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* Language */}
          <Section title="Language" icon={<Code2 size={14} />} defaultOpen>
            <select
              value={settings.language}
              onChange={(e) => update({ language: e.target.value as Language })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] outline-none"
            >
              {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang]}
                </option>
              ))}
            </select>
          </Section>

          {/* Font */}
          <Section title="Font" icon={<Type size={14} />} defaultOpen>
            <div className="flex flex-col gap-3">
              <div>
                <Label>Font Family</Label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => update({ fontFamily: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] outline-none"
                >
                  {FONTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Font Size ({settings.fontSize}px)</Label>
                <input
                  type="range"
                  min={12}
                  max={24}
                  value={settings.fontSize}
                  onChange={(e) => update({ fontSize: Number(e.target.value) })}
                  className="w-full mt-1 accent-[var(--accent)]"
                />
              </div>
            </div>
          </Section>

          {/* Window */}
          <Section title="Window" icon={<Monitor size={14} />} defaultOpen>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Show Window Chrome</Label>
                <button
                  onClick={() => update({ showWindowChrome: !settings.showWindowChrome })}
                  className="relative w-9 h-5 rounded-full transition-colors"
                  style={{
                    background: settings.showWindowChrome
                      ? "var(--accent)"
                      : "var(--border)",
                  }}
                  role="switch"
                  aria-checked={settings.showWindowChrome}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{
                      transform: settings.showWindowChrome
                        ? "translateX(18px)"
                        : "translateX(2px)",
                    }}
                  />
                </button>
              </div>

              {settings.showWindowChrome && (
                <>
                  <div>
                    <Label>Window Title</Label>
                    <input
                      type="text"
                      value={settings.windowTitle}
                      onChange={(e) => update({ windowTitle: e.target.value })}
                      placeholder="untitled"
                      className="w-full mt-1 px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] outline-none"
                    />
                  </div>

                  <div>
                    <Label>Window Style</Label>
                    <div className="flex rounded-lg border border-[var(--border)] overflow-hidden mt-1">
                      {(["macos", "windows", "none"] as WindowStyle[]).map((style) => (
                        <button
                          key={style}
                          onClick={() => update({ windowStyle: style })}
                          className="flex-1 px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                          style={{
                            background:
                              settings.windowStyle === style
                                ? "var(--accent)"
                                : "var(--surface)",
                            color:
                              settings.windowStyle === style
                                ? "#fff"
                                : "var(--foreground)",
                          }}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* Background */}
          <Section title="Background" icon={<Palette size={14} />} defaultOpen>
            <div className="flex flex-col gap-3">
              <div>
                <Label>Type</Label>
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden mt-1">
                  {(["solid", "gradient", "transparent"] as BackgroundType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => update({ backgroundType: t })}
                      className="flex-1 px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                      style={{
                        background:
                          settings.backgroundType === t
                            ? "var(--accent)"
                            : "var(--surface)",
                        color:
                          settings.backgroundType === t
                            ? "#fff"
                            : "var(--foreground)",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {settings.backgroundType === "solid" && (
                <div>
                  <Label>Color</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={settings.bgSolid}
                      onChange={(e) => update({ bgSolid: e.target.value })}
                      className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer bg-transparent p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={settings.bgSolid}
                      onChange={(e) => update({ bgSolid: e.target.value })}
                      className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--border)] bg-[var(--surface)] outline-none"
                      maxLength={7}
                    />
                  </div>
                </div>
              )}

              {settings.backgroundType === "gradient" && (
                <>
                  <div>
                    <Label>Color 1</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={settings.bgGradient1}
                        onChange={(e) => update({ bgGradient1: e.target.value })}
                        className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer bg-transparent p-0 shrink-0"
                      />
                      <input
                        type="text"
                        value={settings.bgGradient1}
                        onChange={(e) => update({ bgGradient1: e.target.value })}
                        className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--border)] bg-[var(--surface)] outline-none"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Color 2</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={settings.bgGradient2}
                        onChange={(e) => update({ bgGradient2: e.target.value })}
                        className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer bg-transparent p-0 shrink-0"
                      />
                      <input
                        type="text"
                        value={settings.bgGradient2}
                        onChange={(e) => update({ bgGradient2: e.target.value })}
                        className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--border)] bg-[var(--surface)] outline-none"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Angle ({settings.bgGradientAngle}deg)</Label>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={settings.bgGradientAngle}
                      onChange={(e) =>
                        update({ bgGradientAngle: Number(e.target.value) })
                      }
                      className="w-full mt-1 accent-[var(--accent)]"
                    />
                  </div>
                </>
              )}

              <div>
                <Label>Padding ({settings.padding}px)</Label>
                <input
                  type="range"
                  min={16}
                  max={80}
                  value={settings.padding}
                  onChange={(e) => update({ padding: Number(e.target.value) })}
                  className="w-full mt-1 accent-[var(--accent)]"
                />
              </div>
            </div>
          </Section>

          {/* Display */}
          <Section title="Display" icon={<Eye size={14} />} defaultOpen>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Show Line Numbers</Label>
                <button
                  onClick={() => update({ showLineNumbers: !settings.showLineNumbers })}
                  className="relative w-9 h-5 rounded-full transition-colors"
                  style={{
                    background: settings.showLineNumbers
                      ? "var(--accent)"
                      : "var(--border)",
                  }}
                  role="switch"
                  aria-checked={settings.showLineNumbers}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{
                      transform: settings.showLineNumbers
                        ? "translateX(18px)"
                        : "translateX(2px)",
                    }}
                  />
                </button>
              </div>

              <div>
                <Label>Line Height ({settings.lineHeight.toFixed(1)})</Label>
                <input
                  type="range"
                  min={12}
                  max={20}
                  step={1}
                  value={settings.lineHeight * 10}
                  onChange={(e) =>
                    update({ lineHeight: Number(e.target.value) / 10 })
                  }
                  className="w-full mt-1 accent-[var(--accent)]"
                />
              </div>

              <div>
                <Label>Tab Size</Label>
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden mt-1">
                  {[2, 4].map((size) => (
                    <button
                      key={size}
                      onClick={() => update({ tabSize: size })}
                      className="flex-1 px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        background:
                          settings.tabSize === size
                            ? "var(--accent)"
                            : "var(--surface)",
                        color:
                          settings.tabSize === size
                            ? "#fff"
                            : "var(--foreground)",
                      }}
                    >
                      {size} spaces
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Highlight Lines</Label>
                <input
                  type="text"
                  value={settings.highlightedLines}
                  onChange={(e) => update({ highlightedLines: e.target.value })}
                  placeholder="e.g. 1, 3, 5"
                  className="w-full mt-1 px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] outline-none"
                />
              </div>

              <div>
                <Label>Max Width ({settings.maxWidth}px)</Label>
                <input
                  type="range"
                  min={400}
                  max={1200}
                  step={20}
                  value={settings.maxWidth}
                  onChange={(e) => update({ maxWidth: Number(e.target.value) })}
                  className="w-full mt-1 accent-[var(--accent)]"
                />
              </div>
            </div>
          </Section>

          {/* Settings info */}
          <Section title="Keyboard" icon={<Settings2 size={14} />} defaultOpen={false}>
            <div className="text-xs text-[var(--muted)] flex flex-col gap-1.5">
              <p>Paste code in the text area below the preview.</p>
              <p>Use Tab key for indentation (captured in textarea).</p>
              <p>Export renders at 2x resolution for crisp output.</p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
