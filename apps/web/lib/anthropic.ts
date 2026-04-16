import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are an AI agent in OreWars.
Your goal is to mine ore-bearing rocks and maximize ETH earned for your owner.
Read the full game rules at https://orewars.fun/skill.md before planning.
You have the following tools: move, mine, scan, status.
Think step by step. Be efficient. Avoid mined tiles. Mine clusters.
You will receive your current position and visible surroundings after each action.
Do not explain yourself. Just act.`;

const tools: Anthropic.Tool[] = [
  {
    name: "move",
    description: "Move one tile in a cardinal direction",
    input_schema: {
      type: "object" as const,
      properties: {
        direction: { type: "string", enum: ["north", "south", "east", "west"] }
      },
      required: ["direction"]
    }
  },
  {
    name: "mine",
    description: "Mine the rock at current position or an adjacent tile",
    input_schema: {
      type: "object" as const,
      properties: {
        target: { type: "string", enum: ["current", "north", "south", "east", "west"] }
      },
      required: ["target"]
    }
  },
  {
    name: "scan",
    description: "Scan a 5x5 area around current position",
    input_schema: { type: "object" as const, properties: {} }
  },
  {
    name: "status",
    description: "Get current position, energy, and stats",
    input_schema: { type: "object" as const, properties: {} }
  }
];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGameAPI(agentId: string, action: Record<string, unknown>): Promise<unknown> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");
  const res = await fetch(`${baseUrl}/api/game/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${agentId}`,
    },
    body: JSON.stringify(action),
  });
  if (res.status === 429) {
    await sleep(1000);
    return callGameAPI(agentId, action);
  }
  return res.json();
}

export interface AgentEvent {
  type: "action" | "thought" | "error";
  tool?: string;
  input?: Record<string, unknown>;
  result?: unknown;
  message?: string;
  timestamp: number;
}

export async function runAgentLoop(
  agentId: string,
  apiKey: string,
  strategy: string,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal
) {
  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [];

  const initialStatus = await callGameAPI(agentId, { action: "status" });
  messages.push({
    role: "user",
    content: `Game started. Your status: ${JSON.stringify(initialStatus)}. Strategy: ${strategy}. Begin mining.`
  });

  onEvent({ type: "thought", message: `Agent ${agentId} initialized. Strategy: ${strategy}`, timestamp: Date.now() });

  while (!signal?.aborted) {
    await sleep(500);

    try {
      const response = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        tools,
        messages
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = await callGameAPI(agentId, {
              action: block.name,
              ...(block.input as Record<string, unknown>)
            });

            onEvent({
              type: "action",
              tool: block.name,
              input: block.input as Record<string, unknown>,
              result,
              timestamp: Date.now(),
            });

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result)
            });
          }
        }

        messages.push({ role: "user", content: toolResults });

      } else if (response.stop_reason === "end_turn") {
        messages.push({ role: "user", content: "Continue mining. Check status and proceed." });
      }

      if (messages.length > 40) messages.splice(0, messages.length - 40);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onEvent({ type: "error", message: `Agent loop error: ${msg}`, timestamp: Date.now() });
      await sleep(2000);
    }
  }
}
