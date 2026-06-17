// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {MosaicMarket} from "../src/MosaicMarket.sol";

contract MarketOfferTest is BaseTest {
    string constant URI = "ipfs://meta";
    uint96 constant ROYALTY_BPS = 1000; // 10%

    uint256 internal tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _mint(creator, seller, URI, ROYALTY_BPS);
    }

    function _offer(address from, uint256 amount) internal returns (uint256 id) {
        vm.prank(from);
        id = market.makeOffer{value: amount}(address(nft), tokenId);
    }

    function test_MakeOffer_EscrowsFunds() public {
        uint256 id = _offer(buyer, 3 ether);
        assertEq(address(market).balance, 3 ether, "escrow held in contract");
        (,, address b, uint256 amount, bool active) = market.offers(id);
        assertEq(b, buyer);
        assertEq(amount, 3 ether);
        assertTrue(active);
    }

    function test_MakeOffer_RevertsZero() public {
        vm.prank(buyer);
        vm.expectRevert(MosaicMarket.Mosaic__ZeroOffer.selector);
        market.makeOffer{value: 0}(address(nft), tokenId);
    }

    function test_CancelOffer_RefundsViaPull() public {
        uint256 id = _offer(buyer, 3 ether);
        vm.prank(buyer);
        market.cancelOffer(id);

        assertEq(market.proceeds(buyer), 3 ether);
        (,,,, bool active) = market.offers(id);
        assertFalse(active);

        uint256 before = buyer.balance;
        vm.prank(buyer);
        market.withdrawProceeds();
        assertEq(buyer.balance, before + 3 ether);
    }

    function test_CancelOffer_OnlyBuyer() public {
        uint256 id = _offer(buyer, 3 ether);
        vm.prank(seller);
        vm.expectRevert(MosaicMarket.Mosaic__NotOfferOwner.selector);
        market.cancelOffer(id);
    }

    function test_AcceptOffer_SplitsAndTransfers() public {
        uint256 amount = 10 ether;
        uint256 id = _offer(buyer, amount);

        vm.prank(seller);
        nft.setApprovalForAll(address(market), true);

        vm.prank(seller);
        market.acceptOffer(id);

        assertEq(nft.ownerOf(tokenId), buyer, "NFT to buyer");

        uint256 royalty = 1 ether; // 10%
        uint256 fee = (amount * FEE_BPS) / 10_000;
        uint256 sellerProceeds = amount - royalty - fee;
        assertEq(market.proceeds(creator), royalty);
        assertEq(market.proceeds(feeRecipient), fee);
        assertEq(market.proceeds(seller), sellerProceeds);

        (,,,, bool active) = market.offers(id);
        assertFalse(active);
    }

    function test_AcceptOffer_RevertsNotOwner() public {
        uint256 id = _offer(buyer, 5 ether);
        vm.prank(buyer); // buyer is not the NFT owner
        vm.expectRevert(MosaicMarket.Mosaic__NotOwner.selector);
        market.acceptOffer(id);
    }

    function test_AcceptOffer_RevertsNotApproved() public {
        uint256 id = _offer(buyer, 5 ether);
        // seller owns but hasn't approved the market
        vm.prank(seller);
        vm.expectRevert(MosaicMarket.Mosaic__NotApproved.selector);
        market.acceptOffer(id);
    }

    function test_AcceptOffer_RevertsInactive() public {
        uint256 id = _offer(buyer, 5 ether);
        vm.prank(buyer);
        market.cancelOffer(id);

        vm.prank(seller);
        nft.setApprovalForAll(address(market), true);
        vm.prank(seller);
        vm.expectRevert(MosaicMarket.Mosaic__OfferInactive.selector);
        market.acceptOffer(id);
    }
}
