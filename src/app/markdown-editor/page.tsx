"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bold,
  Check,
  Clipboard,
  Code,
  Copy,
  Download,
  Eye,
  FileText,
  Heading,
  Image,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Columns2,
  PenLine,
  Quote,
  Strikethrough,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ViewMode = "edit" | "preview" | "split";

/* ------------------------------------------------------------------ */
/*  Default sample markdown                                            */
/* ------------------------------------------------------------------ */

const SAMPLE_MARKDOWN = `# Welcome to Markdown Editor

A simple, fast Markdown editor with **live preview**.

## Features

- **Bold**, *italic*, and ~~strikethrough~~ text
- [Links](https://example.com) and ![images](https://via.placeholder.com/120x40)
- Headings from \`h1\` through \`h6\`
- Inline \`code\` and fenced code blocks

### Code Example

\`\`\`
function greet(name) {
  return "Hello, " + name + "!";
}
console.log(greet("World"));
\`\`\`

### Lists

Unordered:
- First item
- Second item
- Third item

Ordered:
1. Step one
2. Step two
3. Step three

> Blockquotes are great for highlighting important information
> and can span multiple lines.

---

That's it! Start editing to see the preview update in real time.
`;

/* ------------------------------------------------------------------ */
/*  Markdown-to-HTML converter                                         */
/* ------------------------------------------------------------------ */

function markdownToHtml(md: string): string {
  let html = "";
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // skip closing ```
      html += `<pre><code>${codeLines.join("\n")}</code></pre>\n`;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      html += "<hr />\n";
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html += `<h${level}>${inlineFormat(headingMatch[2])}</h${level}>\n`;
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ") || line === ">") {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      html += `<blockquote><p>${inlineFormat(quoteLines.join("\n"))}</p></blockquote>\n`;
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, ""));
        i++;
      }
      html += "<ul>\n" + items.map((t) => `<li>${inlineFormat(t)}</li>`).join("\n") + "\n</ul>\n";
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      html += "<ol>\n" + items.map((t) => `<li>${inlineFormat(t)}</li>`).join("\n") + "\n</ol>\n";
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: collect contiguous non-blank lines that aren't other block elements
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("# ") &&
      !lines[i].startsWith("## ") &&
      !lines[i].startsWith("### ") &&
      !lines[i].startsWith("#### ") &&
      !lines[i].startsWith("##### ") &&
      !lines[i].startsWith("###### ") &&
      !lines[i].startsWith("> ") &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      html += `<p>${inlineFormat(paraLines.join("\n"))}</p>\n`;
    }
  }

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(text: string): string {
  let result = escapeHtml(text);

  // Images (before links)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Italic
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Inline code
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Line breaks within paragraphs
  result = result.replace(/\n/g, "<br />");

  return result;
}

/* ------------------------------------------------------------------ */
/*  Preview styles (injected into the preview pane)                    */
/* ------------------------------------------------------------------ */

const PREVIEW_STYLES = `
  .md-preview { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.7; color: var(--foreground); }
  .md-preview h1 { font-size: 2em; font-weight: 700; margin: 0.8em 0 0.4em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border); }
  .md-preview h2 { font-size: 1.5em; font-weight: 600; margin: 0.8em 0 0.4em; padding-bottom: 0.25em; border-bottom: 1px solid var(--border); }
  .md-preview h3 { font-size: 1.25em; font-weight: 600; margin: 0.7em 0 0.3em; }
  .md-preview h4 { font-size: 1.1em; font-weight: 600; margin: 0.6em 0 0.3em; }
  .md-preview h5 { font-size: 1em; font-weight: 600; margin: 0.5em 0 0.2em; }
  .md-preview h6 { font-size: 0.9em; font-weight: 600; margin: 0.5em 0 0.2em; color: var(--muted); }
  .md-preview p { margin: 0.6em 0; }
  .md-preview a { color: var(--accent); text-decoration: underline; }
  .md-preview a:hover { color: var(--accent-hover); }
  .md-preview strong { font-weight: 700; }
  .md-preview em { font-style: italic; }
  .md-preview del { text-decoration: line-through; opacity: 0.7; }
  .md-preview code { font-family: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", Menlo, monospace; font-size: 0.875em; background: var(--surface-hover); padding: 0.15em 0.4em; border-radius: 4px; }
  .md-preview pre { background: var(--surface-hover); border: 1px solid var(--border); border-radius: 6px; padding: 1em; overflow-x: auto; margin: 0.8em 0; }
  .md-preview pre code { background: transparent; padding: 0; font-size: 0.85em; }
  .md-preview blockquote { border-left: 4px solid var(--accent); padding: 0.4em 1em; margin: 0.8em 0; color: var(--muted); background: var(--surface-hover); border-radius: 0 6px 6px 0; }
  .md-preview ul, .md-preview ol { padding-left: 1.8em; margin: 0.5em 0; }
  .md-preview li { margin: 0.25em 0; }
  .md-preview ul { list-style-type: disc; }
  .md-preview ol { list-style-type: decimal; }
  .md-preview hr { border: none; border-top: 2px solid var(--border); margin: 1.5em 0; }
  .md-preview img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.5em 0; }
`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MarkdownEditorPage() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ---------- derived values ---------- */

  const htmlOutput = useMemo(() => markdownToHtml(markdown), [markdown]);

  const stats = useMemo(() => {
    const text = markdown;
    const chars = text.length;
    const lines = text.split("\n").length;
    const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    return { chars, lines, words };
  }, [markdown]);

  /* ---------- toolbar helpers ---------- */

  const insertAtCursor = useCallback(
    (before: string, after: string = "", placeholder: string = "") => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = markdown.slice(start, end);
      const insert = selected || placeholder;
      const newText = markdown.slice(0, start) + before + insert + after + markdown.slice(end);
      setMarkdown(newText);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.focus();
        const cursorPos = start + before.length + insert.length;
        ta.setSelectionRange(
          start + before.length,
          cursorPos,
        );
      });
    },
    [markdown],
  );

  const toolbarActions = useMemo(
    () => [
      { icon: Bold, label: "Bold", action: () => insertAtCursor("**", "**", "bold text") },
      { icon: Italic, label: "Italic", action: () => insertAtCursor("*", "*", "italic text") },
      { icon: Strikethrough, label: "Strikethrough", action: () => insertAtCursor("~~", "~~", "text") },
      { icon: Heading, label: "Heading", action: () => insertAtCursor("## ", "", "Heading") },
      { icon: LinkIcon, label: "Link", action: () => insertAtCursor("[", "](url)", "link text") },
      { icon: Image, label: "Image", action: () => insertAtCursor("![", "](url)", "alt text") },
      { icon: List, label: "Bullet list", action: () => insertAtCursor("- ", "", "item") },
      { icon: ListOrdered, label: "Numbered list", action: () => insertAtCursor("1. ", "", "item") },
      { icon: Code, label: "Inline code", action: () => insertAtCursor("`", "`", "code") },
      { icon: Quote, label: "Blockquote", action: () => insertAtCursor("> ", "", "quote") },
      { icon: Minus, label: "Horizontal rule", action: () => insertAtCursor("\n---\n", "") },
    ],
    [insertAtCursor],
  );

  /* ---------- copy / download ---------- */

  const copyMarkdown = useCallback(async () => {
    await navigator.clipboard.writeText(markdown);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 1500);
  }, [markdown]);

  const copyHtml = useCallback(async () => {
    await navigator.clipboard.writeText(htmlOutput);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 1500);
  }, [htmlOutput]);

  const downloadFile = useCallback(
    (content: string, filename: string, mime: string) => {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [],
  );

  const downloadMd = useCallback(() => downloadFile(markdown, "document.md", "text/markdown"), [markdown, downloadFile]);

  const downloadHtml = useCallback(() => {
    const full = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>Document</title>\n<style>\nbody { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; max-width: 48rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.7; color: #1a1a1a; }\nh1, h2 { border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }\npre { background: #f5f5f5; padding: 1em; border-radius: 6px; overflow-x: auto; }\ncode { font-family: "SF Mono", Menlo, monospace; font-size: 0.875em; background: #f5f5f5; padding: 0.15em 0.4em; border-radius: 4px; }\npre code { background: transparent; padding: 0; }\nblockquote { border-left: 4px solid #3b82f6; padding: 0.4em 1em; margin: 0.8em 0; color: #555; background: #fafafa; border-radius: 0 6px 6px 0; }\nimg { max-width: 100%; height: auto; }\n</style>\n</head>\n<body>\n${htmlOutput}\n</body>\n</html>`;
    downloadFile(full, "document.html", "text/html");
  }, [htmlOutput, downloadFile]);

  /* ---------- view mode buttons ---------- */

  const viewModes: { mode: ViewMode; icon: typeof Eye; label: string }[] = [
    { mode: "edit", icon: PenLine, label: "Edit" },
    { mode: "split", icon: Columns2, label: "Split" },
    { mode: "preview", icon: Eye, label: "Preview" },
  ];

  /* ---------- render ---------- */

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* ---- header ---- */}
      <header
        className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Link
          href="/"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors shrink-0"
          style={{ color: "var(--muted)" }}
          aria-label="Back to tools"
        >
          <ArrowLeft size={18} />
        </Link>

        <div className="flex items-center gap-1 mr-1" style={{ color: "var(--foreground)" }}>
          <FileText size={18} />
          <span className="font-semibold text-sm hidden sm:inline">Markdown Editor</span>
        </div>

        {/* separator */}
        <div className="w-px h-5 shrink-0" style={{ background: "var(--border)" }} />

        {/* toolbar */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {toolbarActions.map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              title={btn.label}
              aria-label={btn.label}
              className="flex items-center justify-center w-7 h-7 rounded transition-colors shrink-0 cursor-pointer"
              style={{ color: "var(--muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-hover)";
                e.currentTarget.style.color = "var(--foreground)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--muted)";
              }}
            >
              <btn.icon size={15} />
            </button>
          ))}
        </div>

        {/* spacer */}
        <div className="flex-1" />

        {/* copy / download cluster */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={copyMarkdown}
            title="Copy Markdown"
            aria-label="Copy Markdown"
            className="flex items-center gap-1 px-2 h-7 rounded text-xs font-medium transition-colors cursor-pointer"
            style={{ color: "var(--muted)", background: "var(--surface-hover)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
          >
            {copiedMd ? <Check size={13} /> : <Copy size={13} />}
            <span className="hidden md:inline">MD</span>
          </button>

          <button
            onClick={copyHtml}
            title="Copy HTML"
            aria-label="Copy HTML"
            className="flex items-center gap-1 px-2 h-7 rounded text-xs font-medium transition-colors cursor-pointer"
            style={{ color: "var(--muted)", background: "var(--surface-hover)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
          >
            {copiedHtml ? <Check size={13} /> : <Clipboard size={13} />}
            <span className="hidden md:inline">HTML</span>
          </button>

          <button
            onClick={downloadMd}
            title="Download .md"
            aria-label="Download Markdown file"
            className="flex items-center gap-1 px-2 h-7 rounded text-xs font-medium transition-colors cursor-pointer"
            style={{ color: "var(--muted)", background: "var(--surface-hover)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
          >
            <Download size={13} />
            <span className="hidden md:inline">.md</span>
          </button>

          <button
            onClick={downloadHtml}
            title="Download .html"
            aria-label="Download HTML file"
            className="flex items-center gap-1 px-2 h-7 rounded text-xs font-medium transition-colors cursor-pointer"
            style={{ color: "var(--muted)", background: "var(--surface-hover)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
          >
            <Download size={13} />
            <span className="hidden md:inline">.html</span>
          </button>
        </div>

        {/* separator */}
        <div className="w-px h-5 shrink-0" style={{ background: "var(--border)" }} />

        {/* view mode toggle */}
        <div
          className="flex items-center rounded-lg p-0.5 shrink-0"
          style={{ background: "var(--surface-hover)" }}
        >
          {viewModes.map((vm) => (
            <button
              key={vm.mode}
              onClick={() => setViewMode(vm.mode)}
              aria-label={`${vm.label} mode`}
              aria-pressed={viewMode === vm.mode}
              className="flex items-center gap-1 px-2 h-6 rounded text-xs font-medium transition-colors cursor-pointer"
              style={{
                background: viewMode === vm.mode ? "var(--surface)" : "transparent",
                color: viewMode === vm.mode ? "var(--foreground)" : "var(--muted)",
                boxShadow: viewMode === vm.mode ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <vm.icon size={13} />
              <span className="hidden sm:inline">{vm.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ---- content ---- */}
      <div className="flex flex-1 min-h-0">
        {/* editor pane */}
        {(viewMode === "edit" || viewMode === "split") && (
          <div
            className="flex flex-col min-h-0"
            style={{
              width: viewMode === "split" ? "50%" : "100%",
              borderRight: viewMode === "split" ? "1px solid var(--border)" : "none",
            }}
          >
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              spellCheck={false}
              aria-label="Markdown source editor"
              className="flex-1 w-full resize-none p-4 outline-none text-sm leading-relaxed"
              style={{
                background: "var(--background)",
                color: "var(--foreground)",
                fontFamily: '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", Menlo, Consolas, monospace',
                caretColor: "var(--accent)",
              }}
            />
          </div>
        )}

        {/* preview pane */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div
            className="flex-1 overflow-auto p-6 min-h-0"
            style={{ background: "var(--background)" }}
          >
            <style>{PREVIEW_STYLES}</style>
            <div
              className="md-preview max-w-3xl mx-auto"
              dangerouslySetInnerHTML={{ __html: htmlOutput }}
            />
          </div>
        )}
      </div>

      {/* ---- status bar ---- */}
      <footer
        className="flex items-center justify-between px-4 py-1.5 border-t text-xs shrink-0"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          color: "var(--muted)",
        }}
      >
        <div className="flex items-center gap-4">
          <span>{stats.words} word{stats.words !== 1 ? "s" : ""}</span>
          <span>{stats.chars} character{stats.chars !== 1 ? "s" : ""}</span>
          <span>{stats.lines} line{stats.lines !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="capitalize">{viewMode} mode</span>
          <span>Markdown</span>
        </div>
      </footer>
    </div>
  );
}
