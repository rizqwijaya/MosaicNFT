// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MosaicERC721} from "../src/MosaicERC721.sol";
import {MosaicMarket} from "../src/MosaicMarket.sol";

/// @dev Shared setup for all Mosaic tests: deployed contracts, wired market,
///      and labeled actors with funded balances.
abstract contract BaseTest is Test {
    MosaicERC721 internal nft;
    MosaicMarket internal market;

    address internal owner = makeAddr("owner");
    address internal feeRecipient = makeAddr("feeRecipient");

    // Creator key/address for EIP-712 voucher signing.
    uint256 internal creatorKey = 0xC0FFEE;
    address internal creator;

    address internal seller = makeAddr("seller");
    address internal buyer = makeAddr("buyer");
    address internal bidder1 = makeAddr("bidder1");
    address internal bidder2 = makeAddr("bidder2");

    uint96 internal constant FEE_BPS = 250; // 2.5%

    function setUp() public virtual {
        creator = vm.addr(creatorKey);

        vm.startPrank(owner);
        nft = new MosaicERC721("MosaicNFT", "MOSAIC", owner);
        market = new MosaicMarket(FEE_BPS, feeRecipient, owner);
        nft.setMarket(address(market));
        vm.stopPrank();

        vm.deal(buyer, 100 ether);
        vm.deal(bidder1, 100 ether);
        vm.deal(bidder2, 100 ether);
        vm.deal(creator, 10 ether);
        vm.deal(seller, 10 ether);
    }

    /// @dev Mint a token to `to` with `royaltyBps`, royalty receiver = msg.sender (pranked).
    function _mint(address minter, address to, string memory uri, uint96 royaltyBps)
        internal
        returns (uint256 tokenId)
    {
        vm.prank(minter);
        tokenId = nft.mintTo(to, uri, royaltyBps);
    }
}
