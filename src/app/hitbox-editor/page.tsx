"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Box,
  Circle,
  ClipboardCopy,
  Copy,
  Download,
  Eye,
  EyeOff,
  Grid3X3,
  Minus,
  MousePointer2,
  Maximize,
  Pentagon,
  Plus,
  Square,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Tool = "select" | "rect" | "circle" | "polygon";

interface HitboxRect {
  id: string;
  type: "rect";
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  visible: boolean;
}

interface HitboxCircle {
  id: string;
  type: "circle";
  label: string;
  color: string;
  cx: number;
  cy: number;
  radius: number;
  opacity: number;
  visible: boolean;
}

interface HitboxPolygon {
  id: string;
  type: "polygon";
  label: string;
  color: string;
  vertices: [number, number][];
  opacity: number;
  visible: boolean;
}

type Hitbox = HitboxRect | HitboxCircle | HitboxPolygon;

interface DragState {
  type: "draw-rect" | "draw-circle" | "move" | "resize";
  startX: number;
  startY: number;
  hitboxId?: string;
  handle?: string;
  offsetX?: number;
  offsetY?: number;
  originalHitbox?: Hitbox;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const HITBOX_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

let idCounter = 0;
function newId() {
  return `hb_${++idCounter}_${Date.now()}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function pointInRect(px: number, py: number, hb: HitboxRect): boolean {
  return px >= hb.x && px <= hb.x + hb.w && py >= hb.y && py <= hb.y + hb.h;
}

function pointInCircle(px: number, py: number, hb: HitboxCircle): boolean {
  const dx = px - hb.cx;
  const dy = py - hb.cy;
  return dx * dx + dy * dy <= hb.radius * hb.radius;
}

function pointInPolygon(px: number, py: number, hb: HitboxPolygon): boolean {
  const vs = hb.vertices;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0],
      yi = vs[i][1];
    const xj = vs[j][0],
      yj = vs[j][1];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function hitboxContainsPoint(px: number, py: number, hb: Hitbox): boolean {
  if (!hb.visible) return false;
  if (hb.type === "rect") return pointInRect(px, py, hb);
  if (hb.type === "circle") return pointInCircle(px, py, hb);
  if (hb.type === "polygon") return pointInPolygon(px, py, hb);
  return false;
}

function getResizeHandles(hb: Hitbox): { key: string; x: number; y: number }[] {
  const S = 4;
  if (hb.type === "rect") {
    return [
      { key: "nw", x: hb.x, y: hb.y },
      { key: "n", x: hb.x + hb.w / 2, y: hb.y },
      { key: "ne", x: hb.x + hb.w, y: hb.y },
      { key: "e", x: hb.x + hb.w, y: hb.y + hb.h / 2 },
      { key: "se", x: hb.x + hb.w, y: hb.y + hb.h },
      { key: "s", x: hb.x + hb.w / 2, y: hb.y + hb.h },
      { key: "sw", x: hb.x, y: hb.y + hb.h },
      { key: "w", x: hb.x, y: hb.y + hb.h / 2 },
    ];
  }
  if (hb.type === "circle") {
    return [
      { key: "n", x: hb.cx, y: hb.cy - hb.radius },
      { key: "e", x: hb.cx + hb.radius, y: hb.cy },
      { key: "s", x: hb.cx, y: hb.cy + hb.radius },
      { key: "w", x: hb.cx - hb.radius, y: hb.cy },
    ];
  }
  return [];
}

function handleAtPoint(
  px: number,
  py: number,
  hb: Hitbox,
  zoom: number,
): string | null {
  const handles = getResizeHandles(hb);
  const threshold = 6 / zoom;
  for (const h of handles) {
    if (Math.abs(px - h.x) <= threshold && Math.abs(py - h.y) <= threshold) {
      return h.key;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HitboxEditorPage() {
  /* --- State --- */
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState("");
  const [hitboxes, setHitboxes] = useState<Hitbox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [polygonVertices, setPolygonVertices] = useState<[number, number][]>([]);
  const [copied, setCopied] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animRef = useRef<number>(0);

  const selected = hitboxes.find((h) => h.id === selectedId) ?? null;

  /* --- Helpers --- */
  const nextColor = useCallback(() => {
    const c = HITBOX_COLORS[colorIndex % HITBOX_COLORS.length];
    setColorIndex((i) => i + 1);
    return c;
  }, [colorIndex]);

  const screenToSprite = useCallback(
    (sx: number, sy: number): [number, number] => {
      const canvas = canvasRef.current;
      if (!canvas) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      const cx = (sx - rect.left - panX) / zoom;
      const cy = (sy - rect.top - panY) / zoom;
      return [Math.round(cx), Math.round(cy)];
    },
    [zoom, panX, panY],
  );

  const updateHitbox = useCallback((id: string, patch: Partial<Hitbox>) => {
    setHitboxes((prev) =>
      prev.map((h) => (h.id === id ? ({ ...h, ...patch } as Hitbox) : h)),
    );
  }, []);

  /* --- Image upload --- */
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageName(file.name);
      setHitboxes([]);
      setSelectedId(null);
      setZoom(1);
      setPanX(0);
      setPanY(0);
    };
    img.src = URL.createObjectURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  /* --- Fit zoom --- */
  const fitZoom = useCallback(() => {
    if (!image || !containerRef.current) return;
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scaleX = (cw - 40) / image.width;
    const scaleY = (ch - 40) / image.height;
    const z = Math.min(scaleX, scaleY, 4);
    setZoom(z);
    setPanX((cw - image.width * z) / 2);
    setPanY((ch - image.height * z) / 2);
  }, [image]);

  useEffect(() => {
    fitZoom();
  }, [fitZoom]);

  /* --- Canvas drawing --- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* checkerboard background */
    const checkerSize = 10;
    for (let y = 0; y < canvas.height; y += checkerSize) {
      for (let x = 0; x < canvas.width; x += checkerSize) {
        ctx.fillStyle =
          (Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0
            ? "#1a1a1a"
            : "#222222";
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    /* sprite image */
    if (image) {
      ctx.drawImage(image, 0, 0);
    }

    /* grid overlay */
    if (showGrid && image) {
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1 / zoom;
      for (let x = 0; x <= image.width; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, image.height);
        ctx.stroke();
      }
      for (let y = 0; y <= image.height; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(image.width, y);
        ctx.stroke();
      }
    }

    /* draw hitboxes */
    for (const hb of hitboxes) {
      if (!hb.visible) continue;
      const isSelected = hb.id === selectedId;
      const fillAlpha = hb.opacity * 0.3;
      const strokeAlpha = hb.opacity;

      ctx.fillStyle = hexToRgba(hb.color, fillAlpha);
      ctx.strokeStyle = hexToRgba(hb.color, strokeAlpha);
      ctx.lineWidth = (isSelected ? 2.5 : 1.5) / zoom;

      if (hb.type === "rect") {
        ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
        ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
      } else if (hb.type === "circle") {
        ctx.beginPath();
        ctx.arc(hb.cx, hb.cy, hb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (hb.type === "polygon" && hb.vertices.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(hb.vertices[0][0], hb.vertices[0][1]);
        for (let i = 1; i < hb.vertices.length; i++) {
          ctx.lineTo(hb.vertices[i][0], hb.vertices[i][1]);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      /* label */
      if (hb.label) {
        const fontSize = Math.max(10, 12 / zoom);
        ctx.font = `${fontSize}px sans-serif`;
        let lx: number, ly: number;
        if (hb.type === "rect") {
          lx = hb.x + 3 / zoom;
          ly = hb.y - 4 / zoom;
        } else if (hb.type === "circle") {
          lx = hb.cx - hb.radius;
          ly = hb.cy - hb.radius - 4 / zoom;
        } else {
          lx = hb.vertices[0]?.[0] ?? 0;
          ly = (hb.vertices[0]?.[1] ?? 0) - 4 / zoom;
        }
        ctx.fillStyle = hb.color;
        ctx.fillText(hb.label, lx, ly);
      }

      /* resize handles */
      if (isSelected) {
        const handles = getResizeHandles(hb);
        const hs = 5 / zoom;
        for (const handle of handles) {
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = hb.color;
          ctx.lineWidth = 1.5 / zoom;
          ctx.fillRect(handle.x - hs / 2, handle.y - hs / 2, hs, hs);
          ctx.strokeRect(handle.x - hs / 2, handle.y - hs / 2, hs, hs);
        }
      }
    }

    /* polygon in-progress */
    if (tool === "polygon" && polygonVertices.length > 0) {
      ctx.strokeStyle = HITBOX_COLORS[colorIndex % HITBOX_COLORS.length];
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(polygonVertices[0][0], polygonVertices[0][1]);
      for (let i = 1; i < polygonVertices.length; i++) {
        ctx.lineTo(polygonVertices[i][0], polygonVertices[i][1]);
      }
      if (mouseCoords) {
        ctx.lineTo(mouseCoords.x, mouseCoords.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      /* vertex dots */
      const dotR = 3 / zoom;
      ctx.fillStyle = HITBOX_COLORS[colorIndex % HITBOX_COLORS.length];
      for (const v of polygonVertices) {
        ctx.beginPath();
        ctx.arc(v[0], v[1], dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* draw preview for rect/circle being drawn */
    if (dragState && (dragState.type === "draw-rect" || dragState.type === "draw-circle") && mouseCoords) {
      const previewColor = HITBOX_COLORS[(colorIndex) % HITBOX_COLORS.length];
      ctx.strokeStyle = previewColor;
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.fillStyle = hexToRgba(previewColor, 0.15);

      if (dragState.type === "draw-rect") {
        const x = Math.min(dragState.startX, mouseCoords.x);
        const y = Math.min(dragState.startY, mouseCoords.y);
        const w = Math.abs(mouseCoords.x - dragState.startX);
        const h = Math.abs(mouseCoords.y - dragState.startY);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      } else {
        const dx = mouseCoords.x - dragState.startX;
        const dy = mouseCoords.y - dragState.startY;
        const r = Math.sqrt(dx * dx + dy * dy);
        ctx.beginPath();
        ctx.arc(dragState.startX, dragState.startY, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.restore();

    /* coordinate display */
    if (mouseCoords && image) {
      const text = `${mouseCoords.x}, ${mouseCoords.y}`;
      ctx.font = "11px monospace";
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      const metrics = ctx.measureText(text);
      ctx.fillRect(canvas.width - metrics.width - 16, canvas.height - 26, metrics.width + 12, 20);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, canvas.width - metrics.width - 10, canvas.height - 12);
    }

    animRef.current = requestAnimationFrame(draw);
  }, [image, hitboxes, selectedId, showGrid, zoom, panX, panY, mouseCoords, tool, dragState, polygonVertices, colorIndex]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  /* --- Mouse handlers --- */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!image) return;
      if (e.button === 1) return; // middle click
      const [sx, sy] = screenToSprite(e.clientX, e.clientY);

      if (tool === "select") {
        /* check resize handles first */
        if (selected) {
          const handle = handleAtPoint(sx, sy, selected, zoom);
          if (handle) {
            setDragState({
              type: "resize",
              startX: sx,
              startY: sy,
              hitboxId: selected.id,
              handle,
              originalHitbox: { ...selected } as Hitbox,
            });
            return;
          }
        }

        /* check hitbox click (reverse order for top-most) */
        for (let i = hitboxes.length - 1; i >= 0; i--) {
          if (hitboxContainsPoint(sx, sy, hitboxes[i])) {
            setSelectedId(hitboxes[i].id);
            const hb = hitboxes[i];
            let ox = 0,
              oy = 0;
            if (hb.type === "rect") {
              ox = sx - hb.x;
              oy = sy - hb.y;
            } else if (hb.type === "circle") {
              ox = sx - hb.cx;
              oy = sy - hb.cy;
            }
            setDragState({
              type: "move",
              startX: sx,
              startY: sy,
              hitboxId: hb.id,
              offsetX: ox,
              offsetY: oy,
              originalHitbox: { ...hb } as Hitbox,
            });
            return;
          }
        }
        setSelectedId(null);
      } else if (tool === "rect") {
        setDragState({ type: "draw-rect", startX: sx, startY: sy });
      } else if (tool === "circle") {
        setDragState({ type: "draw-circle", startX: sx, startY: sy });
      } else if (tool === "polygon") {
        /* handled in click */
      }
    },
    [image, tool, selected, hitboxes, screenToSprite, zoom],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!image) return;
      const [sx, sy] = screenToSprite(e.clientX, e.clientY);
      setMouseCoords({ x: sx, y: sy });

      if (!dragState) return;

      if (dragState.type === "move" && dragState.hitboxId && dragState.originalHitbox) {
        const dx = sx - dragState.startX;
        const dy = sy - dragState.startY;
        const orig = dragState.originalHitbox;

        if (orig.type === "rect") {
          updateHitbox(dragState.hitboxId, {
            x: (orig as HitboxRect).x + dx,
            y: (orig as HitboxRect).y + dy,
          });
        } else if (orig.type === "circle") {
          updateHitbox(dragState.hitboxId, {
            cx: (orig as HitboxCircle).cx + dx,
            cy: (orig as HitboxCircle).cy + dy,
          } as Partial<HitboxCircle>);
        } else if (orig.type === "polygon") {
          const origVerts = (orig as HitboxPolygon).vertices;
          updateHitbox(dragState.hitboxId, {
            vertices: origVerts.map(([vx, vy]) => [vx + dx, vy + dy] as [number, number]),
          } as Partial<HitboxPolygon>);
        }
      } else if (dragState.type === "resize" && dragState.hitboxId && dragState.originalHitbox && dragState.handle) {
        const orig = dragState.originalHitbox;
        const handle = dragState.handle;

        if (orig.type === "rect") {
          const r = orig as HitboxRect;
          let nx = r.x,
            ny = r.y,
            nw = r.w,
            nh = r.h;

          if (handle.includes("w")) {
            nw = r.x + r.w - sx;
            nx = sx;
          }
          if (handle.includes("e")) {
            nw = sx - r.x;
          }
          if (handle.includes("n")) {
            nh = r.y + r.h - sy;
            ny = sy;
          }
          if (handle.includes("s")) {
            nh = sy - r.y;
          }

          if (nw < 0) {
            nx = nx + nw;
            nw = -nw;
          }
          if (nh < 0) {
            ny = ny + nh;
            nh = -nh;
          }

          updateHitbox(dragState.hitboxId, { x: nx, y: ny, w: Math.max(1, nw), h: Math.max(1, nh) });
        } else if (orig.type === "circle") {
          const c = orig as HitboxCircle;
          const dx = sx - c.cx;
          const dy = sy - c.cy;
          updateHitbox(dragState.hitboxId, { radius: Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy))) } as Partial<HitboxCircle>);
        }
      }
      /* draw-rect / draw-circle preview handled in draw() */
    },
    [image, dragState, screenToSprite, updateHitbox],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!image) return;
      const [sx, sy] = screenToSprite(e.clientX, e.clientY);

      if (dragState?.type === "draw-rect") {
        const x = Math.min(dragState.startX, sx);
        const y = Math.min(dragState.startY, sy);
        const w = Math.abs(sx - dragState.startX);
        const h = Math.abs(sy - dragState.startY);
        if (w > 2 && h > 2) {
          const color = nextColor();
          const newHb: HitboxRect = {
            id: newId(),
            type: "rect",
            label: `rect_${hitboxes.length + 1}`,
            color,
            x,
            y,
            w,
            h,
            opacity: 1,
            visible: true,
          };
          setHitboxes((prev) => [...prev, newHb]);
          setSelectedId(newHb.id);
        }
      } else if (dragState?.type === "draw-circle") {
        const dx = sx - dragState.startX;
        const dy = sy - dragState.startY;
        const r = Math.round(Math.sqrt(dx * dx + dy * dy));
        if (r > 2) {
          const color = nextColor();
          const newHb: HitboxCircle = {
            id: newId(),
            type: "circle",
            label: `circle_${hitboxes.length + 1}`,
            color,
            cx: dragState.startX,
            cy: dragState.startY,
            radius: r,
            opacity: 1,
            visible: true,
          };
          setHitboxes((prev) => [...prev, newHb]);
          setSelectedId(newHb.id);
        }
      }

      setDragState(null);
    },
    [image, dragState, screenToSprite, hitboxes.length, nextColor],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (tool !== "polygon" || !image) return;
      const [sx, sy] = screenToSprite(e.clientX, e.clientY);
      setPolygonVertices((prev) => [...prev, [sx, sy]]);
    },
    [tool, image, screenToSprite],
  );

  const handleCanvasDoubleClick = useCallback(() => {
    if (tool !== "polygon") return;
    if (polygonVertices.length >= 3) {
      const color = nextColor();
      const newHb: HitboxPolygon = {
        id: newId(),
        type: "polygon",
        label: `poly_${hitboxes.length + 1}`,
        color,
        vertices: [...polygonVertices],
        opacity: 1,
        visible: true,
      };
      setHitboxes((prev) => [...prev, newHb]);
      setSelectedId(newHb.id);
    }
    setPolygonVertices([]);
  }, [tool, polygonVertices, hitboxes.length, nextColor]);

  /* --- Keyboard shortcuts --- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          setHitboxes((prev) => prev.filter((h) => h.id !== selectedId));
          setSelectedId(null);
        }
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setPolygonVertices([]);
        setDragState(null);
      }
      if (e.key === "v" || e.key === "V") setTool("select");
      if (e.key === "r" || e.key === "R") setTool("rect");
      if (e.key === "c" || e.key === "C") setTool("circle");
      if (e.key === "p" || e.key === "P") setTool("polygon");
      if (e.key === "g" || e.key === "G") setShowGrid((v) => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId]);

  /* --- Canvas wheel for zoom --- */
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(20, Math.max(0.1, zoom * delta));

      /* zoom towards cursor */
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      setPanX((prev) => mx - (mx - prev) * (newZoom / zoom));
      setPanY((prev) => my - (my - prev) * (newZoom / zoom));
      setZoom(newZoom);
    },
    [zoom],
  );

  /* --- Export --- */
  const buildExportJson = useCallback(() => {
    return JSON.stringify(
      {
        spriteWidth: image?.width ?? 0,
        spriteHeight: image?.height ?? 0,
        hitboxes: hitboxes.map((hb) => {
          if (hb.type === "rect") {
            return { label: hb.label, type: "rect", x: hb.x, y: hb.y, width: hb.w, height: hb.h, color: hb.color };
          }
          if (hb.type === "circle") {
            return { label: hb.label, type: "circle", cx: hb.cx, cy: hb.cy, radius: hb.radius, color: hb.color };
          }
          return { label: hb.label, type: "polygon", vertices: hb.vertices, color: hb.color };
        }),
      },
      null,
      2,
    );
  }, [image, hitboxes]);

  const handleCopyJson = useCallback(() => {
    navigator.clipboard.writeText(buildExportJson());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [buildExportJson]);

  const handleDownloadJson = useCallback(() => {
    const blob = new Blob([buildExportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const baseName = imageName ? imageName.replace(/\.[^.]+$/, "") : "hitboxes";
    a.download = `${baseName}_hitboxes.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildExportJson, imageName]);

  /* --- Delete / Duplicate --- */
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setHitboxes((prev) => prev.filter((h) => h.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const dup = { ...selected, id: newId(), label: `${selected.label}_copy` } as Hitbox;
    if (dup.type === "rect") {
      (dup as HitboxRect).x += 10;
      (dup as HitboxRect).y += 10;
    } else if (dup.type === "circle") {
      (dup as HitboxCircle).cx += 10;
      (dup as HitboxCircle).cy += 10;
    } else if (dup.type === "polygon") {
      (dup as HitboxPolygon).vertices = (selected as HitboxPolygon).vertices.map(
        ([x, y]) => [x + 10, y + 10] as [number, number],
      );
    }
    setHitboxes((prev) => [...prev, dup]);
    setSelectedId(dup.id);
  }, [selected]);

  /* --- Tool buttons data --- */
  const tools: { key: Tool; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { key: "select", icon: <MousePointer2 size={14} />, label: "Select", shortcut: "V" },
    { key: "rect", icon: <Square size={14} />, label: "Rectangle", shortcut: "R" },
    { key: "circle", icon: <Circle size={14} />, label: "Circle", shortcut: "C" },
    { key: "polygon", icon: <Pentagon size={14} />, label: "Polygon", shortcut: "P" },
  ];

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>

        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <Box size={14} />
          <span className="text-sm font-semibold">Hitbox Editor</span>
        </div>

        {image && (
          <span className="text-xs text-[var(--muted)] ml-1 truncate max-w-48">
            {imageName} ({image.width}x{image.height})
          </span>
        )}

        <div className="flex-1" />

        {image && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyJson}
              disabled={hitboxes.length === 0}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {copied ? <ClipboardCopy size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              disabled={hitboxes.length === 0}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={12} />
              Export JSON
            </button>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ---- Left Sidebar ---- */}
        {image && (
          <aside className="w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden">
            {/* Tools */}
            <div className="p-3 border-b border-[var(--border)]">
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2 font-medium">Tools</p>
              <div className="grid grid-cols-4 gap-1">
                {tools.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTool(t.key);
                      if (t.key !== "polygon") setPolygonVertices([]);
                    }}
                    title={`${t.label} (${t.shortcut})`}
                    className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs transition-colors ${
                      tool === t.key
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {t.icon}
                    <span className="text-[9px] leading-none">{t.label}</span>
                  </button>
                ))}
              </div>
              {tool === "polygon" && polygonVertices.length > 0 && (
                <p className="text-[10px] text-[var(--muted)] mt-2">
                  {polygonVertices.length} vertices. Double-click to close.
                </p>
              )}
            </div>

            {/* Hitbox List */}
            <div className="flex-1 overflow-y-auto p-2">
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2 px-1 font-medium">
                Hitboxes ({hitboxes.length})
              </p>
              {hitboxes.length === 0 && (
                <p className="text-xs text-[var(--muted)] px-1">No hitboxes yet. Draw one on the canvas.</p>
              )}
              <div className="flex flex-col gap-0.5">
                {hitboxes.map((hb) => (
                  <div
                    key={hb.id}
                    onClick={() => setSelectedId(hb.id)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors group ${
                      selectedId === hb.id
                        ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                        : "hover:bg-[var(--surface-hover)] border border-transparent"
                    }`}
                  >
                    {/* type icon */}
                    <span className="text-[var(--muted)] flex-shrink-0">
                      {hb.type === "rect" && <Square size={12} />}
                      {hb.type === "circle" && <Circle size={12} />}
                      {hb.type === "polygon" && <Pentagon size={12} />}
                    </span>

                    {/* color swatch */}
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0 border border-[var(--border)]"
                      style={{ backgroundColor: hb.color }}
                    />

                    {/* label */}
                    <span className="flex-1 truncate text-[var(--foreground)]">{hb.label}</span>

                    {/* visibility */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateHitbox(hb.id, { visible: !hb.visible });
                      }}
                      className="text-[var(--muted)] hover:text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {hb.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>

                    {/* delete */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHitboxes((prev) => prev.filter((h) => h.id !== hb.id));
                        if (selectedId === hb.id) setSelectedId(null);
                      }}
                      className="text-[var(--muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* ---- Canvas Area ---- */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas toolbar */}
          {image && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowGrid((v) => !v)}
                title="Toggle grid (G)"
                className={`p-1.5 rounded-md transition-colors ${
                  showGrid
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                }`}
              >
                <Grid3X3 size={13} />
              </button>

              <div className="w-px h-4 bg-[var(--border)]" />

              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(20, z * 1.25))}
                title="Zoom in"
                className="p-1.5 rounded-md text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors"
              >
                <ZoomIn size={13} />
              </button>

              <span className="text-[10px] text-[var(--muted)] font-mono min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.1, z / 1.25))}
                title="Zoom out"
                className="p-1.5 rounded-md text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors"
              >
                <ZoomOut size={13} />
              </button>

              <div className="w-px h-4 bg-[var(--border)]" />

              <button
                type="button"
                onClick={fitZoom}
                title="Fit to view"
                className="p-1.5 rounded-md text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors"
              >
                <Maximize size={13} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  if (image && containerRef.current) {
                    setPanX((containerRef.current.clientWidth - image.width) / 2);
                    setPanY((containerRef.current.clientHeight - image.height) / 2);
                  }
                }}
                title="100%"
                className="text-[10px] px-1.5 py-0.5 rounded-md text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors font-mono"
              >
                1:1
              </button>
            </div>
          )}

          {/* Canvas or upload */}
          <div ref={containerRef} className="flex-1 relative overflow-hidden">
            {!image ? (
              /* Drop zone */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 cursor-pointer group"
              >
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-[var(--border)] group-hover:border-[var(--accent)] flex items-center justify-center transition-colors">
                  <Upload size={28} className="text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--foreground)]">Drop a sprite image here</p>
                  <p className="text-xs text-[var(--muted)] mt-1">or click to browse. PNG, JPG, WebP supported.</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{
                  cursor:
                    tool === "select"
                      ? dragState?.type === "move"
                        ? "grabbing"
                        : dragState?.type === "resize"
                          ? "nwse-resize"
                          : "default"
                      : "crosshair",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={handleCanvasClick}
                onDoubleClick={handleCanvasDoubleClick}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
              />
            )}
          </div>
        </div>

        {/* ---- Right Sidebar ---- */}
        {image && (
          <aside className="w-64 flex-shrink-0 border-l border-[var(--border)] bg-[var(--surface)] overflow-y-auto">
            {selected ? (
              <div className="p-3 flex flex-col gap-3">
                <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-medium">Properties</p>

                {/* Label */}
                <div>
                  <label className="text-[10px] text-[var(--muted)] mb-1 block">Label</label>
                  <input
                    type="text"
                    value={selected.label}
                    onChange={(e) => updateHitbox(selected.id, { label: e.target.value })}
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="text-[10px] text-[var(--muted)] mb-1 block">Type</label>
                  <span className="text-xs text-[var(--foreground)] capitalize flex items-center gap-1.5">
                    {selected.type === "rect" && <Square size={12} />}
                    {selected.type === "circle" && <Circle size={12} />}
                    {selected.type === "polygon" && <Pentagon size={12} />}
                    {selected.type}
                  </span>
                </div>

                {/* Color */}
                <div>
                  <label className="text-[10px] text-[var(--muted)] mb-1 block">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selected.color}
                      onChange={(e) => updateHitbox(selected.id, { color: e.target.value })}
                      className="w-7 h-7 rounded-md border border-[var(--border)] cursor-pointer bg-transparent"
                    />
                    <span className="text-xs text-[var(--muted)] font-mono">{selected.color}</span>
                  </div>
                </div>

                {/* Rect properties */}
                {selected.type === "rect" && (
                  <div>
                    <label className="text-[10px] text-[var(--muted)] mb-1 block">Position & Size</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          ["X", "x"],
                          ["Y", "y"],
                          ["W", "w"],
                          ["H", "h"],
                        ] as const
                      ).map(([label, key]) => (
                        <div key={key} className="flex items-center gap-1">
                          <span className="text-[10px] text-[var(--muted)] w-3">{label}</span>
                          <input
                            type="number"
                            value={(selected as HitboxRect)[key]}
                            onChange={(e) =>
                              updateHitbox(selected.id, { [key]: parseInt(e.target.value) || 0 } as Partial<HitboxRect>)
                            }
                            className="flex-1 text-xs px-1.5 py-1 rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] w-full font-mono transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Circle properties */}
                {selected.type === "circle" && (
                  <div>
                    <label className="text-[10px] text-[var(--muted)] mb-1 block">Center & Radius</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          ["CX", "cx"],
                          ["CY", "cy"],
                        ] as const
                      ).map(([label, key]) => (
                        <div key={key} className="flex items-center gap-1">
                          <span className="text-[10px] text-[var(--muted)] w-5">{label}</span>
                          <input
                            type="number"
                            value={(selected as HitboxCircle)[key]}
                            onChange={(e) =>
                              updateHitbox(selected.id, { [key]: parseInt(e.target.value) || 0 } as Partial<HitboxCircle>)
                            }
                            className="flex-1 text-xs px-1.5 py-1 rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] w-full font-mono transition-colors"
                          />
                        </div>
                      ))}
                      <div className="flex items-center gap-1 col-span-2">
                        <span className="text-[10px] text-[var(--muted)] w-5">R</span>
                        <input
                          type="number"
                          value={(selected as HitboxCircle).radius}
                          onChange={(e) =>
                            updateHitbox(selected.id, { radius: Math.max(1, parseInt(e.target.value) || 1) } as Partial<HitboxCircle>)
                          }
                          className="flex-1 text-xs px-1.5 py-1 rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] w-full font-mono transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Polygon properties */}
                {selected.type === "polygon" && (
                  <div>
                    <label className="text-[10px] text-[var(--muted)] mb-1 block">
                      Vertices ({(selected as HitboxPolygon).vertices.length})
                    </label>
                    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                      {(selected as HitboxPolygon).vertices.map(([vx, vy], i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className="text-[10px] text-[var(--muted)] w-4 flex-shrink-0">{i + 1}</span>
                          <input
                            type="number"
                            value={vx}
                            onChange={(e) => {
                              const verts = [...(selected as HitboxPolygon).vertices] as [number, number][];
                              verts[i] = [parseInt(e.target.value) || 0, verts[i][1]];
                              updateHitbox(selected.id, { vertices: verts } as Partial<HitboxPolygon>);
                            }}
                            className="flex-1 text-xs px-1.5 py-1 rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] font-mono transition-colors"
                          />
                          <input
                            type="number"
                            value={vy}
                            onChange={(e) => {
                              const verts = [...(selected as HitboxPolygon).vertices] as [number, number][];
                              verts[i] = [verts[i][0], parseInt(e.target.value) || 0];
                              updateHitbox(selected.id, { vertices: verts } as Partial<HitboxPolygon>);
                            }}
                            className="flex-1 text-xs px-1.5 py-1 rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] font-mono transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Opacity */}
                <div>
                  <label className="text-[10px] text-[var(--muted)] mb-1 block">
                    Opacity ({Math.round(selected.opacity * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selected.opacity}
                    onChange={(e) => updateHitbox(selected.id, { opacity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 rounded-full appearance-none bg-[var(--border)] accent-[var(--accent)]"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 pt-1 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={duplicateSelected}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <Copy size={12} />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 flex flex-col items-center justify-center h-full text-center">
                <MousePointer2 size={20} className="text-[var(--muted)] mb-2" />
                <p className="text-xs text-[var(--muted)]">Select a hitbox to edit its properties</p>
                <div className="mt-4 text-[10px] text-[var(--muted)] space-y-1">
                  <p><kbd className="px-1 py-0.5 rounded bg-[var(--background)] border border-[var(--border)] font-mono">V</kbd> Select</p>
                  <p><kbd className="px-1 py-0.5 rounded bg-[var(--background)] border border-[var(--border)] font-mono">R</kbd> Rectangle</p>
                  <p><kbd className="px-1 py-0.5 rounded bg-[var(--background)] border border-[var(--border)] font-mono">C</kbd> Circle</p>
                  <p><kbd className="px-1 py-0.5 rounded bg-[var(--background)] border border-[var(--border)] font-mono">P</kbd> Polygon</p>
                  <p><kbd className="px-1 py-0.5 rounded bg-[var(--background)] border border-[var(--border)] font-mono">G</kbd> Grid</p>
                  <p><kbd className="px-1 py-0.5 rounded bg-[var(--background)] border border-[var(--border)] font-mono">Del</kbd> Delete</p>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
