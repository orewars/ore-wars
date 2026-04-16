import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const CONTRACT_ABI = [
  {
    "inputs": [{"internalType": "string","name": "agentId","type": "string"},{"internalType": "address","name": "owner","type": "address"}],
    "name": "registerAgent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256","name": "x","type": "uint256"},{"internalType": "uint256","name": "y","type": "uint256"},{"internalType": "bool","name": "hasOre","type": "bool"},{"internalType": "uint256","name": "oreAmount","type": "uint256"}],
    "name": "seedRock",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string","name": "agentId","type": "string"},{"internalType": "uint256","name": "x","type": "uint256"},{"internalType": "uint256","name": "y","type": "uint256"}],
    "name": "claimOre",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "resetMap",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "prizePool",
    "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "mapEpoch",
    "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export class ContractBridge {
  private walletClient: ReturnType<typeof createWalletClient>;
  private publicClient: ReturnType<typeof createPublicClient>;
  private contractAddress: `0x${string}`;
  private enabled: boolean;

  constructor() {
    const privateKey = process.env.GAME_SERVER_PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!privateKey || !contractAddress) {
      console.warn("[ContractBridge] Missing GAME_SERVER_PRIVATE_KEY or CONTRACT_ADDRESS — contract calls disabled");
      this.enabled = false;
      this.contractAddress = "0x0000000000000000000000000000000000000000";
      // Create dummy clients
      this.walletClient = createWalletClient({ chain: base, transport: http() });
      this.publicClient = createPublicClient({ chain: base, transport: http() });
      return;
    }

    this.enabled = true;
    this.contractAddress = contractAddress as `0x${string}`;
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";

    this.walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    });
  }

  async registerAgent(agentId: string, ownerAddress: `0x${string}`): Promise<void> {
    if (!this.enabled) { console.log(`[ContractBridge] MOCK registerAgent: ${agentId}`); return; }
    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: CONTRACT_ABI,
      functionName: "registerAgent",
      args: [agentId, ownerAddress],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    console.log(`[ContractBridge] Agent registered on-chain: ${agentId} tx=${hash}`);
  }

  async seedRocks(rocks: Array<{ x: number; y: number; oreAmount: number }>): Promise<void> {
    if (!this.enabled) { console.log(`[ContractBridge] MOCK seedRocks: ${rocks.length} rocks`); return; }
    for (const rock of rocks) {
      const oreAmountWei = parseEther(rock.oreAmount.toFixed(18));
      const hash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: CONTRACT_ABI,
        functionName: "seedRock",
        args: [BigInt(rock.x), BigInt(rock.y), true, oreAmountWei],
      });
      await this.publicClient.waitForTransactionReceipt({ hash });
    }
    console.log(`[ContractBridge] Seeded ${rocks.length} ore rocks`);
  }

  async claimOre(agentId: string, x: number, y: number): Promise<`0x${string}` | null> {
    if (!this.enabled) {
      console.log(`[ContractBridge] MOCK claimOre: agent=${agentId} pos=(${x},${y})`);
      return null;
    }
    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: CONTRACT_ABI,
      functionName: "claimOre",
      args: [agentId, BigInt(x), BigInt(y)],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    console.log(`[ContractBridge] Ore claimed: agent=${agentId} tx=${hash}`);
    return hash;
  }

  async resetMap(): Promise<void> {
    if (!this.enabled) { console.log("[ContractBridge] MOCK resetMap"); return; }
    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: CONTRACT_ABI,
      functionName: "resetMap",
      args: [],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    console.log(`[ContractBridge] Map reset on-chain: tx=${hash}`);
  }

  async getPrizePool(): Promise<string> {
    if (!this.enabled) return "0.000";
    const pool = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: CONTRACT_ABI,
      functionName: "prizePool",
    });
    return formatEther(pool as bigint);
  }

  async getMapEpoch(): Promise<number> {
    if (!this.enabled) return 1;
    const epoch = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: CONTRACT_ABI,
      functionName: "mapEpoch",
    });
    return Number(epoch);
  }
}
