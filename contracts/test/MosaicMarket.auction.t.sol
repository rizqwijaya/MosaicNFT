// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {MosaicMarket} from "../src/MosaicMarket.sol";

contract MarketAuctionTest is BaseTest {
    string constant URI = "ipfs://meta";
    uint96 constant ROYALTY_BPS = 1000; // 10%

    uint256 internal tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _mint(creator, seller, URI, ROYALTY_BPS);
        vm.prank(seller);
        nft.setApprovalForAll(address(market), true);
    }

    function _createAuction(uint256 startPrice, uint256 duration) internal returns (uint256 id) {
        vm.prank(seller);
        id = market.createAuction(address(nft), tokenId, startPrice, duration);
    }

    function test_CreateAuction_EscrowsNFT() public {
        uint256 id = _createAuction(1 ether, 1 days);
        assertEq(nft.ownerOf(tokenId), address(market), "NFT escrowed");
        (, , address s,,,,, bool settled) = market.auctions(id);
        assertEq(s, seller);
        assertFalse(settled);
    }

    function test_CreateAuction_RevertsNotOwner() public {
        vm.prank(buyer);
        vm.expectRevert(MosaicMarket.Mosaic__NotOwner.selector);
        market.createAuction(address(nft), tokenId, 1 ether, 1 days);
    }

    function test_CreateAuction_RevertsBadDuration() public {
        vm.prank(seller);
        vm.expectRevert(MosaicMarket.Mosaic__BadDuration.selector);
        market.createAuction(address(nft), tokenId, 1 ether, 0);
    }

    function test_PlaceBid_BelowStartReverts() public {
        uint256 id = _createAuction(1 ether, 1 days);
        vm.prank(bidder1);
        vm.expectRevert(MosaicMarket.Mosaic__BidTooLow.selector);
        market.placeBid{value: 0.5 ether}(id);
    }

    function test_PlaceBid_OutbidRefundsViaPull() public {
        uint256 id = _createAuction(1 ether, 1 days);

        vm.prank(bidder1);
        market.placeBid{value: 1 ether}(id);

        // bidder2 outbids; bidder1 credited for pull-refund
        vm.prank(bidder2);
        market.placeBid{value: 2 ether}(id);

        assertEq(market.proceeds(bidder1), 1 ether, "prev bidder refunded (pull)");

        (,,,, uint256 highestBid, address highestBidder,,) = market.auctions(id);
        assertEq(highestBid, 2 ether);
        assertEq(highestBidder, bidder2);

        // bidder1 withdraws
        uint256 before = bidder1.balance;
        vm.prank(bidder1);
        market.withdrawProceeds();
        assertEq(bidder1.balance, before + 1 ether);
    }

    function test_PlaceBid_AfterEndReverts() public {
        uint256 id = _createAuction(1 ether, 1 days);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(bidder1);
        vm.expectRevert(MosaicMarket.Mosaic__AuctionEnded.selector);
        market.placeBid{value: 1 ether}(id);
    }

    function test_SettleAuction_HappyPath() public {
        uint256 id = _createAuction(1 ether, 1 days);

        vm.prank(bidder1);
        market.placeBid{value: 1 ether}(id);
        vm.prank(bidder2);
        market.placeBid{value: 10 ether}(id);

        vm.warp(block.timestamp + 1 days + 1);
        market.settleAuction(id); // anyone can call

        // winner gets NFT
        assertEq(nft.ownerOf(tokenId), bidder2);

        // split of 10 ether: royalty 10% = 1, fee 2.5% = 0.25, seller = rest
        uint256 price = 10 ether;
        uint256 royalty = 1 ether;
        uint256 fee = (price * FEE_BPS) / 10_000;
        uint256 sellerProceeds = price - royalty - fee;

        assertEq(market.proceeds(creator), royalty);
        assertEq(market.proceeds(feeRecipient), fee);
        assertEq(market.proceeds(seller), sellerProceeds);
        // bidder1 still has refund credited
        assertEq(market.proceeds(bidder1), 1 ether);
    }

    function test_SettleAuction_NoBidsReturnsNFT() public {
        uint256 id = _createAuction(1 ether, 1 days);
        vm.warp(block.timestamp + 1 days + 1);
        market.settleAuction(id);
        assertEq(nft.ownerOf(tokenId), seller, "NFT returned to seller");
    }

    function test_SettleAuction_BeforeEndReverts() public {
        uint256 id = _createAuction(1 ether, 1 days);
        vm.expectRevert(MosaicMarket.Mosaic__AuctionNotEnded.selector);
        market.settleAuction(id);
    }

    function test_SettleAuction_TwiceReverts() public {
        uint256 id = _createAuction(1 ether, 1 days);
        vm.warp(block.timestamp + 1 days + 1);
        market.settleAuction(id);
        vm.expectRevert(MosaicMarket.Mosaic__AuctionInactive.selector);
        market.settleAuction(id);
    }
}
