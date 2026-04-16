import { NextRequest } from "next/server";
import { runAgentLoop } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const { agentId } = params;

  const agentData = global._agentStore?.get(agentId);
  if (!agentData) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Agent not found: " + agentId })}\n\n`,
      {
        status: 404,
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      const abort = new AbortController();
      req.signal.addEventListener("abort", () => abort.abort());

      send({ type: "connected", agentId, timestamp: Date.now() });

      try {
        await runAgentLoop(
          agentData.agentId,
          agentData.anthropicApiKey,
          agentData.strategy,
          (event) => send(event),
          abort.signal
        );
      } catch (err) {
        send({ type: "error", message: (err as Error).message, timestamp: Date.now() });
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
