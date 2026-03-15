"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileText,
  RefreshCw,
  Type,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Style sentence banks                                               */
/* ------------------------------------------------------------------ */

const CLASSIC_SENTENCES = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit.",
  "Nulla facilisi morbi tempus iaculis urna id volutpat lacus.",
  "Viverra accumsan in nisl nisi scelerisque eu ultrices vitae auctor.",
  "Pellentesque habitant morbi tristique senectus et netus et malesuada fames.",
  "Aenean vel elit scelerisque mauris pellentesque pulvinar pellentesque habitant.",
  "Egestas sed tempus urna et pharetra pharetra massa massa ultricies.",
  "Faucibus ornare suspendisse sed nisi lacus sed viverra tellus in.",
  "Amet consectetur adipiscing elit duis tristique sollicitudin nibh sit amet.",
  "Vitae tortor condimentum lacinia quis vel eros donec ac odio.",
  "Turpis egestas integer eget aliquet nibh praesent tristique magna sit.",
  "Blandit cursus risus at ultrices mi tempus imperdiet nulla malesuada.",
] as const;

const HIPSTER_SENTENCES = [
  "Artisan kombucha raw denim, farm-to-table aesthetic letterpress cred chambray.",
  "Vinyl record cold-brew meditation is basically a lifestyle at this point.",
  "I only use typewriters ironically, but my novel is very real and very unfinished.",
  "This avocado toast has more personality than most people I know.",
  "Fixie bicycle synth paleo, you probably haven't heard of my favorite band.",
  "Sustainable slow-fashion thrift haul activated my third eye and my credit card.",
  "Small-batch pickled everything is a valid food group in Brooklyn.",
  "The barista judged my oat milk order and honestly I respect that energy.",
  "Polaroid photos of my brunch are the only art that matters.",
  "Craft beer gastropub vibes with a side of existential sourdough crisis.",
  "My mustache wax costs more than my rent and I regret nothing.",
  "Enamel pins on a tote bag are the new fine art collection.",
  "I forage for mushrooms in the park but I'm too scared to eat them.",
  "Microdosing productivity content while binge-watching a VHS collection.",
] as const;

const CORPORATE_SENTENCES = [
  "Let's circle back and leverage our synergies to move the needle on this.",
  "We need to align on the deliverables before we can greenlight the initiative.",
  "Going forward, let's take this offline and ideate on a blue-sky strategy.",
  "Our core competency is disrupting paradigms through holistic stakeholder engagement.",
  "The bandwidth on this vertical is limited so let's prioritize low-hanging fruit.",
  "Per my last email, please see the attached deck for Q3 action items.",
  "We're building the plane while flying it, but the runway looks synergistic.",
  "This pivot will unlock value and create a win-win for all stakeholders.",
  "Let's boil the ocean on this one and then drill down into the ROI.",
  "I don't have the cycles for this but I'll loop in someone who does.",
  "The optics on this are suboptimal so let's reframe the narrative.",
  "We need to right-size our expectations and future-proof the roadmap.",
  "Cross-functional alignment is mission-critical for our go-to-market strategy.",
  "Let's put a pin in that and revisit after we've socialized the proposal.",
] as const;

const PIRATE_SENTENCES = [
  "Arrr, the seas be rough but me enthusiasm for plunder be rougher!",
  "Shiver me timbers, the treasure map was upside down this whole time.",
  "Ye can't spell 'pirate' without 'irate' and I be very irate indeed.",
  "The parrot on me shoulder gives better career advice than me first mate.",
  "Walk the plank? In this economy? I'll just swim to the competition.",
  "Me ship has a leak and me crew has a mutiny problem, typical Monday.",
  "I traded me compass for a sandwich and honestly it was worth it.",
  "The kraken owes me money and I intend to collect, with interest.",
  "Davy Jones called, he wants his locker back, and also his WiFi password.",
  "Rum is just pirate coffee and I refuse to debate this further.",
  "The treasure was the friends we marooned along the way.",
  "Me wooden leg has better WiFi than the crow's nest hotspot.",
  "Blimey, navigating by the stars is harder than the brochure suggested.",
  "The Jolly Roger needs ironing but the ship doesn't have an outlet.",
] as const;

const SPACE_SENTENCES = [
  "Houston, we have a problem: the coffee machine on the space station is broken.",
  "The astronaut's favorite meal is launch, obviously.",
  "Floating in zero gravity is fun until you lose your sandwich forever.",
  "Mars called, they don't want our rover doing donuts on their lawn.",
  "The speed of light is great but my internet is still faster sometimes.",
  "One small step for man, one giant leap over the cable management in the ISS.",
  "The universe is expanding and so is my collection of space puns.",
  "Aliens probably exist but they took one look at Earth and kept driving.",
  "Jupiter's Great Red Spot is basically the universe's oldest storm complaint.",
  "Black holes are nature's way of saying 'this meeting could have been an email.'",
  "The Milky Way is a spiral galaxy and also an adequate candy bar.",
  "Pluto got demoted but it's still a planet in our hearts and PowerPoint slides.",
  "Orbiting Earth sixteen times a day really puts your commute in perspective.",
  "Nebulae are the universe's lava lamps and I will not be taking questions.",
] as const;

const CAT_SENTENCES = [
  "Knocked the glass off the table to assert dominance over gravity itself.",
  "Stared at the wall for forty minutes, it was a productive afternoon.",
  "The red dot remains uncaught, but my determination is unwavering.",
  "Sat on the laptop keyboard and accidentally deployed to production.",
  "The cardboard box is superior to every bed ever purchased for me.",
  "Meowed at 3 AM because the void needed to know I exist.",
  "Brought a dead mouse as a gift, the humans seemed ungrateful as usual.",
  "Pushed everything off the shelf in a feat of gravitational research.",
  "Refused to eat the expensive food, demanded the cheap stuff, it's called taste.",
  "The belly is a trap and you fell for it again, foolish human.",
  "Ran through the house at 4 AM because the zoomies wait for no one.",
  "Claimed the warm laundry pile as sovereign territory, effective immediately.",
  "Made biscuits on the human's stomach at maximum claw intensity.",
  "Fit inside a container that is clearly too small, physics is optional for cats.",
] as const;

type StyleId = "classic" | "hipster" | "corporate" | "pirate" | "space" | "cat";
type UnitType = "paragraphs" | "sentences" | "words";

interface StyleConfig {
  id: StyleId;
  label: string;
  emoji: string;
  sentences: readonly string[];
}

const STYLES: StyleConfig[] = [
  { id: "classic", label: "Classic Lorem", emoji: "\uD83C\uDFDB\uFE0F", sentences: CLASSIC_SENTENCES },
  { id: "hipster", label: "Hipster Ipsum", emoji: "\u2615", sentences: HIPSTER_SENTENCES },
  { id: "corporate", label: "Corporate Ipsum", emoji: "\uD83D\uDCBC", sentences: CORPORATE_SENTENCES },
  { id: "pirate", label: "Pirate Ipsum", emoji: "\uD83C\uDFF4\u200D\u2620\uFE0F", sentences: PIRATE_SENTENCES },
  { id: "space", label: "Space Ipsum", emoji: "\uD83D\uDE80", sentences: SPACE_SENTENCES },
  { id: "cat", label: "Cat Ipsum", emoji: "\uD83D\uDC31", sentences: CAT_SENTENCES },
];

const UNIT_LIMITS: Record<UnitType, { min: number; max: number }> = {
  paragraphs: { min: 1, max: 50 },
  sentences: { min: 1, max: 100 },
  words: { min: 1, max: 500 },
};

const CLASSIC_OPENER = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";

/* ------------------------------------------------------------------ */
/*  Random helpers                                                     */
/* ------------------------------------------------------------------ */

function pickRandom<T>(arr: readonly T[], count: number, rng: () => number): T[] {
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    result.push(arr[Math.floor(rng() * arr.length)]);
  }
  return result;
}

function toSentenceCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ */
/*  Generator                                                          */
/* ------------------------------------------------------------------ */

function generate(
  style: StyleConfig,
  unit: UnitType,
  count: number,
  startWithLorem: boolean,
  htmlTags: boolean,
  sentenceCase: boolean,
  seed: number,
): string {
  // Simple seeded RNG
  let s = seed;
  const rng = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const bank = style.sentences;

  if (unit === "words") {
    const pool = pickRandom(bank, Math.ceil(count / 4) + 5, rng).join(" ");
    const allWords = pool.replace(/[.,!?;:]/g, "").split(/\s+/);
    let words = allWords.slice(0, count);

    if (startWithLorem && style.id === "classic") {
      const loremWords = CLASSIC_OPENER.replace(/[.,]/g, "").split(/\s+/);
      const remaining = count - loremWords.length;
      words = remaining > 0 ? [...loremWords, ...allWords.slice(0, remaining)] : loremWords.slice(0, count);
    }

    let text = words.join(" ");
    if (sentenceCase) text = toSentenceCase(text);
    if (!text.endsWith(".")) text += ".";
    return text;
  }

  if (unit === "sentences") {
    let sentences = pickRandom(bank, count, rng);

    if (startWithLorem && style.id === "classic") {
      sentences = [CLASSIC_OPENER, ...pickRandom(bank, count - 1, rng)];
    }

    let lines = sentences.map((s) => (sentenceCase ? toSentenceCase(s) : s));
    const text = lines.join(" ");
    return htmlTags ? `<p>${text}</p>` : text;
  }

  // paragraphs
  const paragraphs: string[] = [];
  const sentencesPerPara = 5;

  for (let p = 0; p < count; p++) {
    let paraSentences = pickRandom(bank, sentencesPerPara, rng);

    if (p === 0 && startWithLorem && style.id === "classic") {
      paraSentences = [CLASSIC_OPENER, ...pickRandom(bank, sentencesPerPara - 1, rng)];
    }

    const lines = paraSentences.map((s) => (sentenceCase ? toSentenceCase(s) : s));
    const paraText = lines.join(" ");
    paragraphs.push(htmlTags ? `<p>${paraText}</p>` : paraText);
  }

  return paragraphs.join(htmlTags ? "\n\n" : "\n\n");
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LoremGeneratorPage() {
  const [style, setStyle] = useState<StyleId>("classic");
  const [unit, setUnit] = useState<UnitType>("paragraphs");
  const [count, setCount] = useState(3);
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [htmlTags, setHtmlTags] = useState(false);
  const [sentenceCase, setSentenceCase] = useState(true);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2147483646) + 1);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const styleConfig = useMemo(() => STYLES.find((s) => s.id === style)!, [style]);
  const limits = UNIT_LIMITS[unit];

  // Clamp count when unit changes
  useEffect(() => {
    setCount((prev) => Math.max(limits.min, Math.min(prev, limits.max)));
  }, [unit, limits]);

  const output = useMemo(
    () => generate(styleConfig, unit, count, startWithLorem, htmlTags, sentenceCase, seed),
    [styleConfig, unit, count, startWithLorem, htmlTags, sentenceCase, seed],
  );

  const stats = useMemo(() => {
    const words = output.split(/\s+/).filter(Boolean).length;
    const chars = output.length;
    const paragraphs = output.split(/\n\n+/).filter(Boolean).length;
    return { words, chars, paragraphs };
  }, [output]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${style}-ipsum.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, style]);

  const handleRegenerate = useCallback(() => {
    setSeed(Math.floor(Math.random() * 2147483646) + 1);
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
          <Type size={14} />
          <span className="text-sm font-semibold">Lorem Ipsum Generator</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRegenerate}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
          >
            <RefreshCw size={12} />
            Regenerate
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] text-xs px-2.5 py-1"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
          >
            <Download size={12} />
            Download
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5">
          {/* Style selector — 2x3 grid */}
          <section>
            <label className="text-xs font-medium text-[var(--muted)] mb-2 block">Style</label>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors ${
                    style === s.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <span className="text-base leading-none">{s.emoji}</span>
                  <span className="font-medium text-xs">{s.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Unit + Count controls */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {/* Unit selector */}
              <div className="flex-shrink-0">
                <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Unit</label>
                <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden">
                  {(["paragraphs", "sentences", "words"] as UnitType[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        unit === u
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Count slider */}
              <div className="flex-1 min-w-0">
                <label className="text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center justify-between">
                  <span>Count</span>
                  <span className="tabular-nums text-[var(--foreground)]">{count}</span>
                </label>
                <input
                  type="range"
                  min={limits.min}
                  max={limits.max}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--accent)] bg-[var(--border)]"
                />
                <div className="flex justify-between text-[10px] text-[var(--muted)] mt-0.5">
                  <span>{limits.min}</span>
                  <span>{limits.max}</span>
                </div>
              </div>
            </div>

            {/* Option toggles */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {style === "classic" && (
                <Toggle
                  label='Start with "Lorem ipsum..."'
                  checked={startWithLorem}
                  onChange={setStartWithLorem}
                />
              )}
              <Toggle
                label="HTML <p> tags"
                checked={htmlTags}
                onChange={setHtmlTags}
              />
              <Toggle
                label="Sentence case"
                checked={sentenceCase}
                onChange={setSentenceCase}
              />
            </div>
          </section>

          {/* Output textarea */}
          <section className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[var(--muted)]">Output</label>
            <textarea
              ref={textareaRef}
              readOnly
              value={output}
              className="w-full min-h-[320px] resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-sm leading-relaxed p-3 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </section>

          {/* Stats bar */}
          <section className="flex items-center gap-4 text-xs text-[var(--muted)] pb-4">
            <span>
              <span className="font-medium text-[var(--foreground)] tabular-nums">{stats.words.toLocaleString()}</span>{" "}
              words
            </span>
            <span>
              <span className="font-medium text-[var(--foreground)] tabular-nums">{stats.chars.toLocaleString()}</span>{" "}
              characters
            </span>
            <span>
              <span className="font-medium text-[var(--foreground)] tabular-nums">{stats.paragraphs.toLocaleString()}</span>{" "}
              {stats.paragraphs === 1 ? "paragraph" : "paragraphs"}
            </span>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle component                                                   */
/* ------------------------------------------------------------------ */

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0 ${
          checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-xs text-[var(--foreground)]">{label}</span>
    </label>
  );
}
