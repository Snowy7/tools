import {
  Binary, Eraser, Gamepad2, Palette, QrCode, Type, Wand2,
  ImageDown, Monitor, KeyRound, Paintbrush, Eye, Terminal,
  GitCompare, Grid3x3, Smile, Code, Film, Smartphone,
  Layers, Box, FileCode, Hash, Image as ImageIcon, Pipette,
  Table, Square, Clock, Timer, FileText, TextCursorInput,
} from "lucide-react";
import type { ReactNode } from "react";

export interface ToolDefinition {
  name: string;
  description: string;
  href: string;
  audience: string;
  icon: ReactNode;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ── Image / Media ──
  {
    name: "Image Studio",
    description: "Edit photos with filters, color grading, crop, sharpen, and export controls",
    href: "/image-studio",
    audience: "content",
    icon: <Wand2 size={28} strokeWidth={1.5} />,
  },
  {
    name: "Image Compressor",
    description: "Compress and convert images between PNG, JPEG, WebP, AVIF with batch support",
    href: "/image-compressor",
    audience: "content",
    icon: <ImageDown size={28} strokeWidth={1.5} />,
  },
  {
    name: "Background Remover",
    description: "Remove backgrounds with AI models or algorithmic methods like chroma key",
    href: "/bg-remover",
    audience: "content",
    icon: <Eraser size={28} strokeWidth={1.5} />,
  },
  {
    name: "Screenshot Beautifier",
    description: "Add backgrounds, shadows, and device frames to screenshots",
    href: "/screenshot-beautifier",
    audience: "content",
    icon: <Monitor size={28} strokeWidth={1.5} />,
  },
  {
    name: "Mockup Generator",
    description: "Place screenshots into phone, laptop, tablet, and browser mockups",
    href: "/mockup-generator",
    audience: "content",
    icon: <Smartphone size={28} strokeWidth={1.5} />,
  },
  {
    name: "Code Screenshot",
    description: "Create beautiful syntax-highlighted code images with themes and window chrome",
    href: "/code-screenshot",
    audience: "developer",
    icon: <Code size={28} strokeWidth={1.5} />,
  },
  {
    name: "Meme Maker",
    description: "Create memes with text overlays, stickers, and custom fonts",
    href: "/meme-maker",
    audience: "content",
    icon: <Smile size={28} strokeWidth={1.5} />,
  },
  {
    name: "Favicon Generator",
    description: "Generate favicons in all sizes from a single image with HTML and manifest snippets",
    href: "/favicon-generator",
    audience: "developer",
    icon: <ImageIcon size={28} strokeWidth={1.5} />,
  },

  // ── Design ──
  {
    name: "Palette Extractor",
    description: "Pull color palettes from images and copy CSS-ready swatches",
    href: "/palette-extractor",
    audience: "design",
    icon: <Palette size={28} strokeWidth={1.5} />,
  },
  {
    name: "Gradient Generator",
    description: "Build CSS linear, radial, and conic gradients with presets and color stops",
    href: "/gradient-generator",
    audience: "design",
    icon: <Paintbrush size={28} strokeWidth={1.5} />,
  },
  {
    name: "Shadow Generator",
    description: "Build box-shadow and text-shadow CSS with multiple layers and presets",
    href: "/shadow-generator",
    audience: "design",
    icon: <Square size={28} strokeWidth={1.5} />,
  },
  {
    name: "Contrast Checker",
    description: "WCAG color contrast accessibility checker with AA/AAA pass/fail badges",
    href: "/contrast-checker",
    audience: "design",
    icon: <Eye size={28} strokeWidth={1.5} />,
  },
  {
    name: "Color Converter",
    description: "Convert colors between HEX, RGB, HSL, HSB, CMYK, and Tailwind names",
    href: "/color-converter",
    audience: "design",
    icon: <Pipette size={28} strokeWidth={1.5} />,
  },
  {
    name: "Texture Generator",
    description: "Generate procedural textures: noise, grain, halftone, paper, stripes, and more",
    href: "/texture-generator",
    audience: "design",
    icon: <Layers size={28} strokeWidth={1.5} />,
  },

  // ── Game Dev ──
  {
    name: "Sprite Sheet Studio",
    description: "Pack sprites into atlases and export metadata for game pipelines",
    href: "/sprite-sheet-studio",
    audience: "gamedev",
    icon: <Gamepad2 size={28} strokeWidth={1.5} />,
  },
  {
    name: "Tilemap Slicer",
    description: "Cut tilesets into individual tiles with grid overlay and metadata export",
    href: "/tilemap-slicer",
    audience: "gamedev",
    icon: <Grid3x3 size={28} strokeWidth={1.5} />,
  },
  {
    name: "Animation Previewer",
    description: "Preview sprite animations with playback controls, onion skinning, and timing",
    href: "/animation-previewer",
    audience: "gamedev",
    icon: <Film size={28} strokeWidth={1.5} />,
  },
  {
    name: "Hitbox Editor",
    description: "Draw collision boxes over sprites and export hitbox metadata as JSON",
    href: "/hitbox-editor",
    audience: "gamedev",
    icon: <Box size={28} strokeWidth={1.5} />,
  },

  // ── Developer ──
  {
    name: "JSON Studio",
    description: "Format, validate, minify, and inspect JSON",
    href: "/json-studio",
    audience: "developer",
    icon: <Binary size={28} strokeWidth={1.5} />,
  },
  {
    name: "Regex Lab",
    description: "Test regex patterns with live match highlighting, capture groups, and replace mode",
    href: "/regex-lab",
    audience: "developer",
    icon: <Terminal size={28} strokeWidth={1.5} />,
  },
  {
    name: "Diff Viewer",
    description: "Compare text and JSON side by side with split, unified, and inline diff views",
    href: "/diff-viewer",
    audience: "developer",
    icon: <GitCompare size={28} strokeWidth={1.5} />,
  },
  {
    name: "JWT Inspector",
    description: "Decode and inspect JWT tokens with claims analysis and expiry checking",
    href: "/jwt-inspector",
    audience: "developer",
    icon: <KeyRound size={28} strokeWidth={1.5} />,
  },
  {
    name: "CSV Studio",
    description: "Parse, view, filter, sort, and convert CSV data to JSON",
    href: "/csv-studio",
    audience: "developer",
    icon: <Table size={28} strokeWidth={1.5} />,
  },
  {
    name: "UUID & Hash Generator",
    description: "Generate UUIDs, ULIDs, and compute SHA hashes for text and files",
    href: "/uuid-hash",
    audience: "developer",
    icon: <Hash size={28} strokeWidth={1.5} />,
  },
  {
    name: "Base64 / Encode Tool",
    description: "Encode and decode Base64, URL encoding, HTML entities, and hex",
    href: "/base64-tool",
    audience: "developer",
    icon: <FileCode size={28} strokeWidth={1.5} />,
  },
  {
    name: "Cron Builder",
    description: "Visual cron expression builder with plain-English descriptions and next run times",
    href: "/cron-builder",
    audience: "developer",
    icon: <Timer size={28} strokeWidth={1.5} />,
  },
  {
    name: "Timestamp Converter",
    description: "Convert unix timestamps, calculate durations, and explore time formats",
    href: "/timestamp-converter",
    audience: "developer",
    icon: <Clock size={28} strokeWidth={1.5} />,
  },

  // ── Text / Content ──
  {
    name: "Font Creator",
    description: "Draw, import, or extract glyphs to build custom fonts",
    href: "/font-creator",
    audience: "branding",
    icon: <Type size={28} strokeWidth={1.5} />,
  },
  {
    name: "QR Generator",
    description: "Create customizable QR codes with logos, styles, and export options",
    href: "/qr-generator",
    audience: "marketing",
    icon: <QrCode size={28} strokeWidth={1.5} />,
  },
  {
    name: "Markdown Editor",
    description: "Split-pane markdown editor with live preview, toolbar, and HTML/MD export",
    href: "/markdown-editor",
    audience: "developer",
    icon: <FileText size={28} strokeWidth={1.5} />,
  },
  {
    name: "Lorem Ipsum Generator",
    description: "Generate placeholder text in 6 styles: Classic, Hipster, Corporate, Pirate, Space, Cat",
    href: "/lorem-generator",
    audience: "content",
    icon: <TextCursorInput size={28} strokeWidth={1.5} />,
  },
];
