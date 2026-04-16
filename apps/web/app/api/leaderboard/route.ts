import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 15;

export async function GET() {
  const gameServerUrl = process.env.GAME_SERVER_URL || "http://localhost:3001";
  const secret = process.env.GAME_SERVER_INTERNAL_SECRET || "dev-secret";

  try {
    const res = await fetch(`${gameServerUrl}/internal/leaderboard`, {
      headers: { "x-internal-secret": secret },
      next: { revalidate: 15 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Leaderboard fetch failed: " + res.status, code: "FETCH_ERROR" }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({
      agents: [],
      _error: "Game server unreachable: " + (err as Error).message
    });
  }
}
