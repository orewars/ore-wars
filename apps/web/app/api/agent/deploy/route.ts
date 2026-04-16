import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";

const NAME_REGEX = /^[A-Z0-9_]{1,16}$/;

export async function POST(req: NextRequest) {
  let body: {
    name?: string;
    walletAddress?: string;
    anthropicApiKey?: string;
    strategy?: string;
    maxEthSpend?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  const { name, walletAddress, anthropicApiKey, strategy, maxEthSpend } = body;

  if (!name || !NAME_REGEX.test(name)) {
    return NextResponse.json({
      error: "Agent name must be 1-16 characters, uppercase letters, numbers, and underscores only",
      code: "INVALID_NAME"
    }, { status: 400 });
  }

  if (!walletAddress || !isAddress(walletAddress)) {
    return NextResponse.json({
      error: "Wallet address is not a valid EVM address",
      code: "INVALID_ADDRESS"
    }, { status: 400 });
  }

  if (!anthropicApiKey || !anthropicApiKey.startsWith("sk-ant-")) {
    return NextResponse.json({
      error: "Anthropic API key format invalid — must start with sk-ant-",
      code: "INVALID_API_KEY_FORMAT"
    }, { status: 400 });
  }

  if (!["AGGRESSIVE", "BALANCED", "CONSERVATIVE"].includes(strategy || "")) {
    return NextResponse.json({
      error: "Strategy must be AGGRESSIVE, BALANCED, or CONSERVATIVE",
      code: "INVALID_STRATEGY"
    }, { status: 400 });
  }

  if (typeof maxEthSpend !== "number" || maxEthSpend <= 0) {
    return NextResponse.json({
      error: "Max ETH spend must be a positive number",
      code: "INVALID_MAX_SPEND"
    }, { status: 400 });
  }

  // Validate Anthropic API key with real call
  try {
    const testClient = new Anthropic({ apiKey: anthropicApiKey });
    await testClient.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401) {
      return NextResponse.json({
        error: "Anthropic API key invalid: 401 Unauthorized from Anthropic",
        code: "INVALID_API_KEY"
      }, { status: 400 });
    }
    // Other errors (rate limit, etc.) — proceed
    console.warn("[deploy] Anthropic test call non-401 error:", err);
  }

  const agentId = `agent_${nanoid(8)}`;
  const gameServerUrl = process.env.GAME_SERVER_URL || "http://localhost:3001";
  const secret = process.env.GAME_SERVER_INTERNAL_SECRET || "dev-secret";

  // Spawn agent in game server
  let spawnPosition: { x: number; y: number };
  try {
    const spawnRes = await fetch(`${gameServerUrl}/internal/spawn-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ agentId, name, walletAddress, strategy }),
    });

    if (!spawnRes.ok) {
      const err = await spawnRes.json();
      return NextResponse.json({
        error: `Game server rejected spawn: ${err.error}`,
        code: "SPAWN_FAILED"
      }, { status: 500 });
    }

    const spawnData = await spawnRes.json();
    spawnPosition = spawnData.spawnPosition;
  } catch (err) {
    return NextResponse.json({
      error: `Game server unreachable: ${(err as Error).message}`,
      code: "GAME_SERVER_UNREACHABLE"
    }, { status: 503 });
  }

  // Store agent info for stream lookup (in production: Redis or DB)
  // For now: store in global map with API key (encrypted in production)
  if (!global._agentStore) global._agentStore = new Map();
  global._agentStore.set(agentId, {
    agentId,
    name: name!,
    walletAddress: walletAddress!,
    anthropicApiKey: anthropicApiKey!,
    strategy: strategy!,
    maxEthSpend: maxEthSpend!,
  });

  const streamUrl = `/api/agent/${agentId}/stream`;

  return NextResponse.json({ agentId, spawnPosition, streamUrl }, { status: 201 });
}

// Type augmentation for global agent store
declare global {
  // eslint-disable-next-line no-var
  var _agentStore: Map<string, {
    agentId: string;
    name: string;
    walletAddress: string;
    anthropicApiKey: string;
    strategy: string;
    maxEthSpend: number;
  }> | undefined;
}
