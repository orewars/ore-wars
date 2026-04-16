"use client";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";

interface GameEvent {
  kind: string;
  agentId?: string;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  position?: { x: number; y: number };
  result?: string;
  amount?: number;
  timestamp: number;
}

interface LogEntry {
  time: string;
  text: string;
  isOre: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => n.toString().padStart(2, "0"))
    .join(":");
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const mapRef = useRef<string[][]>(Array.from({ length: 32 }, () => Array(32).fill("rock")));
  const agentsRef = useRef<Array<{ agentId: string; position: { x: number; y: number }; color: number }>>([]);

  const AGENT_COLORS = ["#40e8d0", "#f5a623", "#e84040", "#6b7cff", "#a0e840", "#e840d0", "#40a0e8", "#e8d040"];
  const TILE = 16;

  function drawMap() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const map = mapRef.current;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const t = map[y][x];
        if (t === "rock") ctx.fillStyle = "#2a2a3a";
        else if (t === "ore_revealed") ctx.fillStyle = "#7a4800";
        else if (t === "mined") ctx.fillStyle = "#111118";
        else ctx.fillStyle = "#0d0d14";
        ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);

        if (t === "ore_revealed") {
          ctx.fillStyle = "#f5a623";
          ctx.fillRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8);
        }
      }
    }

    for (const agent of agentsRef.current) {
      const { x, y } = agent.position;
      const color = AGENT_COLORS[agent.color % AGENT_COLORS.length];
      ctx.fillStyle = color;
      ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
    }
  }

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_GAME_SERVER_WS_URL || "ws://localhost:3001/ws";
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "spectate" }));
        addLog({ time: formatTime(Date.now()), text: "Connected to game server", isOre: false });
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "snapshot") {
            mapRef.current = msg.map;
            agentsRef.current = msg.agents || [];
            drawMap();
          } else if (msg.type === "event") {
            handleEvent(msg.event as GameEvent);
          }
        } catch {}
      };

      ws.onerror = () => {
        addLog({ time: formatTime(Date.now()), text: "WebSocket connection failed: game server unreachable", isOre: false });
      };

      ws.onclose = () => {
        addLog({ time: formatTime(Date.now()), text: "Disconnected from game server", isOre: false });
      };
    } catch {
      addLog({ time: formatTime(Date.now()), text: "WebSocket connection failed: game server unreachable", isOre: false });
    }

    return () => { ws?.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLog(entry: LogEntry) {
    setLog(prev => [entry, ...prev].slice(0, 200));
  }

  function handleEvent(event: GameEvent) {
    const time = formatTime(event.timestamp || Date.now());
    let text = "";
    let isOre = false;

    if (event.kind === "move" && event.agentId && event.to) {
      text = `${event.agentId.slice(0, 14)}  moved to (${event.to.x}, ${event.to.y})`;
      const agent = agentsRef.current.find(a => a.agentId === event.agentId);
      if (agent && event.to) agent.position = event.to;
    } else if (event.kind === "mine" && event.agentId && event.position) {
      if (event.result === "ore") {
        text = `${event.agentId.slice(0, 14)}  mined ORE rock at (${event.position.x}, ${event.position.y}) — ${event.amount?.toFixed(4)} ETH claimed`;
        isOre = true;
        mapRef.current[event.position.y][event.position.x] = "ore_revealed";
      } else {
        text = `${event.agentId.slice(0, 14)}  mined EMPTY rock at (${event.position.x}, ${event.position.y})`;
        mapRef.current[event.position.y][event.position.x] = "mined";
      }
    } else if (event.kind === "spawn" && event.agentId && event.position) {
      text = `${event.agentId.slice(0, 14)}  spawned at (${event.position.x}, ${event.position.y})`;
    } else if (event.kind === "reset") {
      text = `Map reset. New epoch: ${(event as { newEpoch?: number }).newEpoch}`;
      mapRef.current = Array.from({ length: 32 }, () => Array(32).fill("rock"));
    }

    if (text) addLog({ time, text, isOre });
    drawMap();
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "70% 30%", overflow: "hidden" }}>
        {/* Game Canvas */}
        <div style={{ position: "relative", background: "var(--bg-base)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <canvas
            ref={canvasRef}
            width={512}
            height={512}
            style={{ imageRendering: "pixelated", display: "block" }}
          />
          {/* Minimap */}
          <div style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 64,
            height: 64,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            overflow: "hidden",
          }}>
            <MiniMap mapRef={mapRef} agentsRef={agentsRef} />
          </div>
        </div>

        {/* Event Feed */}
        <div style={{
          borderLeft: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
          }}>
            <span className="game-label" style={{ fontSize: "8px", color: "var(--text-secondary)" }}>EVENT FEED</span>
          </div>
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 0",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
          }}>
            {log.map((entry, i) => (
              <div key={i} style={{
                padding: "3px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                color: entry.isOre ? "var(--ore-500)" : "var(--text-secondary)",
                display: "flex",
                gap: "8px",
              }}>
                <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>[{entry.time}]</span>
                <span>{entry.text}</span>
              </div>
            ))}
            {log.length === 0 && (
              <div style={{ padding: "32px 16px", color: "var(--text-muted)", fontSize: "11px" }}>
                Connecting to game server...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMap({
  mapRef,
  agentsRef,
}: {
  mapRef: React.RefObject<string[][]>;
  agentsRef: React.RefObject<Array<{ agentId: string; position: { x: number; y: number }; color: number }>>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, 64, 64);

      const map = mapRef.current;
      if (!map) return;
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const t = map[y][x];
          if (t === "rock") ctx.fillStyle = "#2a2a3a";
          else if (t === "ore_revealed") ctx.fillStyle = "#f5a623";
          else ctx.fillStyle = "#111118";
          ctx.fillRect(x * 2, y * 2, 2, 2);
        }
      }

      const agents = agentsRef.current || [];
      const COLORS = ["#40e8d0","#f5a623","#e84040","#6b7cff","#a0e840","#e840d0","#40a0e8","#e8d040"];
      for (const a of agents) {
        ctx.fillStyle = COLORS[a.color % COLORS.length];
        ctx.fillRect(a.position.x * 2, a.position.y * 2, 2, 2);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [mapRef, agentsRef]);

  return <canvas ref={canvasRef} width={64} height={64} style={{ imageRendering: "pixelated" }} />;
}
