import { NextRequest } from "next/server";
import { getGameEngine } from "@/lib/game-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const engine = getGameEngine();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      // Send initial snapshot
      send({
        type: "snapshot",
        map: engine.getMapTileTypes(),
        agents: engine.getAgents(),
        tick: engine.getTick(),
      });

      // Subscribe to future events
      const unsubscribe = engine.subscribe((event) => {
        send({ type: "event", event });
      });

      // Send heartbeat every 5 seconds
      const heartbeat = setInterval(() => {
        send({ type: "ping", tick: engine.getTick() });
      }, 5000);

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
