export type TileType = "rock" | "mined" | "ore_revealed" | "empty";
export type Direction = "north" | "south" | "east" | "west";
export type MineTarget = "current" | Direction;

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

export interface RockState {
  hasOre: boolean;
  oreAmount: number; // in ETH
  mined: boolean;
  minedByAgent?: string;
}

export interface MapTile {
  type: TileType;
  rock?: RockState;
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
  | { kind: "move"; agentId: string; from: Position; to: Position; timestamp: number }
  | { kind: "mine"; agentId: string; position: Position; result: "empty" | "ore"; amount?: number; timestamp: number }
  | { kind: "spawn"; agentId: string; position: Position; timestamp: number }
  | { kind: "death"; agentId: string; reason: string; timestamp: number }
  | { kind: "reset"; newEpoch: number; timestamp: number };

export type ServerMessage =
  | { type: "snapshot"; map: TileType[][]; agents: AgentState[]; tick: number }
  | { type: "event"; event: GameEvent }
  | { type: "auth_ok" }
  | { type: "auth_error"; message: string };

export type ClientMessage =
  | { type: "auth"; agent_id: string; token: string }
  | { type: "spectate" };
