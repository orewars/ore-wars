import { NextResponse } from "next/server";
import { getGameEngine } from "@/lib/game-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const engine = getGameEngine();
    const prizePool = await engine.getPrizePool();
    return NextResponse.json({
      activeAgents: engine.getAgents().filter(a => a.status === "ACTIVE").length,
      rocksRemaining: engine.getRocksRemaining(),
      prizePool,
      totalMined: engine.getTotalEthMined().toFixed(6),
      mapEpoch: engine.getMapEpoch(),
    });
  } catch (err) {
    return NextResponse.json({
      activeAgents: 0,
      rocksRemaining: 1024,
      prizePool: "0.000",
      totalMined: "0.000000",
      mapEpoch: 1,
      _error: (err as Error).message,
    });
  }
}
