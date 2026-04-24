// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title OracleRegistry — ERC-8004-inspired identity + reputation for AI oracle agents
/// @notice Lightweight on-chain trust layer for the 5-agent Oracle Swarm.
///
///  ERC-8004 ("Trustless AI Agents") proposes three primitives for autonomous
///  agents: Identity, Reputation, and Validation. This contract implements the
///  first two in a minimal form tailored to the PolyPOP Oracle Swarm:
///
///   • Identity   — anyone can `register` an agent (name, dataSource, endpoint,
///                  metadataURI) and receive a non-transferable tokenId.
///   • Reputation — the admin (settlement bot) calls `applyOutcome` after each
///                  swarm resolve, incrementing agents whose verdicts matched
///                  the consensus and decrementing those that didn't.
///
///  Validation (the third ERC-8004 primitive) is deferred: the contract emits
///  enough events that off-chain validators can audit the full history.
contract OracleRegistry is Ownable {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    struct Agent {
        address owner;
        string name;           // e.g., "Twitter Scout"
        string dataSource;     // e.g., "twitter"
        string endpoint;       // e.g., "http://oracle-01.polypop.xyz"
        string metadataURI;    // IPFS/HTTP JSON blob (optional)
        uint64 registeredAt;
        bool active;
    }

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    uint256 public nextTokenId;

    /// @notice tokenId → agent profile
    mapping(uint256 => Agent) public agents;

    /// @notice tokenId → signed reputation score (can go negative)
    mapping(uint256 => int256) public reputation;

    /// @notice keccak256(eventKey) → tokenId → already-scored?
    ///         prevents double-counting a single resolve event.
    mapping(bytes32 => mapping(uint256 => bool)) public scored;

    /// @notice convenience: dataSource lowercase → tokenId (one agent per source)
    ///         set on first registration; subsequent registrations with the same
    ///         source are allowed but this lookup is not updated.
    mapping(bytes32 => uint256) public primaryAgentOf;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event AgentRegistered(
        uint256 indexed tokenId,
        address indexed owner,
        string name,
        string dataSource,
        string endpoint,
        string metadataURI
    );

    event AgentUpdated(uint256 indexed tokenId, string endpoint, string metadataURI, bool active);

    event ReputationChanged(
        uint256 indexed tokenId,
        bytes32 indexed eventKey,
        int256 delta,
        int256 newScore,
        string reason
    );

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() Ownable(msg.sender) {}

    /*//////////////////////////////////////////////////////////////
                            REGISTRATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Register a new agent identity. Identities are non-transferable
    ///         and tied to `msg.sender` (use a Circle Wallet per agent).
    function register(
        string calldata name,
        string calldata dataSource,
        string calldata endpoint,
        string calldata metadataURI
    ) external returns (uint256 tokenId) {
        require(bytes(name).length > 0 && bytes(name).length <= 64, "name");
        require(bytes(dataSource).length > 0 && bytes(dataSource).length <= 32, "dataSource");
        require(bytes(endpoint).length <= 256, "endpoint");
        require(bytes(metadataURI).length <= 256, "metadataURI");

        tokenId = ++nextTokenId;
        agents[tokenId] = Agent({
            owner: msg.sender,
            name: name,
            dataSource: dataSource,
            endpoint: endpoint,
            metadataURI: metadataURI,
            registeredAt: uint64(block.timestamp),
            active: true
        });

        bytes32 sourceKey = keccak256(bytes(dataSource));
        if (primaryAgentOf[sourceKey] == 0) {
            primaryAgentOf[sourceKey] = tokenId;
        }

        emit AgentRegistered(tokenId, msg.sender, name, dataSource, endpoint, metadataURI);
    }

    function updateAgent(uint256 tokenId, string calldata endpoint, string calldata metadataURI, bool active) external {
        Agent storage a = agents[tokenId];
        require(a.owner == msg.sender || owner() == msg.sender, "not authorized");
        require(bytes(endpoint).length <= 256, "endpoint");
        require(bytes(metadataURI).length <= 256, "metadataURI");
        a.endpoint = endpoint;
        a.metadataURI = metadataURI;
        a.active = active;
        emit AgentUpdated(tokenId, endpoint, metadataURI, active);
    }

    /*//////////////////////////////////////////////////////////////
                             REPUTATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Admin (settlement bot) applies a single agent's post-resolve score delta.
    function applyReputation(bytes32 eventKey, uint256 tokenId, int256 delta, string calldata reason)
        public
        onlyOwner
    {
        require(agents[tokenId].registeredAt != 0, "unknown agent");
        require(!scored[eventKey][tokenId], "already scored for event");
        scored[eventKey][tokenId] = true;

        int256 newScore = reputation[tokenId] + delta;
        reputation[tokenId] = newScore;

        emit ReputationChanged(tokenId, eventKey, delta, newScore, reason);
    }

    /// @notice Batch variant for one resolve event affecting all 5 agents at once.
    ///         `deltas[i]` applies to `tokenIds[i]`.
    function applyOutcome(
        bytes32 eventKey,
        uint256[] calldata tokenIds,
        int256[] calldata deltas,
        string calldata reason
    ) external onlyOwner {
        require(tokenIds.length == deltas.length, "length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            applyReputation(eventKey, tokenIds[i], deltas[i], reason);
        }
    }

    /*//////////////////////////////////////////////////////////////
                              VIEW HELPERS
    //////////////////////////////////////////////////////////////*/

    function getAgent(uint256 tokenId) external view returns (Agent memory) {
        return agents[tokenId];
    }

    function getReputation(uint256 tokenId) external view returns (int256) {
        return reputation[tokenId];
    }

    function totalAgents() external view returns (uint256) {
        return nextTokenId;
    }
}
