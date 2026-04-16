import { MapTile, TileType } from "./types";

const MAP_SIZE = 32;

export interface OreRock {
  x: number;
  y: number;
  oreAmount: number; // in ETH
}

function gaussianRandom(mean: number, std: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function pickOreAmount(): number {
  const roll = Math.random();
  if (roll < 0.70) {
    // 0.001 - 0.005 ETH
    return 0.001 + Math.random() * 0.004;
  } else if (roll < 0.95) {
    // 0.005 - 0.02 ETH
    return 0.005 + Math.random() * 0.015;
  } else {
    // jackpot: 0.02 - 0.1 ETH
    return 0.02 + Math.random() * 0.08;
  }
}

export function generateMap(seed?: number): { grid: MapTile[][]; oreRocks: OreRock[] } {
  // Initialize grid
  const grid: MapTile[][] = Array.from({ length: MAP_SIZE }, () =>
    Array.from({ length: MAP_SIZE }, () => ({ type: "rock" as TileType }))
  );

  const oreRocks: OreRock[] = [];
  const oreSet = new Set<string>();

  // Generate 4 ore clusters
  const clusterCount = 4;
  for (let c = 0; c < clusterCount; c++) {
    // Cluster center — weighted toward center for AGGRESSIVE strategy benefit
    const cx = clamp(Math.floor(gaussianRandom(MAP_SIZE / 2, MAP_SIZE / 4)), 2, MAP_SIZE - 3);
    const cy = clamp(Math.floor(gaussianRandom(MAP_SIZE / 2, MAP_SIZE / 4)), 2, MAP_SIZE - 3);

    // Each cluster seeds 3-7 ore rocks in a gaussian distribution
    const oreCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < oreCount; i++) {
      const ox = clamp(Math.round(gaussianRandom(cx, 2.5)), 0, MAP_SIZE - 1);
      const oy = clamp(Math.round(gaussianRandom(cy, 2.5)), 0, MAP_SIZE - 1);
      const key = `${ox},${oy}`;
      if (!oreSet.has(key)) {
        oreSet.add(key);
        const amount = pickOreAmount();
        oreRocks.push({ x: ox, y: oy, oreAmount: amount });
        grid[oy][ox] = {
          type: "rock",
          rock: { hasOre: true, oreAmount: amount, mined: false },
        };
      }
    }
  }

  // Mark non-ore rocks
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      if (!grid[y][x].rock) {
        grid[y][x] = {
          type: "rock",
          rock: { hasOre: false, oreAmount: 0, mined: false },
        };
      }
    }
  }

  return { grid, oreRocks };
}

export function gridToTileTypes(grid: MapTile[][]): TileType[][] {
  return grid.map(row => row.map(tile => tile.type));
}
