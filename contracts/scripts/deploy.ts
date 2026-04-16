import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying OreWars with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // The game server address must be set — use deployer as placeholder, update after game server deploy
  const gameServerAddress = process.env.GAME_SERVER_ADDRESS || deployer.address;
  console.log("Game server address:", gameServerAddress);

  const OreWars = await ethers.getContractFactory("OreWars");
  const oreWars = await OreWars.deploy(gameServerAddress);
  await oreWars.waitForDeployment();

  const address = await oreWars.getAddress();
  console.log("OreWars deployed to:", address);
  console.log("Update CONTRACT_ADDRESS in your .env.local and Vercel env vars.");
  console.log("Basescan:", `https://basescan.org/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
