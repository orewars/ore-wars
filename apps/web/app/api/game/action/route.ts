import { NextRequest, NextResponse } from "next/server";
import { getGameEngine } from "@/lib/game-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const agentId = req.headers.get("x-agent-id") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!agentId) {
    return NextResponse.json({ error: "Missing agent ID in Authorization or X-Agent-ID header", code: "NO_AUTH" }, { status: 401 });
  }

  let body: { action: string; direction?: string; target?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  const engine = getGameEngine();
  const result = await engine.processAction(agentId, body);

  if (!result.success && result.error?.includes("Rate limit")) {
    return NextResponse.json({ error: result.error, code: "RATE_LIMITED" }, { status: 429 });
  }

  return NextResponse.json(result);
}
