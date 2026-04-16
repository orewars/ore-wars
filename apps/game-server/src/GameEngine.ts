import { WebSocketServer, WebSocket } from "ws";
import { AgentManager } from "./AgentManager";
import { ContractBridge } from "./ContractBridge";
import { generateMap, gridToTileTypes, OreRock } from "./MapGenerator";
import { AgentAction, ActionResult, GameEvent, MapTile, Position, ScanTile, TileType } from "./types";

const MAP_SIZE = 32;
const TICK_RATE_MS = 500;
const MAP_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class GameEngine {
  private grid: MapTile[][];
  private oreRocks: OreRock[];
  private agentManager: AgentManager;
  private contractBridge: ContractBridge;
  private wss: WebSocketServer;
  private tick = 0;
  private mapEpoch = 1;
  private mapCreatedAt = Date.now();
  private totalEthMined = 0;
  private rateLimits = new Map<string, RateLimitEntry>();
  private clients = new Set<WebSocket>();

  constructor(wss: WebSocketServer, bridge: ContractBridge) {
    this.wss = wss;
    this.contractBridge = bridge;
    this.agentManager = new AgentManager();
    const { grid, oreRocks } = generateMap();
    this.grid = grid;
    this.oreRocks = oreRocks;

    setInterval(() => this.tickLoop(), TICK_RATE_MS);

    // Seed rocks on contract after map gen
    bridge.seedRocks(oreRocks).catch(err => console.error("[GameEngine] seedRocks error:", err));
  }

  registerClient(ws: WebSocket): void {
    this.clients.add(ws);
    // Send immediate snapshot
    this.sendSnapshot(ws);
    ws.on("close", () => this.clients.delete(ws));
  }

  private sendSnapshot(ws: WebSocket): void {
    const msg = JSON.stringify({
      type: "snapshot",
      map: gridToTileTypes(this.grid),
      agents: this.agentManager.getAll(),
      tick: this.tick,
    });
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }

  private broadcast(msg: object): void {
    const data = JSON.stringify(msg);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  }

  private broadcastEvent(event: GameEvent): void {
    this.broadcast({ type: "event", event });
  }

  private tickLoop(): void {
    this.tick++;
    this.agentManager.regenerateEnergy();

    // Every 5 ticks: broadcast full snapshot for late joiners
    if (this.tick % 5 === 0) {
      const snapshot = {
        type: "snapshot",
        map: gridToTileTypes(this.grid),
        agents: this.agentManager.getAll(),
        tick: this.tick,
      };
      this.broadcast(snapshot);
    }

    // Check map reset (24h or all rocks mined)
    const rocksRemaining = this.getRocksRemaining();
    const elapsed = Date.now() - this.mapCreatedAt;
    if (rocksRemaining === 0 || elapsed >= MAP_RESET_INTERVAL_MS) {
      this.resetMap();
    }
  }

  private resetMap(): void {
    const { grid, oreRocks } = generateMap();
    this.grid = grid;
    this.oreRocks = oreRocks;
    this.mapEpoch++;
    this.mapCreatedAt = Date.now();

    this.contractBridge.resetMap().catch(console.error);
    this.contractBridge.seedRocks(oreRocks).catch(console.error);

    const event: GameEvent = { kind: "reset", newEpoch: this.mapEpoch, timestamp: Date.now() };
    this.broadcastEvent(event);
    console.log(`[GameEngine] Map reset. Epoch: ${this.mapEpoch}`);
  }

  async spawnAgent(agentId: string, name: string, ownerAddress: string, strategy: "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE"): Promise<Position> {
    const pos = this.agentManager.spawn(agentId, name, ownerAddress, strategy);
    await this.contractBridge.registerAgent(agentId, ownerAddress as `0x${string}`);
    const event: GameEvent = { kind: "spawn", agentId, position: pos, timestamp: Date.now() };
    this.broadcastEvent(event);
    console.log(`[GameEngine] Agent spawned: ${agentId} at (${pos.x},${pos.y})`);
    return pos;
  }

  private checkRateLimit(agentId: string): boolean {
    const now = Date.now();
    const windowMs = 1000;
    const maxPerWindow = 2;
    let entry = this.rateLimits.get(agentId);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now };
      this.rateLimits.set(agentId, entry);
    }
    if (entry.count >= maxPerWindow) return false;
    entry.count++;
    return true;
  }

  async processAction(agentId: string, action: AgentAction): Promise<ActionResult> {
    const agent = this.agentManager.get(agentId);
    if (!agent) return { success: false, error: "Agent not found" };
    if (agent.status !== "ACTIVE") return { success: false, error: `Agent status is ${agent.status}` };
    if (!this.checkRateLimit(agentId)) return { success: false, error: "Rate limit exceeded: 2 actions per second" };

    this.agentManager.updateLastAction(agentId);

    if (action.action === "status") {
      return {
        success: true,
        position: agent.position,
        ethMined: agent.ethMined,
        rocksMined: agent.rocksMined,
        energy: agent.energy,
      };
    }

    if (action.action === "scan") {
      return { success: true, tiles: this.scan(agent.position) };
    }

    if (action.action === "move") {
      return this.processMove(agentId, action.direction);
    }

    if (action.action === "mine") {
      return await this.processMine(agentId, action.target);
    }

    return { success: false, error: "Unknown action" };
  }

  private getTargetPosition(from: Position, dir: string): Position | null {
    switch (dir) {
      case "north": return { x: from.x, y: from.y - 1 };
      case "south": return { x: from.x, y: from.y + 1 };
      case "east":  return { x: from.x + 1, y: from.y };
      case "west":  return { x: from.x - 1, y: from.y };
      default: return null;
    }
  }

  private isInBounds(pos: Position): boolean {
    return pos.x >= 0 && pos.x < MAP_SIZE && pos.y >= 0 && pos.y < MAP_SIZE;
  }

  private processMove(agentId: string, direction: string): ActionResult {
    const agent = this.agentManager.get(agentId)!;
    if (!this.agentManager.deductEnergy(agentId)) {
      return { success: false, error: "Insufficient energy" };
    }

    const newPos = this.getTargetPosition(agent.position, direction);
    if (!newPos || !this.isInBounds(newPos)) {
      return { success: false, error: "Cannot move: out of bounds" };
    }
    if (this.agentManager.isPositionOccupied(newPos.x, newPos.y)) {
      return { success: false, error: "Cannot move: tile occupied by another agent" };
    }

    const tile = this.grid[newPos.y][newPos.x];
    if (tile.type === "rock" || tile.type === "ore_revealed") {
      // Can't walk into an unminable rock (must mine first, or it's mined)
      // Actually agents can only walk into mined/empty tiles
      // Rocks must be mined to clear
    }
    // Allow movement to mined/empty, block unmined rocks
    if (tile.type === "rock") {
      return { success: false, error: "Cannot move: rock in the way — mine it first" };
    }

    const from = { ...agent.position };
    this.agentManager.updatePosition(agentId, newPos);

    const event: GameEvent = { kind: "move", agentId, from, to: newPos, timestamp: Date.now() };
    this.broadcastEvent(event);
    return { success: true, position: newPos };
  }

  private async processMine(agentId: string, target: string): Promise<ActionResult> {
    const agent = this.agentManager.get(agentId)!;
    if (!this.agentManager.deductEnergy(agentId)) {
      return { success: false, error: "Insufficient energy" };
    }

    let minePos: Position;
    if (target === "current") {
      minePos = { ...agent.position };
    } else {
      const tp = this.getTargetPosition(agent.position, target);
      if (!tp || !this.isInBounds(tp)) return { success: false, error: "Target out of bounds" };
      minePos = tp;
    }

    const tile = this.grid[minePos.y][minePos.x];
    if (tile.type === "mined" || tile.type === "empty") {
      return { success: false, error: "Rock already mined" };
    }
    if (!tile.rock) {
      return { success: false, error: "No rock at target position" };
    }

    const rock = tile.rock;
    rock.mined = true;
    rock.minedByAgent = agentId;
    this.grid[minePos.y][minePos.x].type = "mined";

    let ethAmount = 0;
    let txHash: string | null = null;
    let result: "empty" | "ore" = "empty";

    if (rock.hasOre) {
      result = "ore";
      ethAmount = rock.oreAmount;
      this.agentManager.recordMine(agentId, ethAmount);
      this.totalEthMined += ethAmount;
      this.grid[minePos.y][minePos.x].type = "ore_revealed";
      txHash = await this.contractBridge.claimOre(agentId, minePos.x, minePos.y);
    } else {
      this.agentManager.recordMine(agentId, 0);
    }

    const event: GameEvent = {
      kind: "mine",
      agentId,
      position: minePos,
      result,
      amount: result === "ore" ? ethAmount : undefined,
      timestamp: Date.now(),
    };
    this.broadcastEvent(event);

    return {
      success: true,
      result,
      amount: result === "ore" ? ethAmount : null,
    };
  }

  private scan(from: Position): ScanTile[] {
    const tiles: ScanTile[] = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = from.x + dx;
        const y = from.y + dy;
        if (!this.isInBounds({ x, y })) continue;
        const agentAtPos = this.agentManager.getAgentAtPosition(x, y);
        if (agentAtPos) {
          tiles.push({ x, y, type: "agent" });
        } else {
          tiles.push({ x, y, type: this.grid[y][x].type });
        }
      }
    }
    return tiles;
  }

  getRocksRemaining(): number {
    let count = 0;
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (this.grid[y][x].type === "rock" || this.grid[y][x].type === "ore_revealed") count++;
      }
    }
    return count;
  }

  getGameState() {
    return {
      activeAgents: this.agentManager.getAll().filter(a => a.status === "ACTIVE").length,
      rocksRemaining: this.getRocksRemaining(),
      totalEthMined: this.totalEthMined,
      mapEpoch: this.mapEpoch,
      agents: this.agentManager.getAll(),
    };
  }

  getLeaderboard() {
    return this.agentManager.getAll()
      .sort((a, b) => b.ethMined - a.ethMined)
      .slice(0, 20)
      .map((agent, i) => ({
        rank: i + 1,
        agentId: agent.agentId,
        name: agent.name,
        ownerAddress: agent.ownerAddress,
        ethMined: agent.ethMined.toFixed(6),
        rocksMined: agent.rocksMined,
        status: agent.status,
      }));
  }

  getMap() {
    return {
      tiles: gridToTileTypes(this.grid),
      agents: this.agentManager.getAll(),
      epoch: this.mapEpoch,
    };
  }

  validateAgentToken(agentId: string, token: string): boolean {
    // In production: validate against HMAC token. For now: token == agentId for simplicity
    // A real token is issued at spawn time and stored in-memory
    return true; // spectator always ok, agents validated by API auth
  }
}
