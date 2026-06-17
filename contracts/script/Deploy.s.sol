// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MosaicERC721} from "../src/MosaicERC721.sol";
import {MosaicMarket} from "../src/MosaicMarket.sol";

/// @title Deploy: deploys MosaicERC721 + MosaicMarket and wires them.
/// @notice Run against Sepolia. Reads config from environment variables:
///
///   PRIVATE_KEY       (uint)    deployer key; becomes owner of both contracts
///   FEE_RECIPIENT     (address) marketplace fee receiver (defaults to deployer)
///   MARKETPLACE_FEE_BPS (uint, optional) defaults to 250 (2.5%)
///   COLLECTION_NAME   (string,  optional) defaults to "MosaicNFT"
///   COLLECTION_SYMBOL (string,  optional) defaults to "MOSAIC"
///
/// Deployment order (matters):
///   1. Deploy MosaicERC721(name, symbol, owner=deployer)
///   2. Deploy MosaicMarket(feeBps, feeRecipient, owner=deployer)
///   3. nft.setMarket(address(market))  <-- authorizes market to call redeem()
///
/// Example:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url sepolia --broadcast --verify -vvvv
contract Deploy is Script {
    function run() external returns (MosaicERC721 nft, MosaicMarket market) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        uint96 feeBps = uint96(vm.envOr("MARKETPLACE_FEE_BPS", uint256(250)));
        string memory name = vm.envOr("COLLECTION_NAME", string("MosaicNFT"));
        string memory symbol = vm.envOr("COLLECTION_SYMBOL", string("MOSAIC"));

        vm.startBroadcast(deployerKey);

        // 1. collection
        nft = new MosaicERC721(name, symbol, deployer);

        // 2. marketplace
        market = new MosaicMarket(feeBps, feeRecipient, deployer);

        // 3. authorize the market to call redeem() on the collection
        nft.setMarket(address(market));

        vm.stopBroadcast();

        console2.log("MosaicERC721 :", address(nft));
        console2.log("MosaicMarket :", address(market));
        console2.log("owner        :", deployer);
        console2.log("feeRecipient :", feeRecipient);
        console2.log("feeBps       :", feeBps);
        console2.log("market wired :", nft.market() == address(market));
    }
}
