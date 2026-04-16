import { NextResponse } from "next/server";
import { getGameEngine } from "@/lib/game-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const engine = getGameEngine();
  return NextResponse.json({
    tiles: engine.getMapTileTypes(),
    agents: engine.getAgents(),
    epoch: engine.getMapEpoch(),
  });
}
