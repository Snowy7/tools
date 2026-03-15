"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clipboard,
  ClipboardPaste,
  Code,
  FileText,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Template = "minimal" | "modern" | "classic";

interface ResumeSection {
  label: string;
  content: string[];
}

/* ------------------------------------------------------------------ */
/*  Section Detection & Cleaning                                       */
/* ------------------------------------------------------------------ */

const SECTION_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "Name", pattern: /^(name|full\s*name)\s*[:.]?\s*/i },
  { label: "Contact", pattern: /^(contact|email|phone|address|location|linkedin|github|website|portfolio)\s*[:.]?\s*/i },
  { label: "Summary", pattern: /^(summary|objective|profile|about\s*me|professional\s*summary)\s*[:.]?\s*/i },
  { label: "Experience", pattern: /^(experience|work\s*experience|employment|work\s*history|professional\s*experience)\s*[:.]?\s*/i },
  { label: "Education", pattern: /^(education|academic|qualifications|degrees?)\s*[:.]?\s*/i },
  { label: "Skills", pattern: /^(skills|technical\s*skills|core\s*competencies|technologies|tools)\s*[:.]?\s*/i },
  { label: "Projects", pattern: /^(projects|personal\s*projects|key\s*projects)\s*[:.]?\s*/i },
  { label: "Certifications", pattern: /^(certifications?|certificates?|licenses?)\s*[:.]?\s*/i },
  { label: "Languages", pattern: /^(languages?|spoken\s*languages?)\s*[:.]?\s*/i },
  { label: "References", pattern: /^(references?|referees?)\s*[:.]?\s*/i },
  { label: "Awards", pattern: /^(awards?|honors?|achievements?)\s*[:.]?\s*/i },
  { label: "Interests", pattern: /^(interests?|hobbies|activities)\s*[:.]?\s*/i },
];

function detectSectionLabel(line: string): string | null {
  const trimmed = line.trim();
  for (const { label, pattern } of SECTION_PATTERNS) {
    if (pattern.test(trimmed)) return label;
  }
  return null;
}

function fixCapitalization(text: string): string {
  return text.replace(/(^|\.\s+)([a-z])/g, (_m, prefix, char) => prefix + char.toUpperCase());
}

function cleanResume(raw: string): ResumeSection[] {
  const lines = raw.split("\n");
  const sections: ResumeSection[] = [];
  let currentSection: ResumeSection | null = null;
  let nameGuess = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\t/g, "  ").replace(/\s+$/, "");
    if (line.trim() === "") continue;

    const sectionLabel = detectSectionLabel(line);

    if (sectionLabel) {
      if (currentSection && currentSection.content.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { label: sectionLabel, content: [] };

      // If the section heading has content after the label, include it
      const cleaned = line.replace(SECTION_PATTERNS.find((p) => p.label === sectionLabel)!.pattern, "").trim();
      if (cleaned) {
        currentSection.content.push(fixCapitalization(cleaned));
      }
    } else if (currentSection) {
      currentSection.content.push(fixCapitalization(line.trim()));
    } else {
      // Lines before any section detected — treat first non-empty as name
      if (!nameGuess && line.trim().length > 0 && line.trim().length < 60) {
        nameGuess = line.trim();
      } else {
        // Might be contact info at the top
        if (!sections.find((s) => s.label === "Contact")) {
          if (!currentSection) {
            currentSection = { label: "Contact", content: [] };
          }
        }
        if (currentSection) {
          currentSection.content.push(line.trim());
        }
      }
    }
  }

  if (currentSection && currentSection.content.length > 0) {
    sections.push(currentSection);
  }

  // Prepend name if detected
  if (nameGuess) {
    sections.unshift({ label: "Name", content: [nameGuess] });
  }

  return sections;
}

/* ------------------------------------------------------------------ */
/*  Render Templates                                                   */
/* ------------------------------------------------------------------ */

function renderText(sections: ResumeSection[], template: Template): string {
  if (sections.length === 0) return "";

  const divider = template === "classic" ? "=".repeat(50) : template === "modern" ? "-".repeat(40) : "";

  return sections
    .map((section) => {
      const heading =
        template === "classic"
          ? `${section.label.toUpperCase()}\n${divider}`
          : template === "modern"
            ? `## ${section.label}\n${divider}`
            : `${section.label.toUpperCase()}`;

      const body = section.content.join("\n");
      return `${heading}\n${body}`;
    })
    .join("\n\n");
}

function renderHTML(sections: ResumeSection[], template: Template): string {
  const fontFamily =
    template === "classic"
      ? "Georgia, 'Times New Roman', serif"
      : template === "modern"
        ? "'Segoe UI', system-ui, sans-serif"
        : "Arial, Helvetica, sans-serif";

  const accentColor = template === "modern" ? "#2563eb" : template === "classic" ? "#1a1a1a" : "#333";

  const headingStyle =
    template === "classic"
      ? `font-size:14px;text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid ${accentColor};padding-bottom:4px;margin-top:20px;`
      : template === "modern"
        ? `font-size:15px;color:${accentColor};border-left:3px solid ${accentColor};padding-left:8px;margin-top:20px;`
        : `font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-top:18px;`;

  const sectionsHTML = sections
    .map((section) => {
      if (section.label === "Name") {
        const nameStyle =
          template === "classic"
            ? "font-size:28px;text-align:center;font-weight:bold;margin-bottom:4px;"
            : template === "modern"
              ? `font-size:26px;font-weight:700;color:${accentColor};`
              : "font-size:24px;font-weight:600;";
        return `<h1 style="${nameStyle}">${escapeHTML(section.content.join(" "))}</h1>`;
      }
      const items = section.content.map((line) => `<p style="margin:2px 0;line-height:1.6;">${escapeHTML(line)}</p>`).join("\n");
      return `<h2 style="${headingStyle}">${escapeHTML(section.label)}</h2>\n${items}`;
    })
    .join("\n\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Resume</title>
</head>
<body style="max-width:700px;margin:40px auto;padding:20px;font-family:${fontFamily};color:#1a1a1a;line-height:1.5;">
${sectionsHTML}
</body>
</html>`;
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ResumeCleanerPage() {
  const [rawInput, setRawInput] = useState("");
  const [template, setTemplate] = useState<Template>("modern");
  const [copied, setCopied] = useState<string | null>(null);

  const sections = useMemo(() => cleanResume(rawInput), [rawInput]);
  const textOutput = useMemo(() => renderText(sections, template), [sections, template]);
  const htmlOutput = useMemo(() => renderHTML(sections, template), [sections, template]);

  const wordCount = useMemo(() => {
    const words = rawInput.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [rawInput]);

  const readingTime = useMemo(() => {
    const minutes = Math.ceil(wordCount / 200);
    return minutes < 1 ? "< 1 min" : `${minutes} min`;
  }, [wordCount]);

  const copyText = useCallback(
    async (text: string, label: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    },
    [],
  );

  const loadSample = useCallback(() => {
    setRawInput(`john doe
john.doe@email.com | (555) 123-4567 | linkedin.com/in/johndoe | San Francisco, CA

summary
Experienced software engineer with 5+ years building scalable web applications. passionate about clean code and user experience.

experience
Senior Software Engineer - TechCorp Inc
jan 2021 - present
- led development of microservices architecture serving 1M+ users
- mentored team of 4 junior developers
- reduced API response time by 40% through caching optimization

Software Engineer - StartupXYZ
jun 2018 - dec 2020
- built real-time collaboration features using websockets
- implemented CI/CD pipeline reducing deployment time by 60%

education
bachelor of science in computer science
Stanford University - 2018

skills
JavaScript, TypeScript, React, Node.js, Python, PostgreSQL, AWS, Docker, Kubernetes, GraphQL`);
  }, []);

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
          <FileText size={14} />
          <span className="text-sm font-semibold">Resume Cleaner</span>
        </div>

        {/* Template selector */}
        <div className="flex items-center gap-0.5 ml-4 bg-[var(--background)] rounded-lg p-0.5 border border-[var(--border)]">
          {(["minimal", "modern", "classic"] as Template[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTemplate(t)}
              className={`text-xs px-2.5 py-1 rounded-md capitalize transition-colors ${
                template === t
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {rawInput && (
            <div className="flex items-center gap-3 mr-3 text-xs text-[var(--muted)]">
              <span>{wordCount} words</span>
              <span>{readingTime} read</span>
              <span>{sections.length} sections</span>
            </div>
          )}

          <button
            type="button"
            onClick={loadSample}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <ClipboardPaste size={12} />
            Sample
          </button>

          {textOutput && (
            <>
              <button
                type="button"
                onClick={() => copyText(textOutput, "text")}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                {copied === "text" ? <Check size={12} /> : <Clipboard size={12} />}
                {copied === "text" ? "Copied" : "Copy Text"}
              </button>

              <button
                type="button"
                onClick={() => copyText(htmlOutput, "html")}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                {copied === "html" ? <Check size={12} /> : <Code size={12} />}
                {copied === "html" ? "Copied" : "Copy HTML"}
              </button>

              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([htmlOutput], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "resume.html";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
              >
                <Sparkles size={12} />
                Export HTML
              </button>
            </>
          )}

          {rawInput && (
            <button
              type="button"
              onClick={() => setRawInput("")}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Input */}
        <div className="w-1/2 flex flex-col border-r border-[var(--border)]">
          <div className="flex items-center px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
              Raw Resume
            </span>
          </div>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Paste your messy resume text here..."
            spellCheck={false}
            className="flex-1 w-full resize-none bg-transparent font-mono text-sm text-[var(--foreground)] p-4 outline-none placeholder:text-[var(--muted)]/40"
          />
        </div>

        {/* Output */}
        <div className="w-1/2 flex flex-col">
          <div className="flex items-center px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
              Cleaned Output
            </span>
            <div className="flex items-center gap-0.5 ml-auto bg-[var(--background)] rounded-lg p-0.5 border border-[var(--border)]">
              <PreviewToggle />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {!rawInput ? (
              <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
                Paste resume text to see cleaned output
              </div>
            ) : sections.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
                No sections detected
              </div>
            ) : (
              <ResumePreview sections={sections} template={template} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Preview Toggle (placeholder — uses formatted text view)            */
/* ------------------------------------------------------------------ */

function PreviewToggle() {
  return (
    <span className="text-xs px-2.5 py-1 rounded-md text-[var(--muted)]">
      <Type size={12} className="inline mr-1" />
      Preview
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Resume Preview                                                     */
/* ------------------------------------------------------------------ */

function ResumePreview({ sections, template }: { sections: ResumeSection[]; template: Template }) {
  const fontClass =
    template === "classic" ? "font-serif" : template === "modern" ? "font-sans" : "font-sans";

  return (
    <div className={`p-6 ${fontClass}`}>
      {sections.map((section, idx) => (
        <div key={idx} className={idx > 0 ? "mt-5" : ""}>
          {section.label === "Name" ? (
            <h1
              className={`font-bold mb-1 ${
                template === "classic"
                  ? "text-2xl text-center"
                  : template === "modern"
                    ? "text-2xl text-[var(--accent)]"
                    : "text-xl"
              }`}
            >
              {section.content.join(" ")}
            </h1>
          ) : (
            <>
              <h2
                className={`text-xs font-semibold uppercase tracking-wider mb-2 pb-1 ${
                  template === "classic"
                    ? "border-b-2 border-[var(--foreground)] tracking-[2px]"
                    : template === "modern"
                      ? "text-[var(--accent)] border-l-3 border-[var(--accent)] pl-2"
                      : "text-[var(--muted)]"
                }`}
              >
                {section.label}
              </h2>
              {section.content.map((line, li) => (
                <p key={li} className="text-sm leading-relaxed text-[var(--foreground)]">
                  {line}
                </p>
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
