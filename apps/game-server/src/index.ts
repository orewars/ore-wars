import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import { GameEngine } from "./GameEngine";
import { ContractBridge } from "./ContractBridge";
import { ClientMessage } from "./types";

const PORT = parseInt(process.env.PORT || "3001");
const INTERNAL_SECRET = process.env.GAME_SERVER_INTERNAL_SECRET || "dev-secret";

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const bridge = new ContractBridge();
const engine = new GameEngine(wss, bridge);

// WebSocket handling
wss.on("connection", (ws: WebSocket) => {
  console.log("[WS] Client connected");
  engine.registerClient(ws);

  ws.on("message", (data) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());
      if (msg.type === "auth") {
        console.log(`[WS] Auth: agent=${msg.agent_id}`);
        ws.send(JSON.stringify({ type: "auth_ok" }));
      } else if (msg.type === "spectate") {
        // Already registered as client, just acknowledge
        ws.send(JSON.stringify({ type: "auth_ok" }));
      }
    } catch {
      console.error("[WS] Invalid message");
    }
  });

  ws.on("close", () => console.log("[WS] Client disconnected"));
  ws.on("error", (err) => console.error("[WS] Error:", err.message));
});

// Internal API — called by Next.js
function requireInternalSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = req.headers["x-internal-secret"];
  if (secret !== INTERNAL_SECRET) {
    res.status(401).json({ error: "Unauthorized", code: "INVALID_SECRET" });
    return;
  }
  next();
}

// Spawn agent endpoint
app.post("/internal/spawn-agent", requireInternalSecret, async (req, res) => {
  const { agentId, name, walletAddress, strategy } = req.body;
  if (!agentId || !name || !walletAddress || !strategy) {
    res.status(400).json({ error: "Missing required fields", code: "INVALID_INPUT" });
    return;
  }
  try {
    const pos = await engine.spawnAgent(agentId, name, walletAddress, strategy);
    res.json({ success: true, spawnPosition: pos });
  } catch (err) {
    console.error("[spawn-agent] Error:", err);
    res.status(500).json({ error: "Failed to spawn agent", code: "SPAWN_ERROR" });
  }
});

// Action endpoint — called by agent loop
app.post("/internal/action", requireInternalSecret, async (req, res) => {
  const { agentId, action } = req.body;
  if (!agentId || !action) {
    res.status(400).json({ error: "Missing agentId or action", code: "INVALID_INPUT" });
    return;
  }
  try {
    const result = await engine.processAction(agentId, action);
    if (!result.success && result.error?.includes("Rate limit")) {
      res.status(429).json({ error: result.error, code: "RATE_LIMITED" });
      return;
    }
    res.json(result);
  } catch (err) {
    console.error("[action] Error:", err);
    res.status(500).json({ error: "Action processing failed", code: "ACTION_ERROR" });
  }
});

// Game state endpoint
app.get("/internal/state", requireInternalSecret, async (req, res) => {
  const state = engine.getGameState();
  let prizePool = "0.000";
  try {
    prizePool = await bridge.getPrizePool();
  } catch {}
  res.json({ ...state, prizePool });
});

// Leaderboard endpoint
app.get("/internal/leaderboard", requireInternalSecret, (req, res) => {
  res.json({ agents: engine.getLeaderboard() });
});

// Map endpoint
app.get("/internal/map", requireInternalSecret, (req, res) => {
  res.json(engine.getMap());
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", tick: Date.now() });
});

server.listen(PORT, () => {
  console.log(`[OreWars Game Server] Listening on port ${PORT}`);
  console.log(`[OreWars Game Server] WebSocket: ws://localhost:${PORT}/ws`);
});
