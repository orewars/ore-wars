export const MAP_SIZE = 32;
export const TILE_SIZE = 16;
export const TICK_RATE_MS = 500;
export const MAX_ENERGY = 100;
export const ENERGY_REGEN_PER_TICK = 1;
export const MAX_ACTIONS_PER_SECOND = 2;
export const MAX_CONCURRENT_AGENTS = 8;
export const SCAN_RADIUS = 2; // 5x5 = radius 2 from center
export const MAP_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const ORE_CLUSTER_COUNT = 4;
export const ORE_CLUSTER_RADIUS = 3;
export const MIN_ORE_AMOUNT_ETH = 0.001;
export const MAX_ORE_AMOUNT_ETH = 0.1;
export const JACKPOT_THRESHOLD_ETH = 0.02;
export const AGENT_COLORS = [
  "#40e8d0", // teal
  "#f5a623", // gold
  "#e84040", // red
  "#6b7cff", // blue
  "#a0e840", // green
  "#e840d0", // magenta
  "#40a0e8", // cyan
  "#e8d040", // yellow
];
export const CONTRACT_ABI = [
  {
    "inputs": [{"internalType": "address","name": "_gameServer","type": "address"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AgentNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientPool",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotGameServer",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "RockAlreadyMined",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TransferFailed",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [{"indexed": true,"internalType": "string","name": "agentId","type": "string"},{"indexed": true,"internalType": "address","name": "owner","type": "address"}],
    "name": "AgentRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{"indexed": true,"internalType": "uint256","name": "newEpoch","type": "uint256"}],
    "name": "MapReset",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{"indexed": true,"internalType": "address","name": "from","type": "address"},{"indexed": false,"internalType": "uint256","name": "amount","type": "uint256"}],
    "name": "PoolFunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{"indexed": true,"internalType": "string","name": "agentId","type": "string"},{"indexed": false,"internalType": "uint256","name": "x","type": "uint256"},{"indexed": false,"internalType": "uint256","name": "y","type": "uint256"},{"indexed": false,"internalType": "bool","name": "hadOre","type": "bool"},{"indexed": false,"internalType": "uint256","name": "amount","type": "uint256"}],
    "name": "RockMined",
    "type": "event"
  },
  {
    "inputs": [{"internalType": "string","name": "agentId","type": "string"},{"internalType": "uint256","name": "x","type": "uint256"},{"internalType": "uint256","name": "y","type": "uint256"}],
    "name": "claimOre",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string","name": "agentId","type": "string"}],
    "name": "getAgent",
    "outputs": [{"components": [{"internalType": "address","name": "owner","type": "address"},{"internalType": "string","name": "agentId","type": "string"},{"internalType": "uint256","name": "totalMined","type": "uint256"},{"internalType": "uint256","name": "rocksMined","type": "uint256"},{"internalType": "bool","name": "active","type": "bool"}],"internalType": "struct OreWars.Agent","name": "","type": "tuple"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256","name": "x","type": "uint256"},{"internalType": "uint256","name": "y","type": "uint256"}],
    "name": "getRock",
    "outputs": [{"components": [{"internalType": "bool","name": "hasOre","type": "bool"},{"internalType": "uint256","name": "oreAmount","type": "uint256"},{"internalType": "bool","name": "mined","type": "bool"},{"internalType": "string","name": "minedByAgent","type": "string"}],"internalType": "struct OreWars.Rock","name": "","type": "tuple"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "mapEpoch",
    "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "stateMutability": "view",
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
    "inputs": [{"internalType": "string","name": "agentId","type": "string"},{"internalType": "address","name": "owner","type": "address"}],
    "name": "registerAgent",
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
    "inputs": [{"internalType": "uint256","name": "x","type": "uint256"},{"internalType": "uint256","name": "y","type": "uint256"},{"internalType": "bool","name": "hasOre","type": "bool"},{"internalType": "uint256","name": "oreAmount","type": "uint256"}],
    "name": "seedRock",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address","name": "_gameServer","type": "address"}],
    "name": "setGameServer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256","name": "amount","type": "uint256"}],
    "name": "withdrawUnused",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
] as const;
