export interface GlyphSet {
  label: string;
  chars: string[];
}

export const GLYPH_SETS: GlyphSet[] = [
  { label: "Uppercase", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") },
  { label: "Lowercase", chars: "abcdefghijklmnopqrstuvwxyz".split("") },
  { label: "Numbers", chars: "0123456789".split("") },
  { label: "Punctuation", chars: ".,;:!?'-\"()@#$%&*+=/\\[]{}|<>~`^_".split("") },
];

export const EXTRA_GLYPH_SETS: GlyphSet[] = [
  {
    label: "Arabic",
    chars: "ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي ة ى ء أ إ آ ؤ ئ".split(" "),
  },
  {
    label: "Chinese (Common)",
    chars: "你 好 我 是 的 了 不 在 有 人 这 中 大 为 上 个 国 和 年 来 到 时 地 生 就 出 会 可 也 学 子 以 要 他 工 对 说 自 之 家 发 同 用 但 从 行 所 然 起 作 能 于 与 得 正 新".split(" "),
  },
  {
    label: "Japanese Hiragana",
    chars: "あ い う え お か き く け こ さ し す せ そ た ち つ て と な に ぬ ね の は ひ ふ へ ほ ま み む め も や ゆ よ ら り る れ ろ わ を ん".split(" "),
  },
  {
    label: "Japanese Katakana",
    chars: "ア イ ウ エ オ カ キ ク ケ コ サ シ ス セ ソ タ チ ツ テ ト ナ ニ ヌ ネ ノ ハ ヒ フ ヘ ホ マ ミ ム メ モ ヤ ユ ヨ ラ リ ル レ ロ ワ ヲ ン".split(" "),
  },
  {
    label: "Korean (Common Syllables)",
    chars: "가 나 다 라 마 바 사 아 자 차 카 타 파 하 갈 날 달 랄 말 발 살 알 잘 찰 칼 탈 팔 할".split(" "),
  },
];

export interface BrushConfig {
  name: string;
  id: string;
  minWidth: number;
  maxWidth: number;
  opacity: number;
  smoothing: number;
  pressureSensitive: boolean;
  texture: "solid" | "rough" | "spray" | "calligraphy" | "marker" | "pencil" | "ink";
}

export const BRUSHES: BrushConfig[] = [
  {
    name: "Pen",
    id: "pen",
    minWidth: 3,
    maxWidth: 6,
    opacity: 1,
    smoothing: 0.5,
    pressureSensitive: true,
    texture: "solid",
  },
  {
    name: "Pencil",
    id: "pencil",
    minWidth: 1,
    maxWidth: 3,
    opacity: 0.7,
    smoothing: 0.2,
    pressureSensitive: true,
    texture: "pencil",
  },
  {
    name: "Ink Brush",
    id: "ink",
    minWidth: 2,
    maxWidth: 12,
    opacity: 1,
    smoothing: 0.6,
    pressureSensitive: true,
    texture: "ink",
  },
  {
    name: "Calligraphy",
    id: "calligraphy",
    minWidth: 1,
    maxWidth: 14,
    opacity: 1,
    smoothing: 0.4,
    pressureSensitive: true,
    texture: "calligraphy",
  },
  {
    name: "Marker",
    id: "marker",
    minWidth: 8,
    maxWidth: 14,
    opacity: 0.8,
    smoothing: 0.3,
    pressureSensitive: false,
    texture: "marker",
  },
  {
    name: "Fine Tip",
    id: "finetip",
    minWidth: 1,
    maxWidth: 2,
    opacity: 1,
    smoothing: 0.8,
    pressureSensitive: false,
    texture: "solid",
  },
  {
    name: "Spray",
    id: "spray",
    minWidth: 20,
    maxWidth: 40,
    opacity: 0.3,
    smoothing: 0,
    pressureSensitive: false,
    texture: "spray",
  },
  {
    name: "Rough",
    id: "rough",
    minWidth: 3,
    maxWidth: 8,
    opacity: 0.9,
    smoothing: 0.3,
    pressureSensitive: true,
    texture: "rough",
  },
];

export type ExportFormat = "otf" | "ttf" | "woff" | "woff2" | "svg";

export interface GlyphEntry {
  strokes: StrokeData[];
  preview: string;
  imageData?: string;
}

export interface StrokeData {
  points: { x: number; y: number; pressure?: number }[];
  width: number;
  brushId: string;
}
