"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  time: string;
  text: string;
  isOre: boolean;
}

interface MockAgent {
  agentId: string;
  name: string;
  color: number;
  position: { x: number; y: number };
  ethMined: number;
  rocksMined: number;
  energy: number;
  tickOffset: number;
  strategy: "aggressive" | "balanced" | "conservative";
}

// Real agent from /api/game/map
interface RealAgent {
  agentId: string;
  name: string;
  position: { x: number; y: number };
  status: string;
  ethMined: number;
  rocksMined: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_COLORS = ["#40e8d0","#f5a623","#e84040","#6b7cff","#a0e840","#e840d0","#40a0e8","#e8d040"];
const AGENT_DEFS: Array<Omit<MockAgent,"position"|"ethMined"|"rocksMined"|"energy">> = [
  { agentId: "mock_k9mXp2aQ", name: "VOID_MINER",   color: 0, tickOffset: 0,  strategy: "aggressive"   },
  { agentId: "mock_7vBnR3wE", name: "DEEP_SCAN_X",  color: 1, tickOffset: 3,  strategy: "balanced"     },
  { agentId: "mock_Lq4mT9sY", name: "ORE_HUNTER",   color: 2, tickOffset: 7,  strategy: "aggressive"   },
  { agentId: "mock_2pWxC8nJ", name: "BASE_CRAWLR",  color: 3, tickOffset: 11, strategy: "conservative" },
  { agentId: "mock_hF5rK1oS", name: "ROCK_BRKR",    color: 4, tickOffset: 5,  strategy: "balanced"     },
  { agentId: "mock_yN6qA4tD", name: "CLUSTER_BOT",  color: 5, tickOffset: 2,  strategy: "aggressive"   },
  { agentId: "mock_mG8sZ0uR", name: "ETH_SEEKER",   color: 6, tickOffset: 9,  strategy: "conservative" },
  { agentId: "mock_bV3jI7eP", name: "GRID_SWEEP",   color: 7, tickOffset: 14, strategy: "balanced"     },
];

const START_POSITIONS = [
  { x: 3,  y: 3  }, { x: 28, y: 3  }, { x: 3,  y: 28 }, { x: 28, y: 28 },
  { x: 15, y: 3  }, { x: 3,  y: 15 }, { x: 28, y: 15 }, { x: 15, y: 28 },
];

const ORE_CLUSTERS = [
  { cx: 8,  cy: 8,  r: 4 },
  { cx: 24, cy: 8,  r: 4 },
  { cx: 8,  cy: 24, r: 4 },
  { cx: 24, cy: 24, r: 4 },
  { cx: 16, cy: 16, r: 5 },
];

const SIZE = 32;
const TILE = 16;

// ─── Ore rarity: ~1% overall across all rocks ────────────────────────────────
const ORE_CHANCE_CORE = 0.12;   // within 1.5 tiles of cluster centre
const ORE_CHANCE_MID  = 0.03;   // 1.5–3 tiles
const ORE_CHANCE_EDGE = 0.005;  // 3+ tiles (very rare scatter)

// ─── Persistence keys ─────────────────────────────────────────────────────────
const MAP_KEY    = "orewars_map_v1";
const AGENTS_KEY = "orewars_agents_v1";

type MapTile = { type: string; hasOre: boolean; oreAmount: number };

function inBounds(x: number, y: number) { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }

function genMap(): MapTile[][] {
  const map: MapTile[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => ({ type: "rock", hasOre: false, oreAmount: 0 }))
  );
  for (const { cx, cy, r } of ORE_CLUSTERS) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!inBounds(x, y)) continue;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const prob = dist < 1.5 ? ORE_CHANCE_CORE
                   : dist < r   ? ORE_CHANCE_MID
                   : ORE_CHANCE_EDGE;
        if (Math.random() < prob) {
          // Tiny amounts — realistic feel
          const amount = Math.min(0.00005 + Math.random() * 0.00045, 0.0005);
          map[y][x] = { type: "rock", hasOre: true, oreAmount: amount };
        }
      }
    }
  }
  return map;
}

function loadMap(): MapTile[][] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(MAP_KEY) : null;
    if (raw) return JSON.parse(raw) as MapTile[][];
  } catch {}
  return genMap();
}

function saveMap(map: MapTile[][]) {
  try { localStorage.setItem(MAP_KEY, JSON.stringify(map)); } catch {}
}

type SavedAgent = { agentId: string; position: { x: number; y: number }; ethMined: number; rocksMined: number };

function loadAgents(): MockAgent[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(AGENTS_KEY) : null;
    if (raw) {
      const saved: SavedAgent[] = JSON.parse(raw);
      return AGENT_DEFS.map((def, i) => {
        const s = saved.find(a => a.agentId === def.agentId);
        return {
          ...def,
          position: s ? { ...s.position } : { ...START_POSITIONS[i] },
          ethMined: s?.ethMined ?? 0,
          rocksMined: s?.rocksMined ?? 0,
          energy: 100,
        };
      });
    }
  } catch {}
  return AGENT_DEFS.map((def, i) => ({
    ...def,
    position: { ...START_POSITIONS[i] },
    ethMined: 0,
    rocksMined: 0,
    energy: 100,
  }));
}

function saveAgents(agentList: MockAgent[]) {
  try {
    localStorage.setItem(AGENTS_KEY, JSON.stringify(
      agentList.map(a => ({
        agentId: a.agentId,
        position: { ...a.position },
        ethMined: a.ethMined,
        rocksMined: a.rocksMined,
      }))
    ));
  } catch {}
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => n.toString().padStart(2, "0")).join(":");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logRef = useRef<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const mapData = useRef<MapTile[][]>(typeof window !== "undefined" ? loadMap() : genMap());
  const agents = useRef<MockAgent[]>(typeof window !== "undefined" ? loadAgents() : AGENT_DEFS.map((def, i) => ({
    ...def, position: { ...START_POSITIONS[i] }, ethMined: 0, rocksMined: 0, energy: 100,
  })));
  const posMap = useRef<Map<string, number>>(new Map(
    agents.current.map((a, i) => [`${a.position.x},${a.position.y}`, i])
  ));
  const particles = useRef<Array<{ x: number; y: number; life: number; isOre: boolean }>>([]);

  // Real deployed agents from /api/game/map
  const realAgents = useRef<RealAgent[]>([]);
  const [realAgentCount, setRealAgentCount] = useState(0);

  const pushLog = useCallback((entry: LogEntry) => {
    logRef.current = [entry, ...logRef.current].slice(0, 300);
    setLog([...logRef.current]);
  }, []);

  // ─── Draw ───────────────────────────────────────────────────────────────────
  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Map tiles
    const map = mapData.current;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const t = map[y][x].type;
        if (t === "rock") ctx.fillStyle = "#1e1e2e";
        else if (t === "ore_revealed") {
          ctx.fillStyle = "#5a3000";
          ctx.fillRect(x*TILE+1, y*TILE+1, TILE-2, TILE-2);
          ctx.fillStyle = "#f5a623";
          ctx.fillRect(x*TILE+4, y*TILE+4, TILE-8, TILE-8);
          continue;
        } else ctx.fillStyle = "#0d0d14";
        ctx.fillRect(x*TILE+1, y*TILE+1, TILE-2, TILE-2);
      }
    }

    // Particles
    for (const p of particles.current) {
      const alpha = p.life / 25;
      ctx.fillStyle = p.isOre ? `rgba(245,166,35,${alpha})` : `rgba(100,100,160,${alpha})`;
      ctx.fillRect(p.x * TILE + Math.random() * TILE, p.y * TILE + Math.random() * TILE, 2, 2);
    }

    // Mock agents (background visual)
    for (const agent of agents.current) {
      const { x, y } = agent.position;
      const color = AGENT_COLORS[agent.color];
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillRect(x*TILE+2, y*TILE+2, TILE-4, TILE-4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x*TILE+6, y*TILE+6, TILE-12, TILE-12);
    }

    // Real deployed agents — drawn on top, distinct style (white border + name label)
    for (const ra of realAgents.current) {
      if (!ra.position) continue;
      const { x, y } = ra.position;
      if (!inBounds(x, y)) continue;
      // White/silver glowing square
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ffffff";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x*TILE+1, y*TILE+1, TILE-2, TILE-2);
      ctx.shadowBlur = 0;
      // Name label above the tile
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(x*TILE - 2, y*TILE - 10, TILE + 4, 10);
      ctx.fillStyle = "#ffffff";
      ctx.font = "6px monospace";
      ctx.fillText(ra.name.slice(0, 8), x*TILE, y*TILE - 2);
    }
  }

  // ─── Load real deployed agents from localStorage (set by deploy page) ────────
  useEffect(() => {
    const loadReal = () => {
      try {
        const raw = localStorage.getItem("orewars_real_agents");
        if (!raw) return;
        const stored: RealAgent[] = JSON.parse(raw);
        // Only show agents deployed in last 24h
        const now = Date.now();
        const active = stored.filter((a: RealAgent & { deployedAt?: number }) =>
          !a.deployedAt || now - a.deployedAt < 24 * 60 * 60 * 1000
        );

        const prev = realAgents.current;
        for (const curr of active) {
          const old = prev.find(p => p.agentId === curr.agentId);
          if (!old) {
            pushLog({
              time: formatTime(Date.now()),
              text: `${curr.name}  entered the map at (${curr.position?.x ?? "?"}, ${curr.position?.y ?? "?"}) [YOUR AGENT]`,
              isOre: false,
            });
          } else if (curr.ethMined > old.ethMined) {
            const diff = (curr.ethMined - old.ethMined).toFixed(4);
            pushLog({
              time: formatTime(Date.now()),
              text: `${curr.name}  ⛏ ORE MINED — ${diff} ETH [YOUR AGENT]`,
              isOre: true,
            });
          }
        }

        realAgents.current = active;
        setRealAgentCount(active.length);
      } catch {}
    };

    loadReal();
    const interval = setInterval(loadReal, 2000);
    return () => clearInterval(interval);
  }, [pushLog]);

  // ─── Mock simulation ─────────────────────────────────────────────────────────
  useEffect(() => {
    draw();

    const map = mapData.current;
    const hasSaved = typeof window !== "undefined" && !!localStorage.getItem(MAP_KEY);
    if (!hasSaved) {
      for (let i = 0; i < 80; i++) {
        const x = Math.floor(Math.random() * SIZE);
        const y = Math.floor(Math.random() * SIZE);
        if (map[y][x].type === "rock" && !map[y][x].hasOre) {
          map[y][x].type = "mined";
        }
      }
    }

    setTimeout(() => {
      for (const agent of agents.current) {
        pushLog({
          time: formatTime(Date.now() - Math.floor(Math.random() * 60000)),
          text: `${agent.name} spawned at (${agent.position.x}, ${agent.position.y})`,
          isOre: false,
        });
      }
      pushLog({ time: formatTime(Date.now()), text: "Game server connected", isOre: false });
    }, 200);

    let tick = 0;
    const DIRS = [[0,-1],[0,1],[1,0],[-1,0]] as const;

    const simInterval = setInterval(() => {
      tick++;

      // Decay particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        particles.current[i].life--;
        if (particles.current[i].life <= 0) particles.current.splice(i, 1);
      }

      const agentList = agents.current;
      const pm = posMap.current;

      for (let i = 0; i < agentList.length; i++) {
        const agent = agentList[i];
        const speed = agent.strategy === "aggressive" ? 1 : agent.strategy === "balanced" ? 2 : 3;
        if ((tick + agent.tickOffset) % speed !== 0) continue;

        const { x, y } = agent.position;
        const action = Math.random();

        if (action < 0.45) {
          // MINE
          const dir = DIRS[Math.floor(Math.random() * 4)];
          const tx = x + dir[0], ty = y + dir[1];
          if (!inBounds(tx, ty)) continue;
          const tile = map[ty][tx];
          if (tile.type !== "rock") continue;

          tile.type = tile.hasOre ? "ore_revealed" : "mined";
          agent.rocksMined++;
          particles.current.push({ x: tx, y: ty, life: 25, isOre: tile.hasOre });

          if (tile.hasOre) {
            const eth = tile.oreAmount;
            agent.ethMined += eth;
            pushLog({
              time: formatTime(Date.now()),
              text: `${agent.name}  ⛏ ORE FOUND at (${tx},${ty}) — ${eth.toFixed(4)} ETH`,
              isOre: true,
            });
          } else if (Math.random() < 0.20) {
            pushLog({
              time: formatTime(Date.now()),
              text: `${agent.name}  mined rock at (${tx},${ty}) — empty`,
              isOre: false,
            });
          }
        } else {
          // MOVE
          const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
          for (const dir of shuffled) {
            const nx = x + dir[0], ny = y + dir[1];
            if (!inBounds(nx, ny)) continue;
            if (pm.has(`${nx},${ny}`)) continue;
            const tile = map[ny][nx];
            if (tile.type === "rock") {
              tile.type = tile.hasOre ? "ore_revealed" : "mined";
              agent.rocksMined++;
              if (tile.hasOre) {
                const eth = tile.oreAmount;
                agent.ethMined += eth;
                particles.current.push({ x: nx, y: ny, life: 25, isOre: true });
                pushLog({
                  time: formatTime(Date.now()),
                  text: `${agent.name}  ⛏ ORE FOUND at (${nx},${ny}) — ${eth.toFixed(4)} ETH`,
                  isOre: true,
                });
              }
            }
            pm.delete(`${x},${y}`);
            agent.position = { x: nx, y: ny };
            pm.set(`${nx},${ny}`, i);
            if (Math.random() < 0.10) {
              pushLog({ time: formatTime(Date.now()), text: `${agent.name}  moved (${x},${y}) → (${nx},${ny})`, isOre: false });
            }
            break;
          }
        }
      }

      // Regen every ~80s
      if (tick % 230 === 0) {
        let regen = 0;
        for (let yy = 0; yy < SIZE && regen < 8; yy++) {
          for (let xx = 0; xx < SIZE && regen < 8; xx++) {
            if (map[yy][xx].type === "mined" && Math.random() < 0.04) {
              // Very rare ore on regen
              const isOre = Math.random() < 0.01;
              map[yy][xx] = {
                type: "rock",
                hasOre: isOre,
                oreAmount: isOre ? Math.min(0.00005 + Math.random() * 0.00045, 0.0005) : 0,
              };
              regen++;
            }
          }
        }
        if (regen > 0) pushLog({ time: formatTime(Date.now()), text: `Map regen — ${regen} new rocks`, isOre: false });
      }

      draw();

      if (tick % 30 === 0) {
        saveMap(mapData.current);
        saveAgents(agentList);
      }
    }, 350);

    return () => {
      clearInterval(simInterval);
      saveMap(mapData.current);
      saveAgents(agents.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTop = 0;
  }, [log]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <div className="game-layout" style={{ flex: 1, display: "grid", gridTemplateColumns: "70% 30%", overflow: "hidden" }}>

        {/* Game Canvas */}
        <div style={{ position: "relative", background: "#08080f", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <canvas
            ref={canvasRef}
            width={512}
            height={512}
            style={{ imageRendering: "pixelated", display: "block", maxWidth: "100%", maxHeight: "100%" }}
          />

          {/* Minimap */}
          <div style={{ position: "absolute", top: 16, right: 16, width: 80, height: 80, border: "1px solid var(--border-subtle)", background: "rgba(10,10,15,0.9)" }}>
            <MiniMap mapData={mapData} mockAgents={agents} realAgents={realAgents} />
          </div>

          {/* Legend */}
          <div style={{
            position: "absolute", top: 16, left: 16,
            background: "rgba(10,10,15,0.85)",
            border: "1px solid var(--border-subtle)",
            padding: "8px 10px",
            display: "flex", flexDirection: "column", gap: "4px",
            maxHeight: "45vh", overflowY: "auto",
          }}>
            <div style={{ fontSize: "7px", color: "var(--text-muted)", fontFamily: "monospace", marginBottom: 2, letterSpacing: "0.05em" }}>MOCK AGENTS</div>
            {agents.current.map(a => (
              <div key={a.agentId} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: 8, height: 8, background: AGENT_COLORS[a.color], boxShadow: `0 0 4px ${AGENT_COLORS[a.color]}` }} />
                <span style={{ fontFamily: "monospace", fontSize: "9px", color: "var(--text-secondary)" }}>{a.name}</span>
              </div>
            ))}
            {realAgentCount > 0 && (
              <>
                <div style={{ fontSize: "7px", color: "var(--text-muted)", fontFamily: "monospace", marginTop: 6, marginBottom: 2, letterSpacing: "0.05em" }}>REAL AGENTS</div>
                {realAgents.current.map(ra => (
                  <div key={ra.agentId} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: 8, height: 8, border: "1.5px solid #fff", background: "transparent", boxShadow: "0 0 4px #fff" }} />
                    <span style={{ fontFamily: "monospace", fontSize: "9px", color: "#fff", fontWeight: 600 }}>{ra.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Event Feed */}
        <div style={{ borderLeft: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="game-label" style={{ fontSize: "8px", color: "var(--text-secondary)" }}>EVENT FEED</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {realAgentCount > 0 && (
                <span style={{ fontSize: "9px", fontFamily: "monospace", color: "#fff" }}>
                  {realAgentCount} real
                </span>
              )}
              <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                <span style={{ color: "#4caf50", marginRight: 4 }}>●</span>LIVE
              </span>
            </div>
          </div>
          <div ref={logContainerRef} style={{ flex: 1, overflowY: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
            {log.map((entry, i) => (
              <div key={i} style={{
                padding: "5px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                color: entry.isOre ? "var(--ore-500)" : "var(--text-secondary)",
                background: entry.isOre ? "rgba(245,166,35,0.06)" : "transparent",
                display: "flex", gap: "8px", alignItems: "flex-start",
              }}>
                <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: "10px" }}>{entry.time}</span>
                <span style={{ wordBreak: "break-word", lineHeight: 1.5 }}>{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .game-layout { grid-template-columns: 1fr !important; grid-template-rows: 60% 40%; }
        }
      `}</style>
    </div>
  );
}

// ─── MiniMap ──────────────────────────────────────────────────────────────────
function MiniMap({
  mapData,
  mockAgents,
  realAgents,
}: {
  mapData: React.MutableRefObject<MapTile[]>;
  mockAgents: React.MutableRefObject<MockAgent[]>;
  realAgents: React.MutableRefObject<RealAgent[]>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#08080f";
      ctx.fillRect(0, 0, 80, 80);

      const map = mapData.current as unknown as MapTile[][];
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const t = map[y][x].type;
          ctx.fillStyle = t === "rock" ? "#1e1e2e" : t === "ore_revealed" ? "#f5a623" : "#0d0d14";
          ctx.fillRect(x * 2.5, y * 2.5, 2.5, 2.5);
        }
      }

      for (const a of mockAgents.current) {
        ctx.fillStyle = AGENT_COLORS[a.color];
        ctx.fillRect(a.position.x * 2.5, a.position.y * 2.5, 3, 3);
      }

      // Real agents — white dots
      for (const ra of realAgents.current) {
        if (!ra.position) continue;
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 4;
        ctx.shadowColor = "#ffffff";
        ctx.fillRect(ra.position.x * 2.5, ra.position.y * 2.5, 4, 4);
        ctx.shadowBlur = 0;
      }
    }, 300);
    return () => clearInterval(interval);
  }, [mapData, mockAgents, realAgents]);

  return <canvas ref={canvasRef} width={80} height={80} style={{ imageRendering: "pixelated", display: "block" }} />;
}
