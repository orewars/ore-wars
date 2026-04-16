import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 10;

export async function GET() {
  const gameServerUrl = process.env.GAME_SERVER_URL || "http://localhost:3001";
  const secret = process.env.GAME_SERVER_INTERNAL_SECRET || "dev-secret";

  try {
    const res = await fetch(`${gameServerUrl}/internal/state`, {
      headers: { "x-internal-secret": secret },
      next: { revalidate: 10 },
    });

    if (!res.ok) {
      return NextResponse.json({
        error: "Game server returned error: " + res.status,
        code: "GAME_SERVER_ERROR"
      }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({
      activeAgents: data.activeAgents ?? 0,
      rocksRemaining: data.rocksRemaining ?? 1024,
      prizePool: data.prizePool ?? "0.000",
      totalMined: (data.totalEthMined ?? 0).toFixed(6),
      mapEpoch: data.mapEpoch ?? 1,
    });
  } catch (err) {
    // Return fallback if game server is down
    return NextResponse.json({
      activeAgents: 0,
      rocksRemaining: 1024,
      prizePool: "0.000",
      totalMined: "0.000000",
      mapEpoch: 1,
      _error: "Game server unreachable: " + (err as Error).message,
    });
  }
}
