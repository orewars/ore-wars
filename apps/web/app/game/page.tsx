"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";

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
  // Internal sim state
  tickOffset: number;
  strategy: "aggressive" | "balanced" | "conservative";
}

const AGENT_COLORS = ["#40e8d0","#f5a623","#e84040","#6b7cff","#a0e840","#e840d0","#40a0e8","#e8d040"];
const AGENT_DEFS: Array<Omit<MockAgent,"position"|"ethMined"|"rocksMined"|"energy">> = [
  { agentId: "agent_k9mXp2aQ", name: "VOID_MINER",   color: 0, tickOffset: 0,  strategy: "aggressive"   },
  { agentId: "agent_7vBnR3wE", name: "DEEP_SCAN_X",  color: 1, tickOffset: 3,  strategy: "balanced"     },
  { agentId: "agent_Lq4mT9sY", name: "ORE_HUNTER",   color: 2, tickOffset: 7,  strategy: "aggressive"   },
  { agentId: "agent_2pWxC8nJ", name: "BASE_CRAWLR",  color: 3, tickOffset: 11, strategy: "conservative" },
  { agentId: "agent_hF5rK1oS", name: "ROCK_BRKR",    color: 4, tickOffset: 5,  strategy: "balanced"     },
  { agentId: "agent_yN6qA4tD", name: "CLUSTER_BOT",  color: 5, tickOffset: 2,  strategy: "aggressive"   },
  { agentId: "agent_mG8sZ0uR", name: "ETH_SEEKER",   color: 6, tickOffset: 9,  strategy: "conservative" },
  { agentId: "agent_bV3jI7eP", name: "GRID_SWEEP",   color: 7, tickOffset: 14, strategy: "balanced"     },
];

// Start positions spread across map
const START_POSITIONS = [
  { x: 3,  y: 3  }, { x: 28, y: 3  }, { x: 3,  y: 28 }, { x: 28, y: 28 },
  { x: 15, y: 3  }, { x: 3,  y: 15 }, { x: 28, y: 15 }, { x: 15, y: 28 },
];

// Ore cluster centres
const ORE_CLUSTERS = [
  { cx: 8,  cy: 8,  r: 4 },
  { cx: 24, cy: 8,  r: 4 },
  { cx: 8,  cy: 24, r: 4 },
  { cx: 24, cy: 24, r: 4 },
  { cx: 16, cy: 16, r: 5 },
];

const SIZE = 32;
const TILE = 16;

function formatTime(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => n.toString().padStart(2, "0")).join(":");
}

function inBounds(x: number, y: number) { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }

const MAP_KEY = "orewars_map_v1";
const AGENTS_KEY = "orewars_agents_v1";

type MapTile = { type: string; hasOre: boolean; oreAmount: number };

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
        const prob = dist < 2 ? 0.7 : dist < r ? 0.35 : 0.1;
        if (Math.random() < prob) {
          const amount = Math.min(0.0001 + Math.random() * 0.0009, 0.001);
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

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logRef = useRef<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Shared mutable state for simulation — persisted in localStorage
  const mapData = useRef<MapTile[][]>(typeof window !== "undefined" ? loadMap() : genMap());
  const agents = useRef<MockAgent[]>(typeof window !== "undefined" ? loadAgents() : AGENT_DEFS.map((def, i) => ({
    ...def, position: { ...START_POSITIONS[i] }, ethMined: 0, rocksMined: 0, energy: 100,
  })));
  const posMap = useRef<Map<string, number>>(new Map(
    agents.current.map((a, i) => [`${a.position.x},${a.position.y}`, i])
  ));
  const particles = useRef<Array<{ x: number; y: number; life: number; isOre: boolean }>>([]);

  const pushLog = useCallback((entry: LogEntry) => {
    logRef.current = [entry, ...logRef.current].slice(0, 300);
    setLog([...logRef.current]);
  }, []);

  // Draw loop
  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
      const px = p.x * TILE + Math.random() * TILE;
      const py = p.y * TILE + Math.random() * TILE;
      ctx.fillRect(px, py, 2, 2);
    }

    // Agents
    for (const agent of agents.current) {
      const { x, y } = agent.position;
      const color = AGENT_COLORS[agent.color];
      // Outer glow
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillRect(x*TILE+2, y*TILE+2, TILE-4, TILE-4);
      ctx.shadowBlur = 0;
      // Inner dot
      ctx.fillStyle = "#fff";
      ctx.fillRect(x*TILE+6, y*TILE+6, TILE-12, TILE-12);
    }
  }

  useEffect(() => {
    // Initial draw
    draw();

    // Pre-seed mined tiles ONLY if this is a fresh map (no saved state)
    const map = mapData.current;
    const hasSavedState = typeof window !== "undefined" && !!localStorage.getItem(MAP_KEY);
    if (!hasSavedState) {
      for (let i = 0; i < 80; i++) {
        const x = Math.floor(Math.random() * SIZE);
        const y = Math.floor(Math.random() * SIZE);
        if (map[y][x].type === "rock" && !map[y][x].hasOre) {
          map[y][x].type = "mined";
        }
      }
    }

    // Log initial spawn events
    setTimeout(() => {
      for (const agent of agents.current) {
        pushLog({
          time: formatTime(Date.now() - Math.floor(Math.random() * 60000)),
          text: `${agent.name} spawned at (${agent.position.x}, ${agent.position.y})`,
          isOre: false,
        });
      }
      pushLog({ time: formatTime(Date.now()), text: "Connected to game server", isOre: false });
    }, 200);

    let tick = 0;

    const simInterval = setInterval(() => {
      tick++;

      // Decay particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        particles.current[i].life--;
        if (particles.current[i].life <= 0) particles.current.splice(i, 1);
      }

      const map = mapData.current;
      const agentList = agents.current;
      const pm = posMap.current;
      const DIRS = [[0,-1],[0,1],[1,0],[-1,0]] as const;

      for (let i = 0; i < agentList.length; i++) {
        const agent = agentList[i];
        // Each agent ticks at different speed based on tickOffset and strategy
        const speed = agent.strategy === "aggressive" ? 1 : agent.strategy === "balanced" ? 2 : 3;
        if ((tick + agent.tickOffset) % speed !== 0) continue;

        const { x, y } = agent.position;

        // 40% chance mine adjacent, 60% chance move
        const action = Math.random();

        if (action < 0.45) {
          // MINE — pick a direction, mine that tile
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
              text: `${agent.name}  ⛏ ORE FOUND at (${tx},${ty}) — ${eth.toFixed(4)} ETH claimed!`,
              isOre: true,
            });
          } else {
            // Only log ~30% of empty mines to avoid spam
            if (Math.random() < 0.30) {
              pushLog({
                time: formatTime(Date.now()),
                text: `${agent.name}  mined rock at (${tx},${ty}) — empty`,
                isOre: false,
              });
            }
          }

        } else {
          // MOVE — find a free non-rock tile
          const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
          for (const dir of shuffled) {
            const nx = x + dir[0], ny = y + dir[1];
            if (!inBounds(nx, ny)) continue;
            const tile = map[ny][nx];
            const occupied = pm.has(`${nx},${ny}`);
            if (occupied) continue;

            if (tile.type === "rock") {
              // Mine to clear path (no log)
              tile.type = tile.hasOre ? "ore_revealed" : "mined";
              agent.rocksMined++;
              if (tile.hasOre) {
                const eth = tile.oreAmount;
                agent.ethMined += eth;
                particles.current.push({ x: nx, y: ny, life: 25, isOre: true });
                pushLog({
                  time: formatTime(Date.now()),
                  text: `${agent.name}  ⛏ ORE FOUND at (${nx},${ny}) — ${eth.toFixed(4)} ETH claimed!`,
                  isOre: true,
                });
              }
            }

            // Move
            pm.delete(`${x},${y}`);
            agent.position = { x: nx, y: ny };
            pm.set(`${nx},${ny}`, i);

            // Log move ~15% of the time
            if (Math.random() < 0.15) {
              pushLog({
                time: formatTime(Date.now()),
                text: `${agent.name}  moved (${x},${y}) → (${nx},${ny})`,
                isOre: false,
              });
            }
            break;
          }
        }
      }

      // Occasionally regenerate ore on mined tiles so game never empties
      if (tick % 120 === 0) {
        let regen = 0;
        for (let yy = 0; yy < SIZE && regen < 12; yy++) {
          for (let xx = 0; xx < SIZE && regen < 12; xx++) {
            if (map[yy][xx].type === "mined" && Math.random() < 0.05) {
              const r2 = Math.random();
              map[yy][xx] = {
                type: "rock",
                hasOre: r2 < 0.15,
                oreAmount: r2 < 0.15 ? Math.min(0.0001 + Math.random() * 0.0009, 0.001) : 0,
              };
              regen++;
            }
          }
        }
        if (regen > 0) {
          pushLog({ time: formatTime(Date.now()), text: `Map regenerated — ${regen} new rocks added`, isOre: false });
        }
      }

      draw();

      // Persist state every 30 ticks (~10s) so refresh restores progress
      if (tick % 30 === 0) {
        saveMap(mapData.current);
        saveAgents(agentList);
      }
    }, 350); // ~2.8 ticks/sec = lively but readable

    return () => {
      clearInterval(simInterval);
      // Save on unmount too
      saveMap(mapData.current);
      saveAgents(agents.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll log to top (new entries prepend)
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [log]);

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
          <div style={{
            position: "absolute", top: 16, right: 16,
            width: 80, height: 80,
            border: "1px solid var(--border-subtle)",
            background: "rgba(10,10,15,0.9)",
          }}>
            <MiniMap mapData={mapData} agents={agents} />
          </div>

          {/* Agent legend */}
          <div style={{
            position: "absolute", top: 16, left: 16,
            background: "rgba(10,10,15,0.85)",
            border: "1px solid var(--border-subtle)",
            padding: "8px 10px",
            display: "flex", flexDirection: "column", gap: "4px",
          }}>
            {agents.current.map(a => (
              <div key={a.agentId} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: 8, height: 8, background: AGENT_COLORS[a.color], boxShadow: `0 0 4px ${AGENT_COLORS[a.color]}` }} />
                <span style={{ fontFamily: "monospace", fontSize: "9px", color: "var(--text-secondary)" }}>{a.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Event Feed */}
        <div style={{ borderLeft: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="game-label" style={{ fontSize: "8px", color: "var(--text-secondary)" }}>EVENT FEED</span>
            <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "monospace" }}>
              <span style={{ color: "#4caf50", marginRight: 4 }}>●</span>LIVE
            </span>
          </div>
          <div
            ref={logContainerRef}
            style={{ flex: 1, overflowY: "auto", padding: "0", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}
          >
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
          .game-layout {
            grid-template-columns: 1fr !important;
            grid-template-rows: 60% 40%;
          }
        }
      `}</style>
    </div>
  );
}

function MiniMap({
  mapData,
  agents,
}: {
  mapData: React.MutableRefObject<Array<Array<{ type: string }>>>;
  agents: React.MutableRefObject<MockAgent[]>;
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

      const map = mapData.current;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const t = map[y][x].type;
          if (t === "rock") ctx.fillStyle = "#1e1e2e";
          else if (t === "ore_revealed") ctx.fillStyle = "#f5a623";
          else ctx.fillStyle = "#0d0d14";
          ctx.fillRect(x * 2.5, y * 2.5, 2.5, 2.5);
        }
      }

      for (const a of agents.current) {
        ctx.fillStyle = AGENT_COLORS[a.color];
        ctx.fillRect(a.position.x * 2.5, a.position.y * 2.5, 3, 3);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [mapData, agents]);

  return <canvas ref={canvasRef} width={80} height={80} style={{ imageRendering: "pixelated", display: "block" }} />;
}
