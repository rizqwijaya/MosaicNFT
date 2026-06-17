// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {MosaicMarket} from "../src/MosaicMarket.sol";

contract MarketListingTest is BaseTest {
    string constant URI = "ipfs://meta";
    uint96 constant ROYALTY_BPS = 1000; // 10%

    uint256 internal tokenId;

    function setUp() public override {
        super.setUp();
        // creator mints to seller; royalty receiver = creator
        tokenId = _mint(creator, seller, URI, ROYALTY_BPS);
        vm.prank(seller);
        nft.setApprovalForAll(address(market), true);
    }

    function _list(uint256 price) internal {
        vm.prank(seller);
        market.listItem(address(nft), tokenId, price);
    }

    function test_ListItem_RecordsListing() public {
        _list(1 ether);
        (address s, uint256 p) = market.listings(address(nft), tokenId);
        assertEq(s, seller);
        assertEq(p, 1 ether);
    }

    function test_ListItem_RevertsZeroPrice() public {
        vm.prank(seller);
        vm.expectRevert(MosaicMarket.Mosaic__ZeroPrice.selector);
        market.listItem(address(nft), tokenId, 0);
    }

    function test_ListItem_RevertsNotOwner() public {
        vm.prank(buyer);
        vm.expectRevert(MosaicMarket.Mosaic__NotOwner.selector);
        market.listItem(address(nft), tokenId, 1 ether);
    }

    function test_ListItem_RevertsNotApproved() public {
        vm.prank(seller);
        nft.setApprovalForAll(address(market), false);
        vm.prank(seller);
        vm.expectRevert(MosaicMarket.Mosaic__NotApproved.selector);
        market.listItem(address(nft), tokenId, 1 ether);
    }

    function test_ListItem_RevertsAlreadyListed() public {
        _list(1 ether);
        vm.prank(seller);
        vm.expectRevert(MosaicMarket.Mosaic__AlreadyListed.selector);
        market.listItem(address(nft), tokenId, 2 ether);
    }

    function test_CancelListing() public {
        _list(1 ether);
        vm.prank(seller);
        market.cancelListing(address(nft), tokenId);
        (address s,) = market.listings(address(nft), tokenId);
        assertEq(s, address(0));
    }

    function test_CancelListing_OnlySeller() public {
        _list(1 ether);
        vm.prank(buyer);
        vm.expectRevert(MosaicMarket.Mosaic__NotOwner.selector);
        market.cancelListing(address(nft), tokenId);
    }

    // --- buy + split ---

    function test_BuyItem_TransfersAndSplits() public {
        uint256 price = 10 ether;
        _list(price);

        vm.prank(buyer);
        market.buyItem{value: price}(address(nft), tokenId);

        // ownership moved
        assertEq(nft.ownerOf(tokenId), buyer);

        // listing cleared
        (address s,) = market.listings(address(nft), tokenId);
        assertEq(s, address(0));

        // split: royalty 10% = 1 ether (to creator), fee 2.5% = 0.25 ether, seller = rest
        uint256 royalty = 1 ether;
        uint256 fee = (price * FEE_BPS) / 10_000;
        uint256 sellerProceeds = price - royalty - fee;

        assertEq(market.proceeds(creator), royalty, "creator royalty");
        assertEq(market.proceeds(feeRecipient), fee, "fee");
        assertEq(market.proceeds(seller), sellerProceeds, "seller");
        // conservation
        assertEq(royalty + fee + sellerProceeds, price);
    }

    function test_BuyItem_RevertsWrongPrice() public {
        _list(1 ether);
        vm.prank(buyer);
        vm.expectRevert(MosaicMarket.Mosaic__WrongPrice.selector);
        market.buyItem{value: 0.5 ether}(address(nft), tokenId);
    }

    function test_BuyItem_RevertsNotListed() public {
        vm.prank(buyer);
        vm.expectRevert(MosaicMarket.Mosaic__NotListed.selector);
        market.buyItem{value: 1 ether}(address(nft), tokenId);
    }

    function test_BuyItem_RevertsSelfBuy() public {
        _list(1 ether);
        vm.deal(seller, 5 ether);
        vm.prank(seller);
        vm.expectRevert(MosaicMarket.Mosaic__SelfBuy.selector);
        market.buyItem{value: 1 ether}(address(nft), tokenId);
    }

    function test_Withdraw_AfterSale() public {
        uint256 price = 10 ether;
        _list(price);
        vm.prank(buyer);
        market.buyItem{value: price}(address(nft), tokenId);

        uint256 fee = (price * FEE_BPS) / 10_000;
        uint256 before = feeRecipient.balance;
        vm.prank(feeRecipient);
        market.withdrawProceeds();
        assertEq(feeRecipient.balance, before + fee);
        assertEq(market.proceeds(feeRecipient), 0);
    }

    function test_Withdraw_RevertsNothing() public {
        vm.prank(buyer);
        vm.expectRevert(MosaicMarket.Mosaic__NothingToWithdraw.selector);
        market.withdrawProceeds();
    }

    // --- fee config ---

    function test_SetFeeConfig_OnlyOwner() public {
        vm.prank(buyer);
        vm.expectRevert();
        market.setFeeConfig(100, feeRecipient);
    }

    function test_SetFeeConfig_RevertsFeeTooHigh() public {
        vm.prank(owner);
        vm.expectRevert(MosaicMarket.Mosaic__FeeTooHigh.selector);
        market.setFeeConfig(10_001, feeRecipient);
    }

    function test_SetFeeConfig_Updates() public {
        vm.prank(owner);
        market.setFeeConfig(500, buyer);
        assertEq(market.marketplaceFeeBps(), 500);
        assertEq(market.feeRecipient(), buyer);
    }
}
