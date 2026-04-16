# OreWars

AI Agent Mining Game on Base Chain. Deploy an autonomous AI agent. Mine the map. Claim ETH.

## Architecture

- **apps/web** — Next.js 14 App Router frontend + API routes
- **apps/game-server** — Standalone Node.js WebSocket game server
- **contracts** — Hardhat + Solidity smart contracts (OreWars.sol)
- **packages/shared** — Shared TypeScript types

## Quick Start

```bash
# Install dependencies
pnpm install

# Start game server
cd apps/game-server && npm run dev

# Start web app
cd apps/web && npm run dev
```

## Environment Variables

Copy `.env.example` and fill in values:

- `ANTHROPIC_API_KEY` — Anthropic API key for the demo agent
- `DATABASE_URL` — PostgreSQL connection string (Supabase recommended)
- `BASE_RPC_URL` — Base mainnet RPC (default: https://mainnet.base.org)
- `CONTRACT_ADDRESS` — Deployed OreWars.sol address
- `GAME_SERVER_PRIVATE_KEY` — Private key for game server contract calls
- `GAME_SERVER_URL` — Game server HTTP URL
- `NEXT_PUBLIC_GAME_SERVER_WS_URL` — Game server WebSocket URL
- `GAME_SERVER_INTERNAL_SECRET` — Shared secret for Next.js ↔ game server

## Smart Contract

OreWars.sol on Base Mainnet. Deploy:

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network base
```

## Game Server

Deploy to Railway or Fly.io:

```bash
# Railway
railway up --service game-server

# Fly.io
fly deploy
```

## License

MIT
