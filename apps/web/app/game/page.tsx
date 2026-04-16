"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";

interface LogEntry { time: string; text: string; isOre: boolean; }

interface Agent {
  agentId: string;
  name: string;
  color: number;          // index into AGENT_COLORS
  position: { x: number; y: number };
  ethMined: number;
  rocksMined: number;
  energy: number;
  tickOffset: number;
  strategy: "aggressive" | "balanced" | "conservative";
  isMock: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────
const AGENT_COLORS = [
  "#40e8d0","#f5a623","#e84040","#6b7cff",
  "#a0e840","#e840d0","#40a0e8","#e8d040",
  // extra colours for real agents
  "#ff6b6b","#51cf66","#339af0","#f06595",
  "#ffd43b","#a9e34b","#74c0fc","#da77f2",
];

const MOCK_DEFS = [
  { agentId: "mock_0", name: "VOID_MINER",   color: 0,  tickOffset: 0,  strategy: "aggressive"   },
  { agentId: "mock_1", name: "DEEP_SCAN_X",  color: 1,  tickOffset: 3,  strategy: "balanced"     },
  { agentId: "mock_2", name: "ORE_HUNTER",   color: 2,  tickOffset: 7,  strategy: "aggressive"   },
  { agentId: "mock_3", name: "BASE_CRAWLR",  color: 3,  tickOffset: 11, strategy: "conservative" },
  { agentId: "mock_4", name: "ROCK_BRKR",    color: 4,  tickOffset: 5,  strategy: "balanced"     },
  { agentId: "mock_5", name: "CLUSTER_BOT",  color: 5,  tickOffset: 2,  strategy: "aggressive"   },
  { agentId: "mock_6", name: "ETH_SEEKER",   color: 6,  tickOffset: 9,  strategy: "conservative" },
  { agentId: "mock_7", name: "GRID_SWEEP",   color: 7,  tickOffset: 14, strategy: "balanced"     },
] as const;

const MOCK_START = [
  { x: 3, y: 3 }, { x: 28, y: 3 }, { x: 3, y: 28 }, { x: 28, y: 28 },
  { x: 15, y: 3 }, { x: 3, y: 15 }, { x: 28, y: 15 }, { x: 15, y: 28 },
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
const MAP_KEY    = "orewars_map_v1";
const AGENTS_KEY = "orewars_mock_agents_v2";

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
        // ~1% net ore chance across map
        const prob = dist < 1.5 ? 0.12 : dist < r ? 0.03 : 0.005;
        if (Math.random() < prob) {
          map[y][x] = { type: "rock", hasOre: true, oreAmount: Math.min(0.00005 + Math.random() * 0.00045, 0.0005) };
        }
      }
    }
  }
  return map;
}

function loadMap(): MapTile[][] {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    if (raw) return JSON.parse(raw) as MapTile[][];
  } catch {}
  return genMap();
}
function saveMap(map: MapTile[][]) {
  try { localStorage.setItem(MAP_KEY, JSON.stringify(map)); } catch {}
}

function loadMockAgents(): Agent[] {
  type Saved = { agentId: string; position: { x: number; y: number }; ethMined: number; rocksMined: number };
  try {
    const raw = localStorage.getItem(AGENTS_KEY);
    if (raw) {
      const saved: Saved[] = JSON.parse(raw);
      return MOCK_DEFS.map((def, i) => {
        const s = saved.find(a => a.agentId === def.agentId);
        return { ...def, isMock: true, position: s ? {...s.position} : {...MOCK_START[i]}, ethMined: s?.ethMined ?? 0, rocksMined: s?.rocksMined ?? 0, energy: 100 };
      });
    }
  } catch {}
  return MOCK_DEFS.map((def, i) => ({ ...def, isMock: true, position: {...MOCK_START[i]}, ethMined: 0, rocksMined: 0, energy: 100 }));
}
function saveMockAgents(list: Agent[]) {
  try {
    localStorage.setItem(AGENTS_KEY, JSON.stringify(
      list.filter(a => a.isMock).map(a => ({ agentId: a.agentId, position: {...a.position}, ethMined: a.ethMined, rocksMined: a.rocksMined }))
    ));
  } catch {}
}

function loadRealAgents(): Agent[] {
  type Stored = { agentId: string; name: string; position: { x: number; y: number }; ethMined: number; rocksMined: number; deployedAt?: number };
  try {
    const raw = localStorage.getItem("orewars_real_agents");
    if (!raw) return [];
    const now = Date.now();
    const stored: Stored[] = JSON.parse(raw);
    const active = stored.filter(a => !a.deployedAt || now - a.deployedAt < 24 * 60 * 60 * 1000);
    return active.map((a, i) => ({
      agentId: a.agentId,
      name: a.name,
      color: (8 + i) % AGENT_COLORS.length, // colors 8–15 reserved for real agents
      position: a.position ? {...a.position} : { x: 16, y: 16 },
      ethMined: a.ethMined ?? 0,
      rocksMined: a.rocksMined ?? 0,
      energy: 100,
      tickOffset: Math.floor(Math.random() * 10),
      strategy: "balanced" as const,
      isMock: false,
    }));
  } catch {}
  return [];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, "0")).join(":");
}

// ── Component ────────────────────────────────────────────────────────────────
export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logRef  = useRef<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [agentNames, setAgentNames] = useState<{ name: string; color: string }[]>([]);

  const mapData = useRef<MapTile[][]>(typeof window !== "undefined" ? loadMap() : genMap());

  // Single unified agent list: mock + real
  const agents = useRef<Agent[]>([]);
  const posMap = useRef<Map<string, number>>(new Map());
  const particles = useRef<Array<{ x: number; y: number; life: number; isOre: boolean }>>([]);

  const pushLog = useCallback((e: LogEntry) => {
    logRef.current = [e, ...logRef.current].slice(0, 300);
    setLog([...logRef.current]);
  }, []);

  // ── Draw ───────────────────────────────────────────────────────────────────
  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const map = mapData.current;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const t = map[y][x].type;
        if (t === "ore_revealed") {
          ctx.fillStyle = "#5a3000";
          ctx.fillRect(x*TILE+1, y*TILE+1, TILE-2, TILE-2);
          ctx.fillStyle = "#f5a623";
          ctx.fillRect(x*TILE+4, y*TILE+4, TILE-8, TILE-8);
        } else {
          ctx.fillStyle = t === "rock" ? "#1e1e2e" : "#0d0d14";
          ctx.fillRect(x*TILE+1, y*TILE+1, TILE-2, TILE-2);
        }
      }
    }

    for (const p of particles.current) {
      const alpha = p.life / 25;
      ctx.fillStyle = p.isOre ? `rgba(245,166,35,${alpha})` : `rgba(100,100,160,${alpha})`;
      ctx.fillRect(p.x*TILE + Math.random()*TILE, p.y*TILE + Math.random()*TILE, 2, 2);
    }

    // All agents — same visual style, just different colours
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
  }

  // ── Init & sim ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapData.current;
    const mock = loadMockAgents();
    const real = loadRealAgents();

    // Merge — real agents override any mock that shares position
    const all = [...mock, ...real];
    agents.current = all;

    // Build posMap
    const pm = new Map<string, number>();
    all.forEach((a, i) => pm.set(`${a.position.x},${a.position.y}`, i));
    posMap.current = pm;

    // Update legend
    setAgentNames(all.map(a => ({ name: a.name, color: AGENT_COLORS[a.color] })));

    // Pre-seed mined tiles only on first ever visit
    const hasSaved = !!localStorage.getItem(MAP_KEY);
    if (!hasSaved) {
      for (let i = 0; i < 80; i++) {
        const x = Math.floor(Math.random() * SIZE), y = Math.floor(Math.random() * SIZE);
        if (map[y][x].type === "rock" && !map[y][x].hasOre) map[y][x].type = "mined";
      }
    }

    draw();

    setTimeout(() => {
      for (const a of all) {
        pushLog({ time: formatTime(Date.now() - Math.floor(Math.random()*60000)), text: `${a.name} spawned at (${a.position.x}, ${a.position.y})`, isOre: false });
      }
      pushLog({ time: formatTime(Date.now()), text: "Game server connected", isOre: false });
    }, 200);

    let tick = 0;
    const DIRS = [[0,-1],[0,1],[1,0],[-1,0]] as const;

    const sim = setInterval(() => {
      tick++;

      // Decay particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        particles.current[i].life--;
        if (particles.current[i].life <= 0) particles.current.splice(i, 1);
      }

      const agentList = agents.current;
      const pmap = posMap.current;

      for (let i = 0; i < agentList.length; i++) {
        const agent = agentList[i];
        const speed = agent.strategy === "aggressive" ? 1 : agent.strategy === "balanced" ? 2 : 3;
        if ((tick + agent.tickOffset) % speed !== 0) continue;

        const { x, y } = agent.position;
        const action = Math.random();

        if (action < 0.45) {
          // Mine adjacent tile
          const dir = DIRS[Math.floor(Math.random() * 4)];
          const tx = x + dir[0], ty = y + dir[1];
          if (!inBounds(tx, ty)) continue;
          const tile = map[ty][tx];
          if (tile.type !== "rock") continue;

          tile.type = tile.hasOre ? "ore_revealed" : "mined";
          agent.rocksMined++;
          particles.current.push({ x: tx, y: ty, life: 25, isOre: tile.hasOre });

          if (tile.hasOre) {
            agent.ethMined += tile.oreAmount;
            pushLog({ time: formatTime(Date.now()), text: `${agent.name}  ⛏ ORE at (${tx},${ty}) — ${tile.oreAmount.toFixed(4)} ETH`, isOre: true });
          } else if (Math.random() < 0.18) {
            pushLog({ time: formatTime(Date.now()), text: `${agent.name}  mined rock at (${tx},${ty}) — empty`, isOre: false });
          }
        } else {
          // Move
          const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
          for (const dir of shuffled) {
            const nx = x + dir[0], ny = y + dir[1];
            if (!inBounds(nx, ny) || pmap.has(`${nx},${ny}`)) continue;
            const tile = map[ny][nx];
            if (tile.type === "rock") {
              tile.type = tile.hasOre ? "ore_revealed" : "mined";
              agent.rocksMined++;
              if (tile.hasOre) {
                agent.ethMined += tile.oreAmount;
                particles.current.push({ x: nx, y: ny, life: 25, isOre: true });
                pushLog({ time: formatTime(Date.now()), text: `${agent.name}  ⛏ ORE at (${nx},${ny}) — ${tile.oreAmount.toFixed(4)} ETH`, isOre: true });
              }
            }
            pmap.delete(`${x},${y}`);
            agent.position = { x: nx, y: ny };
            pmap.set(`${nx},${ny}`, i);
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
              const isOre = Math.random() < 0.01;
              map[yy][xx] = { type: "rock", hasOre: isOre, oreAmount: isOre ? Math.min(0.00005 + Math.random() * 0.00045, 0.0005) : 0 };
              regen++;
            }
          }
        }
        if (regen > 0) pushLog({ time: formatTime(Date.now()), text: `Map regen — ${regen} new rocks`, isOre: false });
      }

      draw();

      // Save every 30 ticks
      if (tick % 30 === 0) {
        saveMap(mapData.current);
        saveMockAgents(agentList);
      }
    }, 350);

    return () => {
      clearInterval(sim);
      saveMap(mapData.current);
      saveMockAgents(agents.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync real agents into simulation when localStorage changes ─────────────
  useEffect(() => {
    const sync = () => {
      const real = loadRealAgents();
      if (real.length === 0) return;
      const current = agents.current;
      const pm = posMap.current;

      for (const ra of real) {
        const idx = current.findIndex(a => a.agentId === ra.agentId);
        if (idx === -1) {
          // New real agent — add to sim
          const i = current.length;
          pm.set(`${ra.position.x},${ra.position.y}`, i);
          current.push(ra);
          setAgentNames(current.map(a => ({ name: a.name, color: AGENT_COLORS[a.color] })));
          pushLog({ time: formatTime(Date.now()), text: `${ra.name}  joined the game at (${ra.position.x},${ra.position.y})`, isOre: false });
        } else {
          // Update stats only — don't override position (sim owns movement now)
          current[idx].ethMined = Math.max(current[idx].ethMined, ra.ethMined);
        }
      }
    };

    sync();
    const interval = setInterval(sync, 3000);
    return () => clearInterval(interval);
  }, [pushLog]);

  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTop = 0;
  }, [log]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <div className="game-layout" style={{ flex: 1, display: "grid", gridTemplateColumns: "70% 30%", overflow: "hidden" }}>

        <div style={{ position: "relative", background: "#08080f", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <canvas ref={canvasRef} width={512} height={512} style={{ imageRendering: "pixelated", display: "block", maxWidth: "100%", maxHeight: "100%" }} />

          {/* Minimap */}
          <div style={{ position: "absolute", top: 16, right: 16, width: 80, height: 80, border: "1px solid var(--border-subtle)", background: "rgba(10,10,15,0.9)" }}>
            <MiniMap mapData={mapData} agents={agents} />
          </div>

          {/* Unified agent legend */}
          <div style={{
            position: "absolute", top: 16, left: 16,
            background: "rgba(10,10,15,0.85)",
            border: "1px solid var(--border-subtle)",
            padding: "8px 10px",
            display: "flex", flexDirection: "column", gap: "4px",
            maxHeight: "50vh", overflowY: "auto",
          }}>
            {agentNames.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: 8, height: 8, background: a.color, boxShadow: `0 0 4px ${a.color}`, flexShrink: 0 }} />
                <span style={{ fontFamily: "monospace", fontSize: "9px", color: "var(--text-secondary)" }}>{a.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Event feed */}
        <div style={{ borderLeft: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="game-label" style={{ fontSize: "8px", color: "var(--text-secondary)" }}>EVENT FEED</span>
            <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "monospace" }}>
              <span style={{ color: "#4caf50", marginRight: 4 }}>●</span>LIVE
            </span>
          </div>
          <div ref={logContainerRef} style={{ flex: 1, overflowY: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
            {log.map((entry, i) => (
              <div key={i} style={{
                padding: "5px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                color: entry.isOre ? "var(--ore-500)" : "var(--text-secondary)",
                background: entry.isOre ? "rgba(245,166,35,0.06)" : "transparent",
                display: "flex", gap: "8px",
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

// ── MiniMap ───────────────────────────────────────────────────────────────────
function MiniMap({ mapData, agents }: {
  mapData: React.MutableRefObject<MapTile[][]>;
  agents: React.MutableRefObject<Agent[]>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#08080f";
      ctx.fillRect(0, 0, 80, 80);
      const map = mapData.current;
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          const t = map[y][x].type;
          ctx.fillStyle = t === "rock" ? "#1e1e2e" : t === "ore_revealed" ? "#f5a623" : "#0d0d14";
          ctx.fillRect(x * 2.5, y * 2.5, 2.5, 2.5);
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
