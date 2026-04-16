import { createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});

const PRIZE_POOL_ABI = [
  {
    "inputs": [],
    "name": "prizePool",
    "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export async function getPrizePool(contractAddress: `0x${string}`): Promise<string> {
  try {
    const pool = await publicClient.readContract({
      address: contractAddress,
      abi: PRIZE_POOL_ABI,
      functionName: "prizePool",
    });
    return formatEther(pool as bigint);
  } catch {
    return "0.000";
  }
}
