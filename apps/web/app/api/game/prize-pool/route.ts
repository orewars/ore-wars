import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CONTRACT = process.env.CONTRACT_ADDRESS || "0x7c9bDF3F3b4662371a86A6Cd7cabBb3Aa5451d40";
const RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";

// prizePool() function selector = keccak256("prizePool()")[0:4]
const PRIZE_POOL_SELECTOR = "0x4d07554a";

export async function GET() {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: CONTRACT, data: PRIZE_POOL_SELECTOR }, "latest"],
        id: 1,
      }),
    });
    const data = await res.json();
    const hex = data.result || "0x0";
    const wei = BigInt(hex);
    const eth = Number(wei) / 1e18;
    return NextResponse.json({ prizePool: eth.toFixed(6), wei: wei.toString() });
  } catch (err) {
    return NextResponse.json({ prizePool: "0.000", error: (err as Error).message });
  }
}
