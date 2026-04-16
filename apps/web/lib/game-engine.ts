// Game engine singleton — runs in Next.js process memory
// State resets on cold start (acceptable for MVP)

import { createWalletClient, createPublicClient, http, formatEther } from "viem"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const MAP_SIZE = 32;
const TICK_RATE_MS = 500;
const MAX_ENERGY = 100;
const MAX_ACTIONS_PER_SECOND = 2;

export type TileType = "rock" | "mined" | "ore_revealed" | "empty";
export type Direction = "north" | "south" | "east" | "west";

export interface Position { x: number; y: number; }

export interface AgentState {
  agentId: string;
  name: string;
  ownerAddress: string;
  position: Position;
  energy: number;
  ethMined: number;
  rocksMined: number;
  status: "ACTIVE" | "IDLE" | "ELIMINATED";
  strategy: "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE";
  color: number;
  lastActionAt: number;
}

export interface RockData {
  hasOre: boolean;
  oreAmount: number; // ETH
  mined: boolean;
  minedByAgent?: string;
}

export interface GameEvent {
  kind: string;
  agentId?: string;
  from?: Position;
  to?: Position;
  position?: Position;
  result?: "empty" | "ore";
  amount?: number;
  newEpoch?: number;
  timestamp: number;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  position?: Position;
  result?: "empty" | "ore";
  amount?: number | null;
  tiles?: Array<{ x: number; y: number; type: string }>;
  ethMined?: number;
  rocksMined?: number;
  energy?: number;
}

// SSE subscriber
type EventSubscriber = (event: GameEvent) => void;

class GameEngine {
  private grid: Array<Array<{ type: TileType; rock?: RockData }>> = [];
  private agents = new Map<string, AgentState>();
  private positionMap = new Map<string, string>(); // "x,y" -> agentId
  private rateLimits = new Map<string, { count: number; windowStart: number }>();
  private subscribers = new Set<EventSubscriber>();
  private tick = 0;
  private mapEpoch = 1;
  private totalEthMined = 0;
  private colorIndex = 0;
  private initialized = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private walletClient: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private publicClient: any = null;
  private contractAddress: `0x${string}` | null = null;

  private CONTRACT_ABI = [
    { "inputs": [{"internalType": "string","name": "agentId","type": "string"},{"internalType": "address","name": "owner","type": "address"}], "name": "registerAgent", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{"internalType": "uint256","name": "x","type": "uint256"},{"internalType": "uint256","name": "y","type": "uint256"},{"internalType": "bool","name": "hasOre","type": "bool"},{"internalType": "uint256","name": "oreAmount","type": "uint256"}], "name": "seedRock", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{"internalType": "string","name": "agentId","type": "string"},{"internalType": "uint256","name": "x","type": "uint256"},{"internalType": "uint256","name": "y","type": "uint256"}], "name": "claimOre", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "prizePool", "outputs": [{"internalType": "uint256","name": "","type": "uint256"}], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "mapEpoch", "outputs": [{"internalType": "uint256","name": "","type": "uint256"}], "stateMutability": "view", "type": "function" }
  ] as const;

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.generateMap();
    this.initViem();
    setInterval(() => this.tickLoop(), TICK_RATE_MS);
    console.log("[GameEngine] Initialized, map generated, tick loop started");
  }

  private initViem() {
    const pk = process.env.GAME_SERVER_PRIVATE_KEY;
    const contractAddr = process.env.CONTRACT_ADDRESS;
    if (!pk || !contractAddr || pk.length < 10) {
      console.warn("[GameEngine] No GAME_SERVER_PRIVATE_KEY or CONTRACT_ADDRESS — contract calls disabled");
      return;
    }
    try {
      const account = privateKeyToAccount(pk as `0x${string}`);
      const rpc = process.env.BASE_RPC_URL || "https://mainnet.base.org";
      this.walletClient = createWalletClient({ account, chain: base, transport: http(rpc) });
      this.publicClient = createPublicClient({ chain: base, transport: http(rpc) });
      this.contractAddress = contractAddr as `0x${string}`;
      console.log("[GameEngine] Viem initialized, contract:", contractAddr);
    } catch (e) {
      console.error("[GameEngine] Viem init error:", e);
    }
  }

  private generateMap() {
    this.grid = Array.from({ length: MAP_SIZE }, () =>
      Array.from({ length: MAP_SIZE }, () => ({
        type: "rock" as TileType,
        rock: { hasOre: false, oreAmount: 0, mined: false } as RockData,
      }))
    );

    // 2 rare ore clusters — small, tight, hard to find
    const clusters = 2;
    for (let c = 0; c < clusters; c++) {
      const cx = Math.max(3, Math.min(MAP_SIZE - 4, Math.floor(this.gaussianRandom(MAP_SIZE / 2, MAP_SIZE / 4))));
      const cy = Math.max(3, Math.min(MAP_SIZE - 4, Math.floor(this.gaussianRandom(MAP_SIZE / 2, MAP_SIZE / 4))));
      // Only 2-4 ore tiles per cluster — very tight
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const ox = Math.max(0, Math.min(MAP_SIZE - 1, Math.round(this.gaussianRandom(cx, 1.5))));
        const oy = Math.max(0, Math.min(MAP_SIZE - 1, Math.round(this.gaussianRandom(cy, 1.5))));
        const amount = this.pickOreAmount();
        this.grid[oy][ox].rock = { hasOre: true, oreAmount: amount, mined: false };
      }
    }
    console.log("[GameEngine] Map generated with ore clusters");
  }

  private gaussianRandom(mean: number, std: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private pickOreAmount(): number {
    // Rare, small amounts — max 0.001 ETH
    const r = Math.random();
    if (r < 0.75) return 0.00005 + Math.random() * 0.0002;  // tiny common ore
    if (r < 0.97) return 0.0002  + Math.random() * 0.0005;  // medium ore
    return 0.0008 + Math.random() * 0.0002;                  // ~0.001 ETH jackpot
  }

  private tickLoop() {
    this.tick++;
    // Regen energy for all agents
    this.agents.forEach((agent) => {
      if (agent.status === "ACTIVE" && agent.energy < MAX_ENERGY) {
        agent.energy = Math.min(MAX_ENERGY, agent.energy + 1);
      }
    });
    // Check map reset (all ore mined or 24h)
    const oreLeft = this.getOreRocksRemaining();
    if (oreLeft === 0 && this.agents.size > 0) {
      this.resetMap();
    }
  }

  private resetMap() {
    this.mapEpoch++;
    this.generateMap();
    this.broadcastEvent({ kind: "reset", newEpoch: this.mapEpoch, timestamp: Date.now() });
    if (this.walletClient && this.contractAddress) {
      this.walletClient.writeContract({
        address: this.contractAddress,
        abi: this.CONTRACT_ABI,
        functionName: "resetMap" as never,
        args: [],
      }).catch(console.error);
    }
  }

  // SSE pub/sub
  subscribe(fn: EventSubscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private broadcastEvent(event: GameEvent) {
    this.subscribers.forEach((sub) => {
      try { sub(event); } catch {}
    });
  }

  private posKey(x: number, y: number) { return `${x},${y}`; }

  spawnAgent(agentId: string, name: string, ownerAddress: string, strategy: AgentState["strategy"]): Position {
    let pos: Position;
    let attempts = 0;
    do {
      pos = { x: Math.floor(Math.random() * MAP_SIZE), y: Math.floor(Math.random() * MAP_SIZE) };
      attempts++;
    } while (this.positionMap.has(this.posKey(pos.x, pos.y)) && attempts < 200);

    const agent: AgentState = {
      agentId, name, ownerAddress, position: pos,
      energy: MAX_ENERGY, ethMined: 0, rocksMined: 0,
      status: "ACTIVE", strategy,
      color: this.colorIndex++ % 8,
      lastActionAt: Date.now(),
    };
    this.agents.set(agentId, agent);
    this.positionMap.set(this.posKey(pos.x, pos.y), agentId);
    this.broadcastEvent({ kind: "spawn", agentId, position: pos, timestamp: Date.now() });

    // Register on contract
    if (this.walletClient && this.contractAddress) {
      this.walletClient.writeContract({
        address: this.contractAddress,
        abi: this.CONTRACT_ABI,
        functionName: "registerAgent",
        args: [agentId, ownerAddress as `0x${string}`],
      }).catch((e: unknown) => console.warn("[GameEngine] registerAgent contract error:", (e as Error).message));
    }

    return pos;
  }

  private checkRateLimit(agentId: string): boolean {
    const now = Date.now();
    let e = this.rateLimits.get(agentId);
    if (!e || now - e.windowStart > 1000) {
      e = { count: 0, windowStart: now };
      this.rateLimits.set(agentId, e);
    }
    if (e.count >= MAX_ACTIONS_PER_SECOND) return false;
    e.count++;
    return true;
  }

  async processAction(agentId: string, action: { action: string; direction?: string; target?: string }): Promise<ActionResult> {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: "Agent not found" };
    if (agent.status !== "ACTIVE") return { success: false, error: `Agent is ${agent.status}` };
    if (!this.checkRateLimit(agentId)) return { success: false, error: "Rate limit exceeded: 2 actions per second" };

    agent.lastActionAt = Date.now();

    if (action.action === "status") {
      return { success: true, position: agent.position, ethMined: agent.ethMined, rocksMined: agent.rocksMined, energy: agent.energy };
    }
    if (action.action === "scan") {
      return { success: true, tiles: this.scan(agent.position) };
    }
    if (action.action === "move") {
      return this.processMove(agentId, action.direction || "north");
    }
    if (action.action === "mine") {
      return await this.processMine(agentId, action.target || "current");
    }
    return { success: false, error: "Unknown action: " + action.action };
  }

  private dirOffset(dir: string): [number, number] {
    switch (dir) {
      case "north": return [0, -1];
      case "south": return [0, 1];
      case "east":  return [1, 0];
      case "west":  return [-1, 0];
      default: return [0, 0];
    }
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE;
  }

  private processMove(agentId: string, direction: string): ActionResult {
    const agent = this.agents.get(agentId)!;
    if (agent.energy < 1) return { success: false, error: "Insufficient energy" };

    const [dx, dy] = this.dirOffset(direction);
    const nx = agent.position.x + dx;
    const ny = agent.position.y + dy;

    if (!this.inBounds(nx, ny)) return { success: false, error: "Cannot move: out of bounds" };
    if (this.positionMap.has(this.posKey(nx, ny))) return { success: false, error: "Cannot move: tile occupied by another agent" };

    const tile = this.grid[ny][nx];
    if (tile.type === "rock") return { success: false, error: "Cannot move into unmined rock — mine it first" };

    agent.energy--;
    const from = { ...agent.position };
    this.positionMap.delete(this.posKey(from.x, from.y));
    agent.position = { x: nx, y: ny };
    this.positionMap.set(this.posKey(nx, ny), agentId);

    this.broadcastEvent({ kind: "move", agentId, from, to: { x: nx, y: ny }, timestamp: Date.now() });
    return { success: true, position: agent.position };
  }

  private async processMine(agentId: string, target: string): Promise<ActionResult> {
    const agent = this.agents.get(agentId)!;
    if (agent.energy < 1) return { success: false, error: "Insufficient energy" };

    let mx = agent.position.x;
    let my = agent.position.y;
    if (target !== "current") {
      const [dx, dy] = this.dirOffset(target);
      mx += dx; my += dy;
    }
    if (!this.inBounds(mx, my)) return { success: false, error: "Target out of bounds" };

    const tile = this.grid[my][mx];
    if (!tile.rock || tile.rock.mined) return { success: false, error: "Rock already mined at this position" };
    if (tile.type === "mined") return { success: false, error: "Rock already mined" };

    agent.energy--;
    tile.rock.mined = true;
    tile.rock.minedByAgent = agentId;
    tile.type = "mined";
    agent.rocksMined++;

    let result: "empty" | "ore" = "empty";
    let ethAmount = 0;

    if (tile.rock.hasOre && tile.rock.oreAmount > 0) {
      result = "ore";
      ethAmount = tile.rock.oreAmount;
      agent.ethMined += ethAmount;
      this.totalEthMined += ethAmount;
      tile.type = "ore_revealed";

      // Call contract
      if (this.walletClient && this.contractAddress) {
        try {
          const hash = await this.walletClient.writeContract({
            address: this.contractAddress,
            abi: this.CONTRACT_ABI,
            functionName: "claimOre",
            args: [agentId, BigInt(mx), BigInt(my)],
          });
          console.log(`[GameEngine] claimOre tx: ${hash} for agent ${agentId}`);
        } catch (e) {
          console.warn("[GameEngine] claimOre failed:", (e as Error).message);
        }
      }
    }

    this.broadcastEvent({ kind: "mine", agentId, position: { x: mx, y: my }, result, amount: result === "ore" ? ethAmount : undefined, timestamp: Date.now() });
    return { success: true, result, amount: result === "ore" ? ethAmount : null };
  }

  private scan(from: Position): Array<{ x: number; y: number; type: string }> {
    const tiles = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = from.x + dx, y = from.y + dy;
        if (!this.inBounds(x, y)) continue;
        const agentAt = this.positionMap.get(this.posKey(x, y));
        tiles.push({ x, y, type: agentAt ? "agent" : this.grid[y][x].type });
      }
    }
    return tiles;
  }

  getOreRocksRemaining(): number {
    let count = 0;
    for (let y = 0; y < MAP_SIZE; y++)
      for (let x = 0; x < MAP_SIZE; x++)
        if (this.grid[y][x].rock?.hasOre && !this.grid[y][x].rock?.mined) count++;
    return count;
  }

  getRocksRemaining(): number {
    let count = 0;
    for (let y = 0; y < MAP_SIZE; y++)
      for (let x = 0; x < MAP_SIZE; x++)
        if (this.grid[y][x].type === "rock") count++;
    return count;
  }

  getMapTileTypes(): TileType[][] {
    return this.grid.map(row => row.map(cell => cell.type));
  }

  getAgents(): AgentState[] { return Array.from(this.agents.values()); }
  getAgent(agentId: string): AgentState | undefined { return this.agents.get(agentId); }
  getTick(): number { return this.tick; }
  getMapEpoch(): number { return this.mapEpoch; }
  getTotalEthMined(): number { return this.totalEthMined; }

  async getPrizePool(): Promise<string> {
    if (!this.publicClient || !this.contractAddress) return "0.000";
    try {
      const pool = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: this.CONTRACT_ABI,
        functionName: "prizePool",
      });
      return formatEther(pool as bigint);
    } catch { return "0.000"; }
  }

  getLeaderboard() {
    return this.getAgents()
      .sort((a, b) => b.ethMined - a.ethMined)
      .slice(0, 20)
      .map((a, i) => ({
        rank: i + 1,
        agentId: a.agentId,
        name: a.name,
        ownerAddress: a.ownerAddress,
        ethMined: a.ethMined.toFixed(6),
        rocksMined: a.rocksMined,
        status: a.status,
      }));
  }
}

// Singleton — survives across Next.js hot reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var __gameEngine: GameEngine | undefined;
}

export function getGameEngine(): GameEngine {
  if (!global.__gameEngine) {
    global.__gameEngine = new GameEngine();
    global.__gameEngine.init();
  }
  return global.__gameEngine;
}
