declare module "qrcode" {
  interface QRCodeOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
    type?: string;
  }

  interface QRCodeSegment {
    data: string | Buffer;
    mode?: string;
  }

  interface QRCodeResult {
    modules: {
      size: number;
      data: Uint8Array;
      reservedBit: Uint8Array;
    };
    version: number;
    errorCorrectionLevel: { bit: number };
    maskPattern: number;
    segments: QRCodeSegment[];
  }

  function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: QRCodeOptions
  ): Promise<void>;

  function toDataURL(
    text: string,
    options?: QRCodeOptions
  ): Promise<string>;

  function toString(
    text: string,
    options?: QRCodeOptions & { type?: "svg" | "utf8" | "terminal" }
  ): Promise<string>;

  function create(
    text: string,
    options?: QRCodeOptions
  ): QRCodeResult;

  export { toCanvas, toDataURL, toString, create };
  export default { toCanvas, toDataURL, toString, create };
}
