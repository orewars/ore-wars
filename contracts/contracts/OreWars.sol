// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract OreWars is Ownable, ReentrancyGuard {

    struct Agent {
        address owner;
        string  agentId;
        uint256 totalMined;   // in wei
        uint256 rocksMined;
        bool    active;
    }

    struct Rock {
        bool    hasOre;
        uint256 oreAmount;    // in wei
        bool    mined;
        string  minedByAgent;
    }

    mapping(string => Agent)  public agents;
    mapping(bytes32 => Rock)  public rocks;   // key: keccak256(abi.encodePacked(x, y, mapEpoch))
    uint256 public prizePool;
    uint256 public mapEpoch;
    address public gameServer;               // only gameServer can call claimOre

    event AgentRegistered(string indexed agentId, address indexed owner);
    event RockMined(string indexed agentId, uint256 x, uint256 y, bool hadOre, uint256 amount);
    event PoolFunded(address indexed from, uint256 amount);
    event MapReset(uint256 indexed newEpoch);

    error NotGameServer();
    error AgentNotFound();
    error RockAlreadyMined();
    error InsufficientPool();
    error TransferFailed();

    modifier onlyGameServer() {
        if (msg.sender != gameServer) revert NotGameServer();
        _;
    }

    constructor(address _gameServer) Ownable(msg.sender) {
        gameServer = _gameServer;
        mapEpoch = 1;
    }

    receive() external payable {
        prizePool += msg.value;
        emit PoolFunded(msg.sender, msg.value);
    }

    function registerAgent(string calldata agentId, address owner) external onlyGameServer {
        agents[agentId] = Agent({ owner: owner, agentId: agentId, totalMined: 0, rocksMined: 0, active: true });
        emit AgentRegistered(agentId, owner);
    }

    function seedRock(uint256 x, uint256 y, bool hasOre, uint256 oreAmount) external onlyGameServer {
        bytes32 key = keccak256(abi.encodePacked(x, y, mapEpoch));
        rocks[key] = Rock({ hasOre: hasOre, oreAmount: oreAmount, mined: false, minedByAgent: "" });
    }

    function claimOre(string calldata agentId, uint256 x, uint256 y) external onlyGameServer nonReentrant {
        Agent storage agent = agents[agentId];
        if (agent.owner == address(0)) revert AgentNotFound();

        bytes32 key = keccak256(abi.encodePacked(x, y, mapEpoch));
        Rock storage rock = rocks[key];
        if (rock.mined) revert RockAlreadyMined();

        rock.mined = true;
        rock.minedByAgent = agentId;
        agent.rocksMined++;

        uint256 payout = 0;
        if (rock.hasOre && rock.oreAmount > 0) {
            if (prizePool < rock.oreAmount) revert InsufficientPool();
            payout = rock.oreAmount;
            prizePool -= payout;
            agent.totalMined += payout;

            (bool ok, ) = agent.owner.call{ value: payout }("");
            if (!ok) revert TransferFailed();
        }

        emit RockMined(agentId, x, y, rock.hasOre, payout);
    }

    function resetMap() external onlyGameServer {
        mapEpoch++;
        emit MapReset(mapEpoch);
    }

    function setGameServer(address _gameServer) external onlyOwner {
        gameServer = _gameServer;
    }

    function withdrawUnused(uint256 amount) external onlyOwner {
        (bool ok, ) = owner().call{ value: amount }("");
        if (!ok) revert TransferFailed();
    }

    function getAgent(string calldata agentId) external view returns (Agent memory) {
        return agents[agentId];
    }

    function getRock(uint256 x, uint256 y) external view returns (Rock memory) {
        return rocks[keccak256(abi.encodePacked(x, y, mapEpoch))];
    }
}
