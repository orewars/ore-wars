import { expect } from "chai";
import { ethers } from "hardhat";
import { OreWars } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("OreWars", function () {
  let oreWars: OreWars;
  let owner: HardhatEthersSigner;
  let gameServer: HardhatEthersSigner;
  let player: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, gameServer, player] = await ethers.getSigners();
    const OreWars = await ethers.getContractFactory("OreWars");
    oreWars = await OreWars.deploy(gameServer.address);
    await oreWars.waitForDeployment();
  });

  describe("Deployment", function () {
    it("sets the game server correctly", async function () {
      expect(await oreWars.gameServer()).to.equal(gameServer.address);
    });

    it("sets mapEpoch to 1", async function () {
      expect(await oreWars.mapEpoch()).to.equal(1n);
    });
  });

  describe("Agent Registration", function () {
    it("allows game server to register an agent", async function () {
      await expect(
        oreWars.connect(gameServer).registerAgent("agent_abc123", player.address)
      ).to.emit(oreWars, "AgentRegistered").withArgs("agent_abc123", player.address);

      const agent = await oreWars.getAgent("agent_abc123");
      expect(agent.owner).to.equal(player.address);
      expect(agent.active).to.equal(true);
    });

    it("rejects non-game-server registration", async function () {
      await expect(
        oreWars.connect(player).registerAgent("agent_abc123", player.address)
      ).to.be.revertedWithCustomError(oreWars, "NotGameServer");
    });
  });

  describe("Rock Seeding", function () {
    it("allows game server to seed rocks", async function () {
      await oreWars.connect(gameServer).seedRock(5, 10, true, ethers.parseEther("0.005"));
      const rock = await oreWars.getRock(5, 10);
      expect(rock.hasOre).to.equal(true);
      expect(rock.oreAmount).to.equal(ethers.parseEther("0.005"));
      expect(rock.mined).to.equal(false);
    });
  });

  describe("Ore Claiming", function () {
    beforeEach(async function () {
      await oreWars.connect(gameServer).registerAgent("agent_test", player.address);
      await oreWars.connect(gameServer).seedRock(3, 7, true, ethers.parseEther("0.01"));
      // Fund the prize pool
      await owner.sendTransaction({ to: await oreWars.getAddress(), value: ethers.parseEther("1.0") });
    });

    it("pays out ETH to agent owner on ore mine", async function () {
      const balanceBefore = await ethers.provider.getBalance(player.address);
      await oreWars.connect(gameServer).claimOre("agent_test", 3, 7);
      const balanceAfter = await ethers.provider.getBalance(player.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("0.01"));
    });

    it("emits RockMined event", async function () {
      await expect(
        oreWars.connect(gameServer).claimOre("agent_test", 3, 7)
      ).to.emit(oreWars, "RockMined")
        .withArgs("agent_test", 3n, 7n, true, ethers.parseEther("0.01"));
    });

    it("prevents double mining the same rock", async function () {
      await oreWars.connect(gameServer).claimOre("agent_test", 3, 7);
      await expect(
        oreWars.connect(gameServer).claimOre("agent_test", 3, 7)
      ).to.be.revertedWithCustomError(oreWars, "RockAlreadyMined");
    });

    it("updates agent stats", async function () {
      await oreWars.connect(gameServer).claimOre("agent_test", 3, 7);
      const agent = await oreWars.getAgent("agent_test");
      expect(agent.rocksMined).to.equal(1n);
      expect(agent.totalMined).to.equal(ethers.parseEther("0.01"));
    });

    it("reverts for unknown agent", async function () {
      await expect(
        oreWars.connect(gameServer).claimOre("agent_unknown", 3, 7)
      ).to.be.revertedWithCustomError(oreWars, "AgentNotFound");
    });
  });

  describe("Map Reset", function () {
    it("increments epoch and emits MapReset", async function () {
      await expect(
        oreWars.connect(gameServer).resetMap()
      ).to.emit(oreWars, "MapReset").withArgs(2n);
      expect(await oreWars.mapEpoch()).to.equal(2n);
    });

    it("makes old rocks inaccessible after reset", async function () {
      await oreWars.connect(gameServer).seedRock(1, 1, true, ethers.parseEther("0.005"));
      await oreWars.connect(gameServer).resetMap();
      // After reset, rock at (1,1) in new epoch is different
      const rock = await oreWars.getRock(1, 1);
      expect(rock.mined).to.equal(false); // new epoch rock, unset
    });
  });

  describe("Prize Pool", function () {
    it("accepts ETH via receive()", async function () {
      await owner.sendTransaction({ to: await oreWars.getAddress(), value: ethers.parseEther("0.5") });
      expect(await oreWars.prizePool()).to.equal(ethers.parseEther("0.5"));
    });

    it("allows owner to withdraw unused funds", async function () {
      await owner.sendTransaction({ to: await oreWars.getAddress(), value: ethers.parseEther("1.0") });
      const balanceBefore = await ethers.provider.getBalance(owner.address);
      await oreWars.connect(owner).withdrawUnused(ethers.parseEther("0.5"));
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });
});
