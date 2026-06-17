// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {MosaicERC721} from "../src/MosaicERC721.sol";
import {MosaicMarket} from "../src/MosaicMarket.sol";
import {VoucherSigner} from "./helpers/VoucherSigner.sol";

/// @dev Fuzz tests over the payment split. Core invariant: every wei of the
///      sale price is accounted for across royalty + fee + seller (no dust
///      lost, nothing minted).
contract MarketFuzzTest is BaseTest {
    string constant URI = "ipfs://meta";

    /// Secondary sale (fixed-price buy): royalty + fee + seller == price.
    function testFuzz_SecondarySplit_Conserves(
        uint256 price,
        uint96 royaltyBps,
        uint96 feeBps
    ) public {
        price = bound(price, 1, 1_000_000 ether);
        royaltyBps = uint96(bound(royaltyBps, 0, 10_000));
        feeBps = uint96(bound(feeBps, 0, 10_000));
        // keep royalty + fee within price so seller share stays non-negative
        vm.assume(uint256(royaltyBps) + uint256(feeBps) <= 10_000);

        vm.prank(owner);
        market.setFeeConfig(feeBps, feeRecipient);

        uint256 tokenId = _mint(creator, seller, URI, royaltyBps);
        vm.prank(seller);
        nft.setApprovalForAll(address(market), true);
        vm.prank(seller);
        market.listItem(address(nft), tokenId, price);

        vm.deal(buyer, price);
        vm.prank(buyer);
        market.buyItem{value: price}(address(nft), tokenId);

        uint256 expectedRoyalty = (price * royaltyBps) / 10_000;
        uint256 expectedFee = (price * feeBps) / 10_000;
        uint256 expectedSeller = price - expectedRoyalty - expectedFee;

        // creator == royalty receiver; if royalty is 0 their proceeds are 0.
        assertEq(market.proceeds(creator), expectedRoyalty, "royalty");
        assertEq(market.proceeds(feeRecipient), expectedFee, "fee");
        assertEq(market.proceeds(seller), expectedSeller, "seller");

        // conservation: total credited == price, and == contract balance.
        uint256 total = market.proceeds(creator) + market.proceeds(feeRecipient)
            + market.proceeds(seller);
        assertEq(total, price, "all wei accounted for");
        assertEq(address(market).balance, price, "contract holds exactly price");
    }

    /// Primary lazy-mint sale: fee + creator == price (no royalty on first sale).
    function testFuzz_PrimarySplit_Conserves(
        uint256 minPrice,
        uint256 pay,
        uint96 feeBps,
        uint96 royaltyBps
    ) public {
        minPrice = bound(minPrice, 1, 100_000 ether);
        pay = bound(pay, minPrice, 200_000 ether);
        feeBps = uint96(bound(feeBps, 0, 10_000));
        royaltyBps = uint96(bound(royaltyBps, 0, 10_000));

        vm.prank(owner);
        market.setFeeConfig(feeBps, feeRecipient);

        MosaicERC721.NFTVoucher memory v = VoucherSigner.sign(
            vm, address(nft), creatorKey, 1, minPrice, URI, royaltyBps, creator
        );

        vm.deal(buyer, pay);
        vm.prank(buyer);
        market.buyLazy{value: pay}(address(nft), v);

        uint256 expectedFee = (pay * feeBps) / 10_000;
        uint256 expectedCreator = pay - expectedFee;

        assertEq(market.proceeds(feeRecipient), expectedFee, "fee");
        assertEq(market.proceeds(creator), expectedCreator, "creator");
        assertEq(expectedFee + expectedCreator, pay, "conserved");
        assertEq(address(market).balance, pay);
    }

    /// Withdraw is exact: caller receives precisely their credited balance.
    function testFuzz_Withdraw_Exact(uint256 price, uint96 feeBps) public {
        price = bound(price, 1, 1_000 ether);
        feeBps = uint96(bound(feeBps, 0, 10_000));

        vm.prank(owner);
        market.setFeeConfig(feeBps, feeRecipient);

        uint256 tokenId = _mint(creator, seller, URI, 0);
        vm.prank(seller);
        nft.setApprovalForAll(address(market), true);
        vm.prank(seller);
        market.listItem(address(nft), tokenId, price);
        vm.deal(buyer, price);
        vm.prank(buyer);
        market.buyItem{value: price}(address(nft), tokenId);

        uint256 credited = market.proceeds(seller);
        uint256 before = seller.balance;
        vm.prank(seller);
        market.withdrawProceeds();
        assertEq(seller.balance, before + credited);
        assertEq(market.proceeds(seller), 0);
    }
}
