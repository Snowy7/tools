export interface SpriteInput {
  name: string;
  width: number;
  height: number;
}

export interface SpritePlacement extends SpriteInput {
  x: number;
  y: number;
}

export interface PackedSpriteSheet {
  width: number;
  height: number;
  columns: number;
  rows: number;
  sprites: SpritePlacement[];
}

export function packSprites(
  sprites: SpriteInput[],
  columns: number,
  padding: number,
): PackedSpriteSheet {
  const safeColumns = Math.max(1, columns);
  const rows = Math.max(1, Math.ceil(sprites.length / safeColumns));
  const cellWidth = Math.max(...sprites.map((sprite) => sprite.width), 1);
  const cellHeight = Math.max(...sprites.map((sprite) => sprite.height), 1);

  const placements = sprites.map((sprite, index) => {
    const column = index % safeColumns;
    const row = Math.floor(index / safeColumns);
    const x = column * (cellWidth + padding);
    const y = row * (cellHeight + padding);
    return { ...sprite, x, y };
  });

  return {
    width: safeColumns * cellWidth + Math.max(0, safeColumns - 1) * padding,
    height: rows * cellHeight + Math.max(0, rows - 1) * padding,
    columns: safeColumns,
    rows,
    sprites: placements,
  };
}

