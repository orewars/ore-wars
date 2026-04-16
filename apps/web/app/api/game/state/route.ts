import { NextResponse } from "next/server";
import { getGameEngine } from "@/lib/game-engine";

export const dynamic = "force-dynamic";

const CONTRACT = process.env.CONTRACT_ADDRESS || "0x7c9bDF3F3b4662371a86A6Cd7cabBb3Aa5451d40";
const RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const PRIZE_POOL_SELECTOR = "0x4d07554a";

async function getPrizePoolDirect(): Promise<string> {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: CONTRACT, data: PRIZE_POOL_SELECTOR }, "latest"],
        id: 1,
      }),
    });
    const data = await res.json();
    const hex = data.result || "0x0";
    const wei = BigInt(hex);
    return (Number(wei) / 1e18).toFixed(6);
  } catch {
    return "0.000";
  }
}

export async function GET() {
  try {
    const engine = getGameEngine();
    const prizePool = await getPrizePoolDirect();
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
