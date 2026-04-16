export type TileType = "rock" | "mined" | "ore_revealed" | "empty";

export type Direction = "north" | "south" | "east" | "west";
export type MineTarget = "current" | Direction;

export interface Position {
  x: number;
  y: number;
}

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
  color: number; // 0-7 for sprite color index
}

export interface RockState {
  position: Position;
  type: TileType;
  hasOre: boolean;
  oreAmount: number;
  mined: boolean;
  minedByAgent?: string;
}

export type AgentAction =
  | { action: "move"; direction: Direction }
  | { action: "mine"; target: MineTarget }
  | { action: "scan" }
  | { action: "status" };

export interface ActionResult {
  success: boolean;
  error?: string;
  position?: Position;
  result?: "empty" | "ore";
  amount?: number | null;
  tiles?: ScanTile[];
  ethMined?: number;
  rocksMined?: number;
  energy?: number;
}

export interface ScanTile {
  x: number;
  y: number;
  type: TileType | "agent";
}

export type GameEvent =
  | { kind: "move"; agentId: string; from: Position; to: Position }
  | { kind: "mine"; agentId: string; position: Position; result: "empty" | "ore"; amount?: number }
  | { kind: "spawn"; agentId: string; position: Position }
  | { kind: "death"; agentId: string; reason: string }
  | { kind: "reset"; newEpoch: number };

export type ServerMessage =
  | { type: "snapshot"; map: TileType[][]; agents: AgentState[]; tick: number }
  | { type: "event"; event: GameEvent }
  | { type: "auth_ok" }
  | { type: "auth_error"; message: string };

export type ClientMessage =
  | { type: "auth"; agent_id: string; token: string }
  | { type: "spectate" };

export interface GameState {
  activeAgents: number;
  rocksRemaining: number;
  prizePool: string;
  totalMined: string;
  mapEpoch: number;
}

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  name: string;
  ownerAddress: string;
  ethMined: string;
  rocksMined: number;
  status: "ACTIVE" | "IDLE" | "ELIMINATED";
}

export interface DeployAgentRequest {
  name: string;
  walletAddress: string;
  anthropicApiKey: string;
  strategy: "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE";
  maxEthSpend: number;
}

export interface DeployAgentResponse {
  agentId: string;
  spawnPosition: Position;
  streamUrl: string;
}

export interface AgentEvent {
  type: "action" | "thought" | "error";
  tool?: string;
  input?: Record<string, unknown>;
  result?: ActionResult;
  message?: string;
  timestamp: number;
}

export interface MapData {
  tiles: TileType[][];
  agents: AgentState[];
  epoch: number;
}
