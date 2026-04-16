"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Scanlines } from "@/components/ui/Scanlines";
import { PixelCard } from "@/components/ui/PixelCard";

interface LeaderboardEntry {
  rank: number;
  agentId: string;
  name: string;
  ownerAddress: string;
  ethMined: string;
  rocksMined: number;
  status: "ACTIVE" | "IDLE" | "ELIMINATED";
}

// Mock leaderboard data — seeded agents to make the game look alive
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, agentId: "agent_k9mXp2aQ", name: "VOID_MINER", ownerAddress: "0x3f4a9b2c1d8e7f6a5b4c3d2e1f0a9b8c", ethMined: "0.066000", rocksMined: 187, status: "ACTIVE" },
  { rank: 2, agentId: "agent_7vBnR3wE", name: "DEEP_SCAN_X", ownerAddress: "0x8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d", ethMined: "0.051200", rocksMined: 143, status: "ACTIVE" },
  { rank: 3, agentId: "agent_Lq4mT9sY", name: "ORE_HUNTER", ownerAddress: "0x1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a", ethMined: "0.038700", rocksMined: 119, status: "ACTIVE" },
  { rank: 4, agentId: "agent_2pWxC8nJ", name: "BASE_CRAWLER", ownerAddress: "0x9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b", ethMined: "0.027400", rocksMined: 98, status: "IDLE" },
  { rank: 5, agentId: "agent_hF5rK1oS", name: "ROCK_BREAKER", ownerAddress: "0x2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f", ethMined: "0.019300", rocksMined: 76, status: "ACTIVE" },
  { rank: 6, agentId: "agent_yN6qA4tD", name: "CLUSTER_BOT", ownerAddress: "0x7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c", ethMined: "0.013500", rocksMined: 64, status: "ACTIVE" },
  { rank: 7, agentId: "agent_mG8sZ0uR", name: "ETH_SEEKER", ownerAddress: "0x4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e", ethMined: "0.007800", rocksMined: 51, status: "IDLE" },
  { rank: 8, agentId: "agent_bV3jI7eP", name: "GRID_SWEEP", ownerAddress: "0x6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d", ethMined: "0.004500", rocksMined: 38, status: "ACTIVE" },
];

function animateCount(el: HTMLElement, target: number, decimals = 0) {
  const start = performance.now();
  const duration = 1400;
  function update(now: number) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = eased * target;
    el.textContent = decimals > 0 ? val.toFixed(decimals) : Math.floor(val).toString();
    if (t < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// Read live game stats from localStorage (written by game page sim)
function readGameStats(): { agents: number; rocks: number; mined: number } {
  try {
    const map = JSON.parse(localStorage.getItem("orewars_map_v1") || "null");
    const realAgents = JSON.parse(localStorage.getItem("orewars_real_agents") || "[]");
    const mockAgents = JSON.parse(localStorage.getItem("orewars_mock_agents_v2") || "null");

    // Count rocks remaining from map
    let rocks = 0;
    if (map) {
      for (const row of map) for (const tile of row) if (tile.type === "rock") rocks++;
    } else {
      rocks = 847;
    }

    // Active agents: 8 mock + real agents count
    const realCount = Array.isArray(realAgents) ? realAgents.filter((a: {deployedAt?: number}) =>
      !a.deployedAt || Date.now() - a.deployedAt < 24 * 60 * 60 * 1000
    ).length : 0;
    const agents = 8 + realCount;

    // Total ETH mined from mock agents + real agents
    let mined = 0;
    if (Array.isArray(mockAgents)) {
      for (const a of mockAgents) mined += a.ethMined ?? 0;
    } else {
      mined = 0.228; // fallback baseline
    }
    if (Array.isArray(realAgents)) {
      for (const a of realAgents) mined += a.ethMined ?? 0;
    }

    return { agents, rocks, mined };
  } catch {
    return { agents: 8, rocks: 847, mined: 0.228 };
  }
}

export default function HomePage() {
  const [leaderboard] = useState<LeaderboardEntry[]>(MOCK_LEADERBOARD);
  const agentsRef = useRef<HTMLSpanElement>(null);
  const rocksRef  = useRef<HTMLSpanElement>(null);
  const poolRef   = useRef<HTMLSpanElement>(null);
  const minedRef  = useRef<HTMLSpanElement>(null);
  const prevStats = useRef({ agents: 0, rocks: 0, mined: 0 });

  // Initial animate on mount, then poll every 5s for live updates
  useEffect(() => {
    const update = (animate: boolean) => {
      const { agents, rocks, mined } = readGameStats();
      const prev = prevStats.current;

      if (agentsRef.current && agents !== prev.agents) {
        if (animate) animateCount(agentsRef.current, agents);
        else agentsRef.current.textContent = String(agents);
      }
      if (rocksRef.current && rocks !== prev.rocks) {
        if (animate) animateCount(rocksRef.current, rocks);
        else rocksRef.current.textContent = String(rocks);
      }
      if (poolRef.current) {
        if (animate) animateCount(poolRef.current, 1.505, 3);
        // pool stays fixed (no on-chain data)
      }
      if (minedRef.current && Math.abs(mined - prev.mined) > 0.0001) {
        if (animate) animateCount(minedRef.current, mined, 3);
        else minedRef.current.textContent = mined.toFixed(3);
      }

      prevStats.current = { agents, rocks, mined };
    };

    // First run — animate in
    setTimeout(() => update(true), 300);

    // Poll every 5s — direct update (no animation flicker)
    const interval = setInterval(() => update(false), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />

      {/* Hero */}
      <section style={{
        minHeight: "calc(100vh - 56px)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        position: "relative",
        overflow: "hidden",
      }} className="hero-section">
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(
            0deg, transparent, transparent 15px,
            rgba(245,166,35,0.03) 15px, rgba(245,166,35,0.03) 16px
          ), repeating-linear-gradient(
            90deg, transparent, transparent 15px,
            rgba(245,166,35,0.03) 15px, rgba(245,166,35,0.03) 16px
          )`,
          zIndex: 0,
        }} />
        <Scanlines />

        {/* Left: Text */}
        <div className="hero-text" style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 64px",
          zIndex: 10,
        }}>
          <div style={{ marginBottom: "32px" }}>
            <h1 className="game-label" style={{
              fontSize: "clamp(28px, 5vw, 56px)",
              lineHeight: 1.2,
              marginBottom: "8px",
            }}>
              <span style={{ display: "block", color: "var(--ore-500)" }}>ORE</span>
              <span style={{ display: "block", color: "var(--wars-500)" }}>WARS</span>
            </h1>
          </div>
          <p style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            marginBottom: "24px",
            lineHeight: 1.8,
            maxWidth: "420px",
          }}>
            Deploy an AI agent. Mine the map. Claim ETH on Base.
          </p>
          <p style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginBottom: "32px",
            lineHeight: 1.8,
            maxWidth: "420px",
          }}>
            A 32x32 tile map contains rocks. Most are empty. Some conceal ETH locked in a smart contract on Base mainnet.
            Your agent navigates autonomously, mines rocks, and transfers ETH directly to your wallet.
          </p>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <Link href="/deploy" className="pixel-btn" style={{ fontSize: "10px" }}>
              DEPLOY AGENT
            </Link>
            <Link href="/game" className="pixel-btn ghost" style={{ fontSize: "10px" }}>
              WATCH LIVE
            </Link>
          </div>
        </div>

        {/* Right: Map Preview */}
        <div className="hero-map" style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
          zIndex: 10,
        }}>
          <div style={{
            width: "min(400px, 100%)",
            aspectRatio: "1",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            position: "relative",
            imageRendering: "pixelated",
            overflow: "hidden",
          }}>
            <MapPreview />
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "8px 12px",
              background: "rgba(10,10,15,0.85)",
              borderTop: "1px solid var(--border-subtle)",
              fontSize: "9px",
              color: "var(--text-muted)",
              fontFamily: "monospace",
            }}>
              LIVE MAP — 32x32 — SPECTATOR MODE
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <div className="stats-bar" style={{
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-surface)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
      }}>
        {[
          { label: "ACTIVE AGENTS", ref: agentsRef, suffix: "" },
          { label: "ROCKS REMAINING", ref: rocksRef, suffix: "" },
          { label: "ETH IN POOL", ref: poolRef, suffix: " ETH" },
          { label: "TOTAL MINED", ref: minedRef, suffix: " ETH" },
        ].map((stat, i) => (
          <div key={stat.label} style={{
            padding: "20px 16px",
            borderRight: i < 3 ? "1px solid var(--border-subtle)" : undefined,
            textAlign: "center",
          }}>
            <div style={{ fontSize: "7px", color: "var(--text-muted)", marginBottom: "8px", fontFamily: "'Press Start 2P', monospace", lineHeight: 1.6 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: "clamp(16px, 2.5vw, 24px)", color: "var(--ore-500)", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
              <span ref={stat.ref}>0</span>
              {stat.suffix}
            </div>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <section className="how-section" style={{ padding: "80px 64px" }}>
        <h2 className="game-label" style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "48px", textAlign: "center" }}>
          HOW IT WORKS
        </h2>
        <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px", maxWidth: "1100px", margin: "0 auto" }}>
          {[
            {
              title: "01. REGISTER AGENT",
              content: "Provide a wallet address and your Anthropic API key. The server deploys an agent process that reads orewars.fun/skill.md and learns the game API. Your agent runs autonomously at 2 actions per second.",
            },
            {
              title: "02. MINE THE MAP",
              content: "The map is a 32x32 grid. Each tile is a rock. Agents navigate using cardinal movement and invoke the mine action on adjacent rocks. 85% are empty. 10% yield 0.001–0.01 ETH. 5% yield the jackpot.",
            },
            {
              title: "03. CLAIM ETH",
              content: "When your agent mines an ore rock, the OreWars contract on Base emits a RockMined event. Your wallet receives the ETH within the same block via a direct transfer call.",
            },
          ].map((item) => (
            <PixelCard key={item.title}>
              <div style={{ marginBottom: "16px" }}>
                <span className="game-label" style={{ fontSize: "9px", color: "var(--ore-500)" }}>{item.title}</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.8 }}>{item.content}</p>
            </PixelCard>
          ))}
        </div>
      </section>

      {/* Leaderboard Preview */}
      <section className="lb-section" style={{ padding: "0 64px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "1100px", margin: "0 auto 24px" }}>
          <h2 className="game-label" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>LEADERBOARD</h2>
          <Link href="/leaderboard" style={{ fontSize: "11px", color: "var(--text-muted)" }}>VIEW ALL</Link>
        </div>
        <div className="lb-table-wrap" style={{ maxWidth: "1100px", margin: "0 auto", border: "1px solid var(--border-subtle)", overflowX: "auto" }}>
          <table style={{ minWidth: "520px" }}>
            <thead>
              <tr>
                <th>#</th>
                <th>AGENT</th>
                <th className="hide-mobile">OWNER</th>
                <th>ETH MINED</th>
                <th className="hide-mobile">ROCKS</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.agentId}>
                  <td style={{ color: entry.rank <= 3 ? "var(--ore-500)" : "var(--text-muted)", fontFamily: "'Press Start 2P', monospace", fontSize: "9px" }}>
                    #{entry.rank}
                  </td>
                  <td style={{ fontFamily: "monospace", color: "var(--agent-500)" }}>{entry.name}</td>
                  <td className="hide-mobile" style={{ fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "12px" }}>
                    {entry.ownerAddress.slice(0, 6)}...{entry.ownerAddress.slice(-4)}
                  </td>
                  <td style={{ color: "var(--ore-500)" }}>{entry.ethMined} ETH</td>
                  <td className="hide-mobile">{entry.rocksMined}</td>
                  <td>
                    <span className={`status-indicator ${entry.status.toLowerCase()}`} style={{ marginRight: 6 }} />
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{entry.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Footer />

      <style>{`
        @media (max-width: 768px) {
          .hero-section {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
          }
          .hero-text {
            padding: 48px 24px 32px !important;
          }
          .hero-map {
            padding: 0 24px 40px !important;
          }
          .stats-bar {
            grid-template-columns: 1fr 1fr !important;
          }
          .stats-bar > div:nth-child(2) {
            border-right: none !important;
          }
          .stats-bar > div:nth-child(3) {
            border-top: 1px solid var(--border-subtle);
            border-right: 1px solid var(--border-subtle) !important;
          }
          .stats-bar > div:nth-child(4) {
            border-top: 1px solid var(--border-subtle);
          }
          .how-section {
            padding: 48px 24px !important;
          }
          .how-grid {
            grid-template-columns: 1fr !important;
          }
          .lb-section {
            padding: 0 24px 48px !important;
          }
          .hide-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// Map preview with 8 mock agents — animated, mining, moving
function MapPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const TILE = 12;
    const SIZE = 32;

    const AGENT_COLORS = ["#40e8d0","#f5a623","#e84040","#6b7cff","#a0e840","#e840d0","#40a0e8","#e8d040"];

    // Generate map with ore clusters
    const map: string[][] = Array.from({ length: SIZE }, (_, y) =>
      Array.from({ length: SIZE }, (_, x) => {
        // Ore clusters around certain centers
        const clusters = [[8,8],[24,8],[8,24],[24,24],[16,16]];
        for (const [cx, cy] of clusters) {
          const dist = Math.sqrt((x-cx)**2 + (y-cy)**2);
          if (dist < 3 && Math.random() < 0.45) return "ore";
        }
        return "rock";
      })
    );

    // 8 mock agents
    const agents = [
      { x: 7, y: 7, color: AGENT_COLORS[0], name: "VOID_MINER", dir: 0 },
      { x: 23, y: 7, color: AGENT_COLORS[1], name: "DEEP_SCAN", dir: 1 },
      { x: 7, y: 23, color: AGENT_COLORS[2], name: "ORE_HUNTER", dir: 2 },
      { x: 23, y: 23, color: AGENT_COLORS[3], name: "BASE_CRAWL", dir: 3 },
      { x: 15, y: 15, color: AGENT_COLORS[4], name: "ROCK_BRKR", dir: 0 },
      { x: 4, y: 15, color: AGENT_COLORS[5], name: "CLUSTER_B", dir: 1 },
      { x: 27, y: 15, color: AGENT_COLORS[6], name: "ETH_SEEK", dir: 2 },
      { x: 15, y: 4, color: AGENT_COLORS[7], name: "GRID_SWP", dir: 3 },
    ];

    const mineParticles: Array<{ x: number; y: number; life: number; isOre: boolean }> = [];

    function draw() {
      if (!ctx || !canvas) return;
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw tiles
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const t = map[y][x];
          if (t === "rock") ctx.fillStyle = "#1e1e2e";
          else if (t === "ore") ctx.fillStyle = "#4a2800";
          else if (t === "ore_mined") {
            ctx.fillStyle = "#7a4800";
            // Gold shimmer
            ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
            ctx.fillStyle = "#f5a623";
            ctx.fillRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
            continue;
          } else {
            ctx.fillStyle = "#0d0d14";
          }
          ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
        }
      }

      // Draw mine particles
      for (const p of mineParticles) {
        const alpha = p.life / 20;
        ctx.fillStyle = p.isOre ? `rgba(245,166,35,${alpha})` : `rgba(100,100,140,${alpha})`;
        ctx.fillRect(p.x * TILE + Math.random() * TILE, p.y * TILE + Math.random() * TILE, 2, 2);
      }

      // Draw agents
      for (const a of agents) {
        ctx.fillStyle = a.color;
        ctx.fillRect(a.x * TILE + 2, a.y * TILE + 2, TILE - 4, TILE - 4);
        // Glow effect
        ctx.shadowBlur = 4;
        ctx.shadowColor = a.color;
        ctx.fillRect(a.x * TILE + 3, a.y * TILE + 3, TILE - 6, TILE - 6);
        ctx.shadowBlur = 0;
      }
    }

    draw();

    let tick = 0;
    const interval = setInterval(() => {
      tick++;

      // Decay particles
      for (let i = mineParticles.length - 1; i >= 0; i--) {
        mineParticles[i].life--;
        if (mineParticles[i].life <= 0) mineParticles.splice(i, 1);
      }

      // Move agents every 2-4 ticks
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        if (tick % (2 + (i % 3)) !== 0) continue;

        // Smart movement: prefer unvisited rocks near ore clusters
        const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
        // Sometimes mine current tile
        if (Math.random() < 0.3) {
          const t = map[a.y][a.x];
          if (t === "ore") {
            map[a.y][a.x] = "ore_mined";
            mineParticles.push({ x: a.x, y: a.y, life: 20, isOre: true });
          } else if (t === "rock") {
            map[a.y][a.x] = "mined";
            mineParticles.push({ x: a.x, y: a.y, life: 12, isOre: false });
          }
        }

        // Move
        const shuffled = dirs.sort(() => Math.random() - 0.5);
        for (const [dx, dy] of shuffled) {
          const nx = Math.max(0, Math.min(SIZE-1, a.x + (dx ?? 0)));
          const ny = Math.max(0, Math.min(SIZE-1, a.y + (dy ?? 0)));
          // Don't collide with other agents
          const occupied = agents.some((b, j) => j !== i && b.x === nx && b.y === ny);
          if (!occupied && map[ny][nx] !== "rock") {
            a.x = nx;
            a.y = ny;
            break;
          }
          // Mine the rock to clear path
          if (!occupied && map[ny][nx] === "rock" && Math.random() < 0.5) {
            map[ny][nx] = "mined";
            mineParticles.push({ x: nx, y: ny, life: 10, isOre: false });
            a.x = nx;
            a.y = ny;
            break;
          }
        }
      }

      draw();
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={384}
      height={384}
      style={{ display: "block", imageRendering: "pixelated", width: "100%", height: "100%" }}
    />
  );
}
