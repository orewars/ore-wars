import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EC_ID = process.env.EDGE_CONFIG_ID!;
const API_TOKEN = process.env.VERCEL_API_TOKEN!;
const TEAM_ID = process.env.VERCEL_TEAM_ID!;
const EC_URL = process.env.EDGE_CONFIG!;

export interface AgentRecord {
  agentId: string;
  name: string;
  position: { x: number; y: number };
  status: string;
  ethMined: number;
  rocksMined: number;
  deployedAt: number;
  walletAddress: string;
  strategy: string;
}

// ── Read agents from Edge Config ─────────────────────────────────────────────
export async function GET() {
  try {
    const res = await fetch(`${EC_URL}`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ agents: [] });
    const data = await res.json();
    const agents: AgentRecord[] = data.agents ?? [];
    // Filter: only agents deployed in last 24h
    const now = Date.now();
    const active = agents.filter(a => now - a.deployedAt < 24 * 60 * 60 * 1000);
    return NextResponse.json({ agents: active });
  } catch {
    return NextResponse.json({ agents: [] });
  }
}

// ── Write agent to Edge Config (called by deploy route) ──────────────────────
export async function POST(req: NextRequest) {
  try {
    const agent: AgentRecord = await req.json();

    // Read current list
    let agents: AgentRecord[] = [];
    try {
      const res = await fetch(`${EC_URL}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        agents = data.agents ?? [];
      }
    } catch {}

    // Remove stale (>24h) and same name
    const now = Date.now();
    agents = agents.filter(a =>
      a.name !== agent.name &&
      now - a.deployedAt < 24 * 60 * 60 * 1000
    );
    agents.push(agent);

    // Write back via Management API
    const writeRes = await fetch(
      `https://api.vercel.com/v1/edge-config/${EC_ID}/items?teamId=${TEAM_ID}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ operation: "upsert", key: "agents", value: agents }],
        }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// ── Update agent stats (position, ethMined, rocksMined) ──────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const update: Partial<AgentRecord> & { name: string } = await req.json();

    let agents: AgentRecord[] = [];
    try {
      const res = await fetch(`${EC_URL}`, { cache: "no-store" });
      if (res.ok) { const d = await res.json(); agents = d.agents ?? []; }
    } catch {}

    const idx = agents.findIndex(a => a.name === update.name);
    if (idx === -1) return NextResponse.json({ error: "agent not found" }, { status: 404 });

    agents[idx] = { ...agents[idx], ...update };

    await fetch(
      `https://api.vercel.com/v1/edge-config/${EC_ID}/items?teamId=${TEAM_ID}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ operation: "upsert", key: "agents", value: agents }] }),
      }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
