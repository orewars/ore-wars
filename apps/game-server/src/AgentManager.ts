import { AgentState, Position } from "./types";

const MAP_SIZE = 32;
const MAX_ENERGY = 100;
const AGENT_COLORS = 8;

export class AgentManager {
  private agents = new Map<string, AgentState>();
  private positionMap = new Map<string, string>(); // "x,y" -> agentId
  private colorIndex = 0;

  private posKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  spawn(agentId: string, name: string, ownerAddress: string, strategy: AgentState["strategy"]): Position {
    // Find empty spawn position
    let pos: Position;
    let attempts = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * MAP_SIZE),
        y: Math.floor(Math.random() * MAP_SIZE),
      };
      attempts++;
    } while (this.positionMap.has(this.posKey(pos.x, pos.y)) && attempts < 100);

    const agent: AgentState = {
      agentId,
      name,
      ownerAddress,
      position: pos,
      energy: MAX_ENERGY,
      ethMined: 0,
      rocksMined: 0,
      status: "ACTIVE",
      strategy,
      color: this.colorIndex % AGENT_COLORS,
      lastActionAt: Date.now(),
    };

    this.colorIndex++;
    this.agents.set(agentId, agent);
    this.positionMap.set(this.posKey(pos.x, pos.y), agentId);
    return pos;
  }

  get(agentId: string): AgentState | undefined {
    return this.agents.get(agentId);
  }

  getAll(): AgentState[] {
    return Array.from(this.agents.values());
  }

  updatePosition(agentId: string, newPos: Position): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    this.positionMap.delete(this.posKey(agent.position.x, agent.position.y));
    agent.position = newPos;
    this.positionMap.set(this.posKey(newPos.x, newPos.y), agentId);
  }

  deductEnergy(agentId: string, amount = 1): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || agent.energy < amount) return false;
    agent.energy -= amount;
    return true;
  }

  regenerateEnergy(): void {
    for (const agent of this.agents.values()) {
      if (agent.status === "ACTIVE" && agent.energy < MAX_ENERGY) {
        agent.energy = Math.min(MAX_ENERGY, agent.energy + 1);
      }
    }
  }

  recordMine(agentId: string, ethAmount: number): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.rocksMined++;
    agent.ethMined += ethAmount;
  }

  setStatus(agentId: string, status: AgentState["status"]): void {
    const agent = this.agents.get(agentId);
    if (agent) agent.status = status;
  }

  isPositionOccupied(x: number, y: number): boolean {
    return this.positionMap.has(this.posKey(x, y));
  }

  getAgentAtPosition(x: number, y: number): string | undefined {
    return this.positionMap.get(this.posKey(x, y));
  }

  updateLastAction(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) agent.lastActionAt = Date.now();
  }

  remove(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    this.positionMap.delete(this.posKey(agent.position.x, agent.position.y));
    this.agents.delete(agentId);
  }
}
