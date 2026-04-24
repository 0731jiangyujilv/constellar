// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OracleRegistry} from "../src/OracleRegistry.sol";

/// @title DeployOracleRegistry
/// @notice Deploys OracleRegistry (ERC-8004-inspired agent identity + reputation)
///
///  Usage:
///    PRIVATE_KEY=0x... forge script script/DeployOracleRegistry.s.sol:DeployOracleRegistry \
///      --rpc-url $ARC_TESTNET_RPC_URL --broadcast
///
///  After deploy, the settlement bot becomes the `owner()` and is the only
///  account that can call `applyReputation` / `applyOutcome`. Each oracle node
///  registers itself via `register(name, dataSource, endpoint, metadataURI)`.
contract DeployOracleRegistry is Script {
    function run() external returns (OracleRegistry registry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        registry = new OracleRegistry();
        vm.stopBroadcast();

        console.log("OracleRegistry deployed at:", address(registry));
        console.log("Owner (admin):", registry.owner());
    }
}
