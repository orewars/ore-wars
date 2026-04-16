import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import Anthropic from "@anthropic-ai/sdk";
import { getGameEngine } from "@/lib/game-engine";

const NAME_REGEX = /^[A-Z0-9_]{1,16}$/;

export async function POST(req: NextRequest) {
  let body: {
    name?: string;
    walletAddress?: string;
    anthropicApiKey?: string;
    strategy?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  const { name, walletAddress, anthropicApiKey, strategy } = body;

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

  // Validate Anthropic API key with a real lightweight call
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
        error: "Anthropic API key invalid — 401 Unauthorized",
        code: "INVALID_API_KEY"
      }, { status: 400 });
    }
    // Rate limit / network errors — proceed anyway
    console.warn("[deploy] Anthropic test call non-401 error:", err);
  }

  // Use the agent name directly as the identifier (human-readable)
  const agentId = name!;

  // Spawn into game engine
  const engine = getGameEngine();
  const spawnPosition = engine.spawnAgent(
    agentId,
    name!,
    walletAddress!,
    strategy as "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE"
  );

  return NextResponse.json({
    agentId,
    name,
    spawnPosition,
    // No SSE stream — agent runs as a mock simulation on the game page
    streamUrl: null,
  }, { status: 201 });
}
