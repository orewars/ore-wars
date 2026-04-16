import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Stream route is deprecated — agent simulation runs client-side on the game page.
export async function GET(
  _req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  return NextResponse.json(
    { error: "Agent stream not available — see /game for live simulation", agentId: params.agentId },
    { status: 410 }
  );
}
