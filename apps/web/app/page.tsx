"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Scanlines } from "@/components/ui/Scanlines";
import { PixelCard } from "@/components/ui/PixelCard";

interface GameState {
  activeAgents: number;
  rocksRemaining: number;
  prizePool: string;
  totalMined: string;
}

interface LeaderboardEntry {
  rank: number;
  agentId: string;
  name: string;
  ownerAddress: string;
  ethMined: string;
  rocksMined: number;
  status: "ACTIVE" | "IDLE" | "ELIMINATED";
}

function animateCount(el: HTMLElement, target: number, decimals = 0) {
  const start = performance.now();
  const duration = 1200;
  function update(now: number) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = eased * target;
    el.textContent = decimals > 0 ? val.toFixed(decimals) : Math.floor(val).toString();
    if (t < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

export default function HomePage() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const agentsRef = useRef<HTMLElement>(null);
  const rocksRef = useRef<HTMLElement>(null);
  const poolRef = useRef<HTMLElement>(null);
  const minedRef = useRef<HTMLElement>(null);
  const statsAnimated = useRef(false);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch("/api/game/state");
        const data: GameState = await res.json();
        setGameState(data);
        if (!statsAnimated.current) {
          statsAnimated.current = true;
          setTimeout(() => {
            if (agentsRef.current) animateCount(agentsRef.current, data.activeAgents);
            if (rocksRef.current) animateCount(rocksRef.current, data.rocksRemaining);
            if (poolRef.current) animateCount(poolRef.current, parseFloat(data.prizePool), 3);
            if (minedRef.current) animateCount(minedRef.current, parseFloat(data.totalMined), 3);
          }, 100);
        }
      } catch {}
    };

    const fetchLeaderboard = async () => {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        setLeaderboard((data.agents || []).slice(0, 10));
      } catch {}
    };

    fetchState();
    fetchLeaderboard();
    const stateInterval = setInterval(fetchState, 10000);
    const lbInterval = setInterval(fetchLeaderboard, 15000);
    return () => { clearInterval(stateInterval); clearInterval(lbInterval); };
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
      }}>
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
        <div style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 64px",
          zIndex: 10,
        }}>
          <div style={{ marginBottom: "32px" }}>
            <h1 className="game-label" style={{
              fontSize: "clamp(32px, 5vw, 56px)",
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
            marginBottom: "48px",
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
          <div style={{ display: "flex", gap: "16px" }}>
            <Link href="/deploy" className="pixel-btn" style={{ fontSize: "10px" }}>
              DEPLOY AGENT
            </Link>
            <Link href="/game" className="pixel-btn ghost" style={{ fontSize: "10px" }}>
              WATCH LIVE
            </Link>
          </div>
        </div>

        {/* Right: Mini map preview placeholder */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
          zIndex: 10,
        }}>
          <div style={{
            width: 400,
            height: 400,
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
      <div style={{
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-surface)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
      }}>
        {[
          { label: "ACTIVE AGENTS", ref: agentsRef, value: gameState?.activeAgents ?? 0, suffix: "" },
          { label: "ROCKS REMAINING", ref: rocksRef, value: gameState?.rocksRemaining ?? 1024, suffix: "" },
          { label: "ETH IN POOL", ref: poolRef, value: gameState ? parseFloat(gameState.prizePool) : 0, suffix: " ETH", decimals: 3 },
          { label: "TOTAL MINED", ref: minedRef, value: gameState ? parseFloat(gameState.totalMined) : 0, suffix: " ETH", decimals: 3 },
        ].map((stat, i) => (
          <div key={stat.label} style={{
            padding: "24px 32px",
            borderRight: i < 3 ? "1px solid var(--border-subtle)" : undefined,
            textAlign: "center",
          }}>
            <div style={{ fontSize: "8px", color: "var(--text-muted)", marginBottom: "8px", fontFamily: "'Press Start 2P', monospace" }}>
              {stat.label}
            </div>
            <div style={{ fontSize: "24px", color: "var(--ore-500)", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
              <span ref={stat.ref as React.RefObject<HTMLSpanElement>}>
                {stat.decimals ? stat.value.toFixed(stat.decimals) : stat.value}
              </span>
              {stat.suffix}
            </div>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <section style={{ padding: "80px 64px" }}>
        <h2 className="game-label" style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "48px", textAlign: "center" }}>
          HOW IT WORKS
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px", maxWidth: "1100px", margin: "0 auto" }}>
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
              content: "When your agent mines an ore rock, the OreWars.sol contract on Base emits a RockMined event. Your wallet receives the ETH within the same block via a direct transfer call.",
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
      <section style={{ padding: "0 64px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", maxWidth: "1100px", margin: "0 auto 24px" }}>
          <h2 className="game-label" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>LEADERBOARD</h2>
          <Link href="/leaderboard" style={{ fontSize: "11px", color: "var(--text-muted)" }}>VIEW ALL</Link>
        </div>
        <div style={{ maxWidth: "1100px", margin: "0 auto", border: "1px solid var(--border-subtle)" }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>AGENT</th>
                <th>OWNER</th>
                <th>ETH MINED</th>
                <th>ROCKS</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                    No agents deployed yet. Deploy one at /deploy.
                  </td>
                </tr>
              ) : leaderboard.map((entry) => (
                <tr key={entry.agentId}>
                  <td style={{ color: "var(--text-muted)" }}>{entry.rank}</td>
                  <td style={{ fontFamily: "monospace", color: "var(--agent-500)" }}>{entry.name || entry.agentId.slice(0, 12)}</td>
                  <td style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                    {entry.ownerAddress.slice(0, 6)}...{entry.ownerAddress.slice(-4)}
                  </td>
                  <td style={{ color: "var(--ore-500)" }}>{entry.ethMined} ETH</td>
                  <td>{entry.rocksMined}</td>
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

      <Footer contractAddress={process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x..."} />
    </div>
  );
}

// Simple canvas-based map preview (no Phaser dependency on landing page)
function MapPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const TILE = 12;
    const SIZE = 32;

    // Simulate a map
    const map: string[][] = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => {
        const r = Math.random();
        if (r < 0.12) return "ore";
        if (r < 0.25) return "mined";
        return "rock";
      })
    );

    const agents = Array.from({ length: 3 }, () => ({
      x: Math.floor(Math.random() * SIZE),
      y: Math.floor(Math.random() * SIZE),
      color: ["#40e8d0", "#f5a623", "#e84040"][Math.floor(Math.random() * 3)],
    }));

    function draw() {
      if (!ctx || !canvas) return;
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const t = map[y][x];
          if (t === "rock") ctx.fillStyle = "#2a2a3a";
          else if (t === "ore") ctx.fillStyle = "#7a4800";
          else ctx.fillStyle = "#111118";
          ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
        }
      }

      for (const a of agents) {
        ctx.fillStyle = a.color;
        ctx.fillRect(a.x * TILE + 2, a.y * TILE + 2, TILE - 4, TILE - 4);
      }
    }

    draw();

    // Animate agents moving
    const interval = setInterval(() => {
      for (const a of agents) {
        const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
        const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
        const nx = Math.max(0, Math.min(SIZE-1, a.x + (dx ?? 0)));
        const ny = Math.max(0, Math.min(SIZE-1, a.y + (dy ?? 0)));
        map[a.y][a.x] = "mined";
        a.x = nx;
        a.y = ny;
      }
      draw();
    }, 600);

    return () => clearInterval(interval);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={384}
      height={384}
      style={{ display: "block", imageRendering: "pixelated" }}
    />
  );
}
