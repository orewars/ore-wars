import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const gameServerUrl = process.env.GAME_SERVER_URL || "http://localhost:3001";
  const secret = process.env.GAME_SERVER_INTERNAL_SECRET || "dev-secret";

  try {
    const res = await fetch(`${gameServerUrl}/internal/map`, {
      headers: { "x-internal-secret": secret },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Game server error: " + res.status, code: "GAME_SERVER_ERROR" }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ error: "Game server unreachable: " + (err as Error).message, code: "UNREACHABLE" }, { status: 503 });
  }
}
