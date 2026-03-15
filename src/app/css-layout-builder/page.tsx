"use client";

import { useCallback, useMemo, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Grid3X3,
  LayoutGrid,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Columns3,
  Rows3,
  ArrowRight,
  ArrowDown,
  WrapText,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                   */
/* ------------------------------------------------------------------ */

type Tab = "grid" | "flexbox";

interface GridColumn {
  size: string;
}

interface GridRow {
  size: string;
}

interface GridChildItem {
  id: string;
  name: string;
  color: string;
  placementMode: "manual" | "area";
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
  areaName: string;
}

interface FlexChild {
  id: string;
  name: string;
  color: string;
  flexGrow: number;
  flexShrink: number;
  flexBasis: string;
  alignSelf: string;
  order: number;
}

interface GridPreset {
  label: string;
  columns: GridColumn[];
  rows: GridRow[];
  areas: string[][];
  gap: number;
  columnGap: number;
  rowGap: number;
}

const CELL_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  "#84cc16", "#e11d48", "#0ea5e9", "#a855f7", "#22c55e",
  "#d946ef",
];

const GRID_PRESETS: GridPreset[] = [
  {
    label: "Holy Grail",
    columns: [{ size: "200px" }, { size: "1fr" }, { size: "200px" }],
    rows: [{ size: "60px" }, { size: "1fr" }, { size: "60px" }],
    areas: [
      ["header", "header", "header"],
      ["nav", "main", "aside"],
      ["footer", "footer", "footer"],
    ],
    gap: 8,
    columnGap: 8,
    rowGap: 8,
  },
  {
    label: "Sidebar Layout",
    columns: [{ size: "250px" }, { size: "1fr" }],
    rows: [{ size: "60px" }, { size: "1fr" }],
    areas: [
      ["header", "header"],
      ["sidebar", "content"],
    ],
    gap: 8,
    columnGap: 8,
    rowGap: 8,
  },
  {
    label: "Dashboard",
    columns: [{ size: "1fr" }, { size: "1fr" }, { size: "1fr" }],
    rows: [{ size: "60px" }, { size: "1fr" }, { size: "1fr" }],
    areas: [
      ["header", "header", "header"],
      ["card1", "card2", "card3"],
      ["main", "main", "sidebar"],
    ],
    gap: 12,
    columnGap: 12,
    rowGap: 12,
  },
  {
    label: "Photo Gallery",
    columns: [{ size: "1fr" }, { size: "1fr" }, { size: "1fr" }, { size: "1fr" }],
    rows: [{ size: "1fr" }, { size: "1fr" }, { size: "1fr" }],
    areas: [
      ["a", "a", "b", "c"],
      ["a", "a", "d", "d"],
      ["e", "f", "d", "d"],
    ],
    gap: 4,
    columnGap: 4,
    rowGap: 4,
  },
  {
    label: "Card Grid",
    columns: [{ size: "1fr" }, { size: "1fr" }, { size: "1fr" }],
    rows: [{ size: "1fr" }, { size: "1fr" }],
    areas: [
      ["c1", "c2", "c3"],
      ["c4", "c5", "c6"],
    ],
    gap: 16,
    columnGap: 16,
    rowGap: 16,
  },
];

const JUSTIFY_OPTIONS = [
  { value: "flex-start", label: "Start" },
  { value: "flex-end", label: "End" },
  { value: "center", label: "Center" },
  { value: "space-between", label: "Between" },
  { value: "space-around", label: "Around" },
  { value: "space-evenly", label: "Evenly" },
];

const ALIGN_ITEMS_OPTIONS = [
  { value: "flex-start", label: "Start" },
  { value: "flex-end", label: "End" },
  { value: "center", label: "Center" },
  { value: "stretch", label: "Stretch" },
  { value: "baseline", label: "Baseline" },
];

const ALIGN_CONTENT_OPTIONS = [
  { value: "flex-start", label: "Start" },
  { value: "flex-end", label: "End" },
  { value: "center", label: "Center" },
  { value: "stretch", label: "Stretch" },
  { value: "space-between", label: "Between" },
  { value: "space-around", label: "Around" },
];

const ALIGN_SELF_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "flex-start", label: "Start" },
  { value: "flex-end", label: "End" },
  { value: "center", label: "Center" },
  { value: "stretch", label: "Stretch" },
];

/* ------------------------------------------------------------------ */
/*  Utility                                                             */
/* ------------------------------------------------------------------ */

let _idCounter = 0;
function uid() {
  return `item_${++_idCounter}_${Date.now()}`;
}

function colorForIndex(i: number) {
  return CELL_COLORS[i % CELL_COLORS.length];
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function CSSLayoutBuilderPage() {
  const [tab, setTab] = useState<Tab>("grid");
  const [copiedGrid, setCopiedGrid] = useState(false);
  const [copiedFlex, setCopiedFlex] = useState(false);

  /* -- Grid State -- */
  const [gridColumns, setGridColumns] = useState<GridColumn[]>([
    { size: "1fr" },
    { size: "1fr" },
    { size: "1fr" },
  ]);
  const [gridRows, setGridRows] = useState<GridRow[]>([
    { size: "1fr" },
    { size: "1fr" },
  ]);
  const [gridGap, setGridGap] = useState(8);
  const [gridColumnGap, setGridColumnGap] = useState(8);
  const [gridRowGap, setGridRowGap] = useState(8);
  const [gridAreas, setGridAreas] = useState<string[][]>(() =>
    Array.from({ length: 2 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => ``)
    )
  );
  const [gridChildren, setGridChildren] = useState<GridChildItem[]>([]);
  const [areaSelectStart, setAreaSelectStart] = useState<{ r: number; c: number } | null>(null);
  const [areaSelectEnd, setAreaSelectEnd] = useState<{ r: number; c: number } | null>(null);
  const [pendingAreaName, setPendingAreaName] = useState("");
  const [showAreaNaming, setShowAreaNaming] = useState(false);

  /* -- Flexbox State -- */
  const [flexDirection, setFlexDirection] = useState("row");
  const [flexWrap, setFlexWrap] = useState("nowrap");
  const [justifyContent, setJustifyContent] = useState("flex-start");
  const [alignItems, setAlignItems] = useState("stretch");
  const [alignContent, setAlignContent] = useState("stretch");
  const [flexGap, setFlexGap] = useState(8);
  const [flexChildren, setFlexChildren] = useState<FlexChild[]>([
    { id: uid(), name: "Item 1", color: CELL_COLORS[0], flexGrow: 0, flexShrink: 1, flexBasis: "auto", alignSelf: "auto", order: 0 },
    { id: uid(), name: "Item 2", color: CELL_COLORS[1], flexGrow: 0, flexShrink: 1, flexBasis: "auto", alignSelf: "auto", order: 0 },
    { id: uid(), name: "Item 3", color: CELL_COLORS[2], flexGrow: 0, flexShrink: 1, flexBasis: "auto", alignSelf: "auto", order: 0 },
  ]);

  /* ---------------------------------------------------------------- */
  /*  Grid helpers                                                      */
  /* ---------------------------------------------------------------- */

  const syncAreasToSize = useCallback(
    (rows: number, cols: number, prev: string[][]) => {
      return Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (prev[r]?.[c] ?? ""))
      );
    },
    []
  );

  const addGridColumn = useCallback(() => {
    setGridColumns((prev) => [...prev, { size: "1fr" }]);
    setGridAreas((prev) => syncAreasToSize(gridRows.length, gridColumns.length + 1, prev));
  }, [gridRows.length, gridColumns.length, syncAreasToSize]);

  const removeGridColumn = useCallback(
    (i: number) => {
      if (gridColumns.length <= 1) return;
      setGridColumns((prev) => prev.filter((_, idx) => idx !== i));
      setGridAreas((prev) => syncAreasToSize(gridRows.length, gridColumns.length - 1, prev.map((row) => row.filter((_, idx) => idx !== i))));
    },
    [gridColumns.length, gridRows.length, syncAreasToSize]
  );

  const addGridRow = useCallback(() => {
    setGridRows((prev) => [...prev, { size: "1fr" }]);
    setGridAreas((prev) => syncAreasToSize(gridRows.length + 1, gridColumns.length, prev));
  }, [gridRows.length, gridColumns.length, syncAreasToSize]);

  const removeGridRow = useCallback(
    (i: number) => {
      if (gridRows.length <= 1) return;
      setGridRows((prev) => prev.filter((_, idx) => idx !== i));
      setGridAreas((prev) => syncAreasToSize(gridRows.length - 1, gridColumns.length, prev.filter((_, idx) => idx !== i)));
    },
    [gridRows.length, gridColumns.length, syncAreasToSize]
  );

  const updateColumnSize = useCallback((i: number, size: string) => {
    setGridColumns((prev) => prev.map((col, idx) => (idx === i ? { ...col, size } : col)));
  }, []);

  const updateRowSize = useCallback((i: number, size: string) => {
    setGridRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, size } : row)));
  }, []);

  /* -- Area selection via drag -- */
  const handleCellMouseDown = useCallback((r: number, c: number) => {
    setAreaSelectStart({ r, c });
    setAreaSelectEnd({ r, c });
    setShowAreaNaming(false);
  }, []);

  const handleCellMouseEnter = useCallback(
    (r: number, c: number) => {
      if (areaSelectStart) {
        setAreaSelectEnd({ r, c });
      }
    },
    [areaSelectStart]
  );

  const handleCellMouseUp = useCallback(() => {
    if (areaSelectStart && areaSelectEnd) {
      setShowAreaNaming(true);
    }
  }, [areaSelectStart, areaSelectEnd]);

  const applyAreaName = useCallback(() => {
    if (!areaSelectStart || !areaSelectEnd || !pendingAreaName.trim()) return;
    const rMin = Math.min(areaSelectStart.r, areaSelectEnd.r);
    const rMax = Math.max(areaSelectStart.r, areaSelectEnd.r);
    const cMin = Math.min(areaSelectStart.c, areaSelectEnd.c);
    const cMax = Math.max(areaSelectStart.c, areaSelectEnd.c);
    setGridAreas((prev) => {
      const next = prev.map((row) => [...row]);
      for (let r = rMin; r <= rMax; r++) {
        for (let c = cMin; c <= cMax; c++) {
          next[r][c] = pendingAreaName.trim();
        }
      }
      return next;
    });
    setAreaSelectStart(null);
    setAreaSelectEnd(null);
    setPendingAreaName("");
    setShowAreaNaming(false);
  }, [areaSelectStart, areaSelectEnd, pendingAreaName]);

  const clearAreas = useCallback(() => {
    setGridAreas((prev) => prev.map((row) => row.map(() => "")));
    setAreaSelectStart(null);
    setAreaSelectEnd(null);
    setShowAreaNaming(false);
  }, []);

  const isCellSelected = useCallback(
    (r: number, c: number) => {
      if (!areaSelectStart || !areaSelectEnd) return false;
      const rMin = Math.min(areaSelectStart.r, areaSelectEnd.r);
      const rMax = Math.max(areaSelectStart.r, areaSelectEnd.r);
      const cMin = Math.min(areaSelectStart.c, areaSelectEnd.c);
      const cMax = Math.max(areaSelectStart.c, areaSelectEnd.c);
      return r >= rMin && r <= rMax && c >= cMin && c <= cMax;
    },
    [areaSelectStart, areaSelectEnd]
  );

  /* -- Grid child items -- */
  const addGridChild = useCallback(() => {
    const idx = gridChildren.length;
    setGridChildren((prev) => [
      ...prev,
      {
        id: uid(),
        name: `Child ${idx + 1}`,
        color: colorForIndex(idx),
        placementMode: "manual",
        colStart: 1,
        colEnd: 2,
        rowStart: 1,
        rowEnd: 2,
        areaName: "",
      },
    ]);
  }, [gridChildren.length]);

  const updateGridChild = useCallback((id: string, patch: Partial<GridChildItem>) => {
    setGridChildren((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeGridChild = useCallback((id: string) => {
    setGridChildren((prev) => prev.filter((c) => c.id !== id));
  }, []);

  /* -- Grid presets -- */
  const applyGridPreset = useCallback(
    (preset: GridPreset) => {
      setGridColumns(preset.columns);
      setGridRows(preset.rows);
      setGridAreas(preset.areas);
      setGridGap(preset.gap);
      setGridColumnGap(preset.columnGap);
      setGridRowGap(preset.rowGap);
      setGridChildren([]);
      setAreaSelectStart(null);
      setAreaSelectEnd(null);
      setShowAreaNaming(false);
    },
    []
  );

  /* -- Grid CSS output -- */
  const hasAreas = useMemo(() => gridAreas.some((row) => row.some((a) => a !== "")), [gridAreas]);

  const gridCss = useMemo(() => {
    const lines: string[] = [".container {", "  display: grid;"];
    lines.push(`  grid-template-columns: ${gridColumns.map((c) => c.size).join(" ")};`);
    lines.push(`  grid-template-rows: ${gridRows.map((r) => r.size).join(" ")};`);
    if (hasAreas) {
      const areaLines = gridAreas.map((row) => `"${row.map((a) => a || ".").join(" ")}"`);
      lines.push(`  grid-template-areas:\n    ${areaLines.join("\n    ")};`);
    }
    if (gridColumnGap === gridRowGap) {
      lines.push(`  gap: ${gridGap}px;`);
    } else {
      lines.push(`  row-gap: ${gridRowGap}px;`);
      lines.push(`  column-gap: ${gridColumnGap}px;`);
    }
    lines.push("}");

    if (gridChildren.length > 0) {
      gridChildren.forEach((child) => {
        lines.push("");
        lines.push(`.${child.name.replace(/\s+/g, "-").toLowerCase()} {`);
        if (child.placementMode === "area" && child.areaName) {
          lines.push(`  grid-area: ${child.areaName};`);
        } else {
          lines.push(`  grid-column: ${child.colStart} / ${child.colEnd};`);
          lines.push(`  grid-row: ${child.rowStart} / ${child.rowEnd};`);
        }
        lines.push("}");
      });
    }
    return lines.join("\n");
  }, [gridColumns, gridRows, gridAreas, gridGap, gridColumnGap, gridRowGap, hasAreas, gridChildren]);

  /* ---------------------------------------------------------------- */
  /*  Flexbox CSS output                                                */
  /* ---------------------------------------------------------------- */

  const flexCss = useMemo(() => {
    const lines: string[] = [".container {", "  display: flex;"];
    lines.push(`  flex-direction: ${flexDirection};`);
    lines.push(`  flex-wrap: ${flexWrap};`);
    lines.push(`  justify-content: ${justifyContent};`);
    lines.push(`  align-items: ${alignItems};`);
    if (flexWrap === "wrap") {
      lines.push(`  align-content: ${alignContent};`);
    }
    lines.push(`  gap: ${flexGap}px;`);
    lines.push("}");

    flexChildren.forEach((child) => {
      lines.push("");
      lines.push(`.${child.name.replace(/\s+/g, "-").toLowerCase()} {`);
      lines.push(`  flex-grow: ${child.flexGrow};`);
      lines.push(`  flex-shrink: ${child.flexShrink};`);
      lines.push(`  flex-basis: ${child.flexBasis};`);
      if (child.alignSelf !== "auto") {
        lines.push(`  align-self: ${child.alignSelf};`);
      }
      if (child.order !== 0) {
        lines.push(`  order: ${child.order};`);
      }
      lines.push("}");
    });
    return lines.join("\n");
  }, [flexDirection, flexWrap, justifyContent, alignItems, alignContent, flexGap, flexChildren]);

  /* ---------------------------------------------------------------- */
  /*  Copy handler                                                      */
  /* ---------------------------------------------------------------- */

  const copyToClipboard = useCallback(
    (text: string, which: "grid" | "flex") => {
      navigator.clipboard.writeText(text).then(() => {
        if (which === "grid") {
          setCopiedGrid(true);
          setTimeout(() => setCopiedGrid(false), 1500);
        } else {
          setCopiedFlex(true);
          setTimeout(() => setCopiedFlex(false), 1500);
        }
      });
    },
    []
  );

  /* ---------------------------------------------------------------- */
  /*  Unique area names for coloring                                    */
  /* ---------------------------------------------------------------- */

  const uniqueAreaNames = useMemo(() => {
    const set = new Set<string>();
    gridAreas.forEach((row) => row.forEach((a) => { if (a) set.add(a); }));
    return Array.from(set);
  }, [gridAreas]);

  const areaColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    uniqueAreaNames.forEach((name, i) => {
      map[name] = CELL_COLORS[i % CELL_COLORS.length];
    });
    return map;
  }, [uniqueAreaNames]);

  /* ---------------------------------------------------------------- */
  /*  Flexbox child helpers                                             */
  /* ---------------------------------------------------------------- */

  const addFlexChild = useCallback(() => {
    const idx = flexChildren.length;
    setFlexChildren((prev) => [
      ...prev,
      {
        id: uid(),
        name: `Item ${idx + 1}`,
        color: colorForIndex(idx),
        flexGrow: 0,
        flexShrink: 1,
        flexBasis: "auto",
        alignSelf: "auto",
        order: 0,
      },
    ]);
  }, [flexChildren.length]);

  const updateFlexChild = useCallback((id: string, patch: Partial<FlexChild>) => {
    setFlexChildren((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeFlexChild = useCallback((id: string) => {
    setFlexChildren((prev) => prev.filter((c) => c.id !== id));
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-2 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Link href="/" className="p-1 rounded hover:opacity-70 transition-opacity" aria-label="Back">
          <ArrowLeft size={18} style={{ color: "var(--muted)" }} />
        </Link>
        <LayoutGrid size={18} style={{ color: "var(--accent)" }} />
        <h1 className="text-sm font-semibold whitespace-nowrap">CSS Layout Builder</h1>
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={() => setTab("grid")}
            className="px-3 py-1 text-xs font-medium rounded transition-colors"
            style={{
              background: tab === "grid" ? "var(--accent)" : "transparent",
              color: tab === "grid" ? "#fff" : "var(--muted)",
            }}
          >
            <span className="flex items-center gap-1.5">
              <Grid3X3 size={13} />
              Grid
            </span>
          </button>
          <button
            onClick={() => setTab("flexbox")}
            className="px-3 py-1 text-xs font-medium rounded transition-colors"
            style={{
              background: tab === "flexbox" ? "var(--accent)" : "transparent",
              color: tab === "flexbox" ? "#fff" : "var(--muted)",
            }}
          >
            <span className="flex items-center gap-1.5">
              <Columns3 size={13} />
              Flexbox
            </span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* ============== LEFT: Preview ============== */}
        <div className="flex-[3] flex flex-col overflow-hidden border-r" style={{ borderColor: "var(--border)" }}>
          <div className="px-3 py-2 border-b flex items-center gap-2 shrink-0" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              Live Preview
            </span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {tab === "grid" ? (
              <GridPreview
                columns={gridColumns}
                rows={gridRows}
                areas={gridAreas}
                gap={gridGap}
                columnGap={gridColumnGap}
                rowGap={gridRowGap}
                children_={gridChildren}
                areaColorMap={areaColorMap}
                hasAreas={hasAreas}
                onCellMouseDown={handleCellMouseDown}
                onCellMouseEnter={handleCellMouseEnter}
                onCellMouseUp={handleCellMouseUp}
                isCellSelected={isCellSelected}
                showAreaNaming={showAreaNaming}
                pendingAreaName={pendingAreaName}
                onPendingAreaNameChange={setPendingAreaName}
                onApplyAreaName={applyAreaName}
              />
            ) : (
              <FlexPreview
                direction={flexDirection}
                wrap={flexWrap}
                justifyContent={justifyContent}
                alignItems={alignItems}
                alignContent={alignContent}
                gap={flexGap}
                children_={flexChildren}
              />
            )}
          </div>
        </div>

        {/* ============== RIGHT: Settings ============== */}
        <div className="flex-[2] flex flex-col overflow-hidden" style={{ background: "var(--surface)" }}>
          <div className="flex-1 overflow-y-auto">
            {tab === "grid" ? (
              <GridSettings
                columns={gridColumns}
                rows={gridRows}
                gap={gridGap}
                columnGap={gridColumnGap}
                rowGap={gridRowGap}
                gridAreas={gridAreas}
                gridChildren={gridChildren}
                hasAreas={hasAreas}
                areaColorMap={areaColorMap}
                uniqueAreaNames={uniqueAreaNames}
                onAddColumn={addGridColumn}
                onRemoveColumn={removeGridColumn}
                onUpdateColumnSize={updateColumnSize}
                onAddRow={addGridRow}
                onRemoveRow={removeGridRow}
                onUpdateRowSize={updateRowSize}
                onGapChange={setGridGap}
                onColumnGapChange={setGridColumnGap}
                onRowGapChange={setGridRowGap}
                onClearAreas={clearAreas}
                onAddChild={addGridChild}
                onUpdateChild={updateGridChild}
                onRemoveChild={removeGridChild}
                onApplyPreset={applyGridPreset}
                css={gridCss}
                copied={copiedGrid}
                onCopy={() => copyToClipboard(gridCss, "grid")}
              />
            ) : (
              <FlexSettings
                direction={flexDirection}
                wrap={flexWrap}
                justifyContent={justifyContent}
                alignItems={alignItems}
                alignContent={alignContent}
                gap={flexGap}
                children_={flexChildren}
                onDirectionChange={setFlexDirection}
                onWrapChange={setFlexWrap}
                onJustifyContentChange={setJustifyContent}
                onAlignItemsChange={setAlignItems}
                onAlignContentChange={setAlignContent}
                onGapChange={setFlexGap}
                onAddChild={addFlexChild}
                onUpdateChild={updateFlexChild}
                onRemoveChild={removeFlexChild}
                css={flexCss}
                copied={copiedFlex}
                onCopy={() => copyToClipboard(flexCss, "flex")}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Grid Preview                                                        */
/* ================================================================== */

function GridPreview({
  columns,
  rows,
  areas,
  gap,
  columnGap,
  rowGap,
  children_,
  areaColorMap,
  hasAreas,
  onCellMouseDown,
  onCellMouseEnter,
  onCellMouseUp,
  isCellSelected,
  showAreaNaming,
  pendingAreaName,
  onPendingAreaNameChange,
  onApplyAreaName,
}: {
  columns: GridColumn[];
  rows: GridRow[];
  areas: string[][];
  gap: number;
  columnGap: number;
  rowGap: number;
  children_: GridChildItem[];
  areaColorMap: Record<string, string>;
  hasAreas: boolean;
  onCellMouseDown: (r: number, c: number) => void;
  onCellMouseEnter: (r: number, c: number) => void;
  onCellMouseUp: () => void;
  isCellSelected: (r: number, c: number) => boolean;
  showAreaNaming: boolean;
  pendingAreaName: string;
  onPendingAreaNameChange: (v: string) => void;
  onApplyAreaName: () => void;
}) {
  /* Determine what to render: if there are grid children, show them; otherwise show the area grid cells */
  const gridContainerStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: columns.map((c) => c.size).join(" "),
    gridTemplateRows: rows.map((r) => r.size).join(" "),
    columnGap: `${columnGap}px`,
    rowGap: `${rowGap}px`,
    width: "100%",
    height: "100%",
    minHeight: 300,
  };

  if (hasAreas) {
    gridContainerStyle.gridTemplateAreas = areas.map((row) => `"${row.map((a) => a || ".").join(" ")}"`).join(" ");
  }

  /* Collect rendered area names to avoid duplicates */
  const renderedAreas = new Set<string>();

  return (
    <div className="relative w-full h-full select-none" onMouseUp={onCellMouseUp}>
      <div style={gridContainerStyle}>
        {children_.length > 0
          ? children_.map((child) => {
              const style: React.CSSProperties = {
                background: child.color + "22",
                border: `2px solid ${child.color}`,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
                fontSize: 12,
                fontWeight: 600,
                color: child.color,
                minHeight: 40,
              };
              if (child.placementMode === "area" && child.areaName) {
                style.gridArea = child.areaName;
              } else {
                style.gridColumn = `${child.colStart} / ${child.colEnd}`;
                style.gridRow = `${child.rowStart} / ${child.rowEnd}`;
              }
              return (
                <div key={child.id} style={style}>
                  {child.name}
                </div>
              );
            })
          : areas.map((row, r) =>
              row.map((areaName, c) => {
                if (hasAreas && areaName && renderedAreas.has(areaName)) {
                  return null;
                }
                if (hasAreas && areaName) {
                  renderedAreas.add(areaName);
                }
                const selected = isCellSelected(r, c);
                const color = areaName ? areaColorMap[areaName] : undefined;
                return (
                  <div
                    key={`${r}-${c}`}
                    onMouseDown={() => onCellMouseDown(r, c)}
                    onMouseEnter={() => onCellMouseEnter(r, c)}
                    className="rounded cursor-crosshair flex items-center justify-center text-xs font-medium transition-colors"
                    style={{
                      ...(hasAreas && areaName ? { gridArea: areaName } : {}),
                      background: selected
                        ? "var(--accent)"
                        : color
                        ? color + "22"
                        : "var(--surface-hover)",
                      border: selected
                        ? "2px solid var(--accent)"
                        : color
                        ? `2px solid ${color}`
                        : "2px dashed var(--border)",
                      color: selected ? "#fff" : color || "var(--muted)",
                      minHeight: 40,
                      padding: 4,
                      userSelect: "none",
                    }}
                  >
                    {areaName || `${r + 1}:${c + 1}`}
                  </div>
                );
              })
            )}
      </div>

      {/* Area naming popover */}
      {showAreaNaming && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border z-10"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Area name:
          </span>
          <input
            type="text"
            value={pendingAreaName}
            onChange={(e) => onPendingAreaNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onApplyAreaName();
            }}
            className="px-2 py-1 text-xs rounded border outline-none"
            style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
            placeholder="e.g. header"
            autoFocus
          />
          <button
            onClick={onApplyAreaName}
            className="px-2 py-1 text-xs rounded font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Grid Settings                                                       */
/* ================================================================== */

function GridSettings({
  columns,
  rows,
  gap,
  columnGap,
  rowGap,
  gridAreas,
  gridChildren,
  hasAreas,
  areaColorMap,
  uniqueAreaNames,
  onAddColumn,
  onRemoveColumn,
  onUpdateColumnSize,
  onAddRow,
  onRemoveRow,
  onUpdateRowSize,
  onGapChange,
  onColumnGapChange,
  onRowGapChange,
  onClearAreas,
  onAddChild,
  onUpdateChild,
  onRemoveChild,
  onApplyPreset,
  css,
  copied,
  onCopy,
}: {
  columns: GridColumn[];
  rows: GridRow[];
  gap: number;
  columnGap: number;
  rowGap: number;
  gridAreas: string[][];
  gridChildren: GridChildItem[];
  hasAreas: boolean;
  areaColorMap: Record<string, string>;
  uniqueAreaNames: string[];
  onAddColumn: () => void;
  onRemoveColumn: (i: number) => void;
  onUpdateColumnSize: (i: number, size: string) => void;
  onAddRow: () => void;
  onRemoveRow: (i: number) => void;
  onUpdateRowSize: (i: number, size: string) => void;
  onGapChange: (v: number) => void;
  onColumnGapChange: (v: number) => void;
  onRowGapChange: (v: number) => void;
  onClearAreas: () => void;
  onAddChild: () => void;
  onUpdateChild: (id: string, patch: Partial<GridChildItem>) => void;
  onRemoveChild: (id: string) => void;
  onApplyPreset: (preset: GridPreset) => void;
  css: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const [linkGap, setLinkGap] = useState(true);

  const handleGapChange = useCallback(
    (v: number) => {
      if (linkGap) {
        onGapChange(v);
        onColumnGapChange(v);
        onRowGapChange(v);
      }
    },
    [linkGap, onGapChange, onColumnGapChange, onRowGapChange]
  );

  return (
    <div className="flex flex-col gap-0">
      {/* Presets */}
      <Section title="Presets">
        <div className="flex flex-wrap gap-1.5">
          {GRID_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onApplyPreset(preset)}
              className="px-2.5 py-1 text-xs rounded border transition-colors hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--background)" }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Columns */}
      <Section title="Columns" action={<IconBtn icon={<Plus size={13} />} onClick={onAddColumn} label="Add column" />}>
        <div className="flex flex-col gap-1.5">
          {columns.map((col, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs w-5 shrink-0" style={{ color: "var(--muted)" }}>
                {i + 1}
              </span>
              <input
                type="text"
                value={col.size}
                onChange={(e) => onUpdateColumnSize(i, e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded border outline-none"
                style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
              />
              {columns.length > 1 && (
                <IconBtn icon={<Minus size={12} />} onClick={() => onRemoveColumn(i)} label="Remove column" />
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Rows */}
      <Section title="Rows" action={<IconBtn icon={<Plus size={13} />} onClick={onAddRow} label="Add row" />}>
        <div className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs w-5 shrink-0" style={{ color: "var(--muted)" }}>
                {i + 1}
              </span>
              <input
                type="text"
                value={row.size}
                onChange={(e) => onUpdateRowSize(i, e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded border outline-none"
                style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--foreground)" }}
              />
              {rows.length > 1 && (
                <IconBtn icon={<Minus size={12} />} onClick={() => onRemoveRow(i)} label="Remove row" />
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Gap */}
      <Section title="Gap">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs w-12 shrink-0" style={{ color: "var(--muted)" }}>
              {linkGap ? "Gap" : "Col"}
            </label>
            <input
              type="range"
              min={0}
              max={40}
              value={linkGap ? gap : columnGap}
              onChange={(e) =>
                linkGap ? handleGapChange(+e.target.value) : onColumnGapChange(+e.target.value)
              }
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="text-xs w-10 text-right tabular-nums" style={{ color: "var(--muted)" }}>
              {linkGap ? gap : columnGap}px
            </span>
          </div>
          {!linkGap && (
            <div className="flex items-center gap-2">
              <label className="text-xs w-12 shrink-0" style={{ color: "var(--muted)" }}>
                Row
              </label>
              <input
                type="range"
                min={0}
                max={40}
                value={rowGap}
                onChange={(e) => onRowGapChange(+e.target.value)}
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="text-xs w-10 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                {rowGap}px
              </span>
            </div>
          )}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--muted)" }}>
            <input
              type="checkbox"
              checked={linkGap}
              onChange={(e) => {
                setLinkGap(e.target.checked);
                if (e.target.checked) {
                  onColumnGapChange(gap);
                  onRowGapChange(gap);
                }
              }}
              className="accent-[var(--accent)]"
            />
            Link row &amp; column gap
          </label>
        </div>
      </Section>

      {/* Areas */}
      <Section
        title="Grid Areas"
        action={
          hasAreas ? (
            <button onClick={onClearAreas} className="text-xs flex items-center gap-1 hover:opacity-70" style={{ color: "var(--muted)" }}>
              <RotateCcw size={11} /> Clear
            </button>
          ) : undefined
        }
      >
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          Click and drag cells in the preview to select a region, then type an area name.
        </p>
        {uniqueAreaNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {uniqueAreaNames.map((name) => (
              <span
                key={name}
                className="px-2 py-0.5 text-xs rounded font-medium"
                style={{ background: areaColorMap[name] + "22", color: areaColorMap[name], border: `1px solid ${areaColorMap[name]}44` }}
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Grid Children */}
      <Section title="Child Items" action={<IconBtn icon={<Plus size={13} />} onClick={onAddChild} label="Add child" />}>
        {gridChildren.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            No child items. Add one to position it on the grid.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {gridChildren.map((child) => (
              <div
                key={child.id}
                className="p-2 rounded border flex flex-col gap-2"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: child.color }} />
                  <input
                    type="text"
                    value={child.name}
                    onChange={(e) => onUpdateChild(child.id, { name: e.target.value })}
                    className="flex-1 px-1.5 py-0.5 text-xs rounded border outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                  />
                  <IconBtn icon={<Trash2 size={12} />} onClick={() => onRemoveChild(child.id)} label="Remove" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: "var(--muted)" }}>
                    <input
                      type="radio"
                      name={`placement-${child.id}`}
                      checked={child.placementMode === "manual"}
                      onChange={() => onUpdateChild(child.id, { placementMode: "manual" })}
                      className="accent-[var(--accent)]"
                    />
                    Manual
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: "var(--muted)" }}>
                    <input
                      type="radio"
                      name={`placement-${child.id}`}
                      checked={child.placementMode === "area"}
                      onChange={() => onUpdateChild(child.id, { placementMode: "area" })}
                      className="accent-[var(--accent)]"
                    />
                    Area
                  </label>
                </div>
                {child.placementMode === "manual" ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <MiniInput label="Col start" value={child.colStart} onChange={(v) => onUpdateChild(child.id, { colStart: v })} />
                    <MiniInput label="Col end" value={child.colEnd} onChange={(v) => onUpdateChild(child.id, { colEnd: v })} />
                    <MiniInput label="Row start" value={child.rowStart} onChange={(v) => onUpdateChild(child.id, { rowStart: v })} />
                    <MiniInput label="Row end" value={child.rowEnd} onChange={(v) => onUpdateChild(child.id, { rowEnd: v })} />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={child.areaName}
                    onChange={(e) => onUpdateChild(child.id, { areaName: e.target.value })}
                    className="px-2 py-1 text-xs rounded border outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                    placeholder="Area name"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* CSS Output */}
      <CSSOutput css={css} copied={copied} onCopy={onCopy} />
    </div>
  );
}

/* ================================================================== */
/*  Flex Preview                                                        */
/* ================================================================== */

function FlexPreview({
  direction,
  wrap,
  justifyContent,
  alignItems,
  alignContent,
  gap,
  children_,
}: {
  direction: string;
  wrap: string;
  justifyContent: string;
  alignItems: string;
  alignContent: string;
  gap: number;
  children_: FlexChild[];
}) {
  const sorted = useMemo(() => [...children_].sort((a, b) => a.order - b.order), [children_]);

  return (
    <div
      className="w-full h-full rounded border"
      style={{
        display: "flex",
        flexDirection: direction as React.CSSProperties["flexDirection"],
        flexWrap: wrap as React.CSSProperties["flexWrap"],
        justifyContent,
        alignItems,
        alignContent: wrap === "wrap" ? alignContent : undefined,
        gap: `${gap}px`,
        borderColor: "var(--border)",
        minHeight: 300,
        padding: 8,
      }}
    >
      {sorted.map((child) => (
        <div
          key={child.id}
          style={{
            flexGrow: child.flexGrow,
            flexShrink: child.flexShrink,
            flexBasis: child.flexBasis,
            alignSelf: child.alignSelf !== "auto" ? (child.alignSelf as React.CSSProperties["alignSelf"]) : undefined,
            background: child.color + "22",
            border: `2px solid ${child.color}`,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 16px",
            fontSize: 12,
            fontWeight: 600,
            color: child.color,
            minWidth: 60,
            minHeight: 40,
          }}
        >
          {child.name}
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Flex Settings                                                       */
/* ================================================================== */

function FlexSettings({
  direction,
  wrap,
  justifyContent,
  alignItems,
  alignContent,
  gap,
  children_,
  onDirectionChange,
  onWrapChange,
  onJustifyContentChange,
  onAlignItemsChange,
  onAlignContentChange,
  onGapChange,
  onAddChild,
  onUpdateChild,
  onRemoveChild,
  css,
  copied,
  onCopy,
}: {
  direction: string;
  wrap: string;
  justifyContent: string;
  alignItems: string;
  alignContent: string;
  gap: number;
  children_: FlexChild[];
  onDirectionChange: (v: string) => void;
  onWrapChange: (v: string) => void;
  onJustifyContentChange: (v: string) => void;
  onAlignItemsChange: (v: string) => void;
  onAlignContentChange: (v: string) => void;
  onGapChange: (v: number) => void;
  onAddChild: () => void;
  onUpdateChild: (id: string, patch: Partial<FlexChild>) => void;
  onRemoveChild: (id: string) => void;
  css: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-0">
      {/* Direction */}
      <Section title="Direction">
        <ToggleGroup
          options={[
            { value: "row", label: "Row", icon: <ArrowRight size={13} /> },
            { value: "row-reverse", label: "Row Rev", icon: <ArrowLeft size={13} /> },
            { value: "column", label: "Column", icon: <ArrowDown size={13} /> },
            { value: "column-reverse", label: "Col Rev", icon: <ArrowLeft size={13} style={{ transform: "rotate(90deg)" }} /> },
          ]}
          value={direction}
          onChange={onDirectionChange}
        />
      </Section>

      {/* Wrap */}
      <Section title="Wrap">
        <ToggleGroup
          options={[
            { value: "nowrap", label: "No Wrap" },
            { value: "wrap", label: "Wrap", icon: <WrapText size={13} /> },
            { value: "wrap-reverse", label: "Wrap Rev" },
          ]}
          value={wrap}
          onChange={onWrapChange}
        />
      </Section>

      {/* Justify Content */}
      <Section title="Justify Content">
        <ToggleGroup
          options={JUSTIFY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={justifyContent}
          onChange={onJustifyContentChange}
        />
      </Section>

      {/* Align Items */}
      <Section title="Align Items">
        <ToggleGroup
          options={ALIGN_ITEMS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={alignItems}
          onChange={onAlignItemsChange}
        />
      </Section>

      {/* Align Content */}
      {wrap === "wrap" && (
        <Section title="Align Content">
          <ToggleGroup
            options={ALIGN_CONTENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={alignContent}
            onChange={onAlignContentChange}
          />
        </Section>
      )}

      {/* Gap */}
      <Section title="Gap">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={40}
            value={gap}
            onChange={(e) => onGapChange(+e.target.value)}
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="text-xs w-10 text-right tabular-nums" style={{ color: "var(--muted)" }}>
            {gap}px
          </span>
        </div>
      </Section>

      {/* Children */}
      <Section title="Children" action={<IconBtn icon={<Plus size={13} />} onClick={onAddChild} label="Add child" />}>
        {children_.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            No children. Add one to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {children_.map((child) => (
              <div
                key={child.id}
                className="p-2 rounded border flex flex-col gap-2"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: child.color }} />
                  <input
                    type="text"
                    value={child.name}
                    onChange={(e) => onUpdateChild(child.id, { name: e.target.value })}
                    className="flex-1 px-1.5 py-0.5 text-xs rounded border outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                  />
                  <IconBtn icon={<Trash2 size={12} />} onClick={() => onRemoveChild(child.id)} label="Remove" />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: "var(--muted)" }}>
                      Grow
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={child.flexGrow}
                      onChange={(e) => onUpdateChild(child.id, { flexGrow: +e.target.value })}
                      className="w-full px-1.5 py-0.5 text-xs rounded border outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: "var(--muted)" }}>
                      Shrink
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={child.flexShrink}
                      onChange={(e) => onUpdateChild(child.id, { flexShrink: +e.target.value })}
                      className="w-full px-1.5 py-0.5 text-xs rounded border outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: "var(--muted)" }}>
                      Basis
                    </label>
                    <input
                      type="text"
                      value={child.flexBasis}
                      onChange={(e) => onUpdateChild(child.id, { flexBasis: e.target.value })}
                      className="w-full px-1.5 py-0.5 text-xs rounded border outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: "var(--muted)" }}>
                      Align Self
                    </label>
                    <select
                      value={child.alignSelf}
                      onChange={(e) => onUpdateChild(child.id, { alignSelf: e.target.value })}
                      className="w-full px-1.5 py-0.5 text-xs rounded border outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                    >
                      {ALIGN_SELF_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] block mb-0.5" style={{ color: "var(--muted)" }}>
                      Order
                    </label>
                    <input
                      type="number"
                      value={child.order}
                      onChange={(e) => onUpdateChild(child.id, { order: +e.target.value })}
                      className="w-full px-1.5 py-0.5 text-xs rounded border outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* CSS Output */}
      <CSSOutput css={css} copied={copied} onCopy={onCopy} />
    </div>
  );
}

/* ================================================================== */
/*  Shared UI Components                                                */
/* ================================================================== */

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-3 py-3 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

function IconBtn({ icon, onClick, label }: { icon: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="p-1 rounded hover:opacity-70 transition-opacity"
      style={{ color: "var(--muted)" }}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors"
          style={{
            borderColor: value === opt.value ? "var(--accent)" : "var(--border)",
            background: value === opt.value ? "var(--accent)" : "var(--background)",
            color: value === opt.value ? "#fff" : "var(--muted)",
          }}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MiniInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[10px] block mb-0.5" style={{ color: "var(--muted)" }}>
        {label}
      </label>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full px-1.5 py-0.5 text-xs rounded border outline-none"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
      />
    </div>
  );
}

function CSSOutput({ css, copied, onCopy }: { css: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
          CSS Output
        </span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors"
          style={{
            background: copied ? "#10b98122" : "var(--background)",
            color: copied ? "#10b981" : "var(--muted)",
            border: `1px solid ${copied ? "#10b98144" : "var(--border)"}`,
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="p-3 rounded border text-xs leading-relaxed overflow-auto max-h-56"
        style={{
          borderColor: "var(--border)",
          background: "var(--background)",
          color: "var(--foreground)",
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
        }}
      >
        {css}
      </pre>
    </div>
  );
}
