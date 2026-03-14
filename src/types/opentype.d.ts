declare module "opentype.js" {
  export class Path {
    fill: string | null;
    stroke: string | null;
    strokeWidth: number;
    constructor();
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
    close(): void;
    draw(ctx: CanvasRenderingContext2D): void;
    toSVG(decimalPlaces?: number): string;
  }

  export class Glyph {
    index: number;
    name: string;
    unicode: number;
    path: Path;
    advanceWidth: number;
    constructor(options: {
      name: string;
      unicode: number;
      advanceWidth: number;
      path: Path;
    });
    getPath(x: number, y: number, fontSize: number): Path;
    draw(ctx: CanvasRenderingContext2D, x: number, y: number, fontSize: number): void;
  }

  export class Font {
    names: {
      fontFamily?: { en: string };
      fontSubfamily?: { en: string };
    };
    unitsPerEm: number;
    ascender: number;
    descender: number;
    glyphs: { length: number; get(index: number): Glyph };
    constructor(options: {
      familyName: string;
      styleName: string;
      unitsPerEm: number;
      ascender: number;
      descender: number;
      glyphs: Glyph[];
    });
    charToGlyph(char: string): Glyph;
    stringToGlyphs(str: string): Glyph[];
    getPath(text: string, x: number, y: number, fontSize: number): Path;
    download(): void;
    toArrayBuffer(): ArrayBuffer;
  }

  export function parse(buffer: ArrayBuffer): Font;
  export function load(url: string, callback: (err: Error | null, font?: Font) => void): void;
}
