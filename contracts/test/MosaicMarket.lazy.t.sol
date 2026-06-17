// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {MosaicERC721} from "../src/MosaicERC721.sol";
import {MosaicMarket} from "../src/MosaicMarket.sol";
import {VoucherSigner} from "./helpers/VoucherSigner.sol";

contract MarketLazyTest is BaseTest {
    string constant URI = "ipfs://lazy";
    uint96 constant ROYALTY_BPS = 750; // 7.5%

    function _voucher(uint256 nonce, uint256 minPrice)
        internal
        view
        returns (MosaicERC721.NFTVoucher memory)
    {
        return VoucherSigner.sign(
            vm, address(nft), creatorKey, nonce, minPrice, URI, ROYALTY_BPS, creator
        );
    }

    function test_BuyLazy_MintsAndSplitsPrimary() public {
        MosaicERC721.NFTVoucher memory v = _voucher(1, 1 ether);

        vm.prank(buyer);
        market.buyLazy{value: 1 ether}(address(nft), v);

        // minted to buyer
        assertEq(nft.ownerOf(1), buyer);
        assertEq(nft.tokenURI(1), URI);

        // primary sale: fee + creator proceeds (NO separate royalty deduction)
        uint256 fee = (1 ether * FEE_BPS) / 10_000;
        uint256 creatorProceeds = 1 ether - fee;
        assertEq(market.proceeds(feeRecipient), fee, "fee");
        assertEq(market.proceeds(creator), creatorProceeds, "creator gets rest");
        // conservation
        assertEq(fee + creatorProceeds, 1 ether);

        // royalty config still set for future secondary sales
        (address r, uint256 a) = nft.royaltyInfo(1, 10_000);
        assertEq(r, creator);
        assertEq(a, ROYALTY_BPS);
    }

    function test_BuyLazy_OverpaymentCountsTowardCreator() public {
        MosaicERC721.NFTVoucher memory v = _voucher(1, 1 ether);
        vm.prank(buyer);
        market.buyLazy{value: 2 ether}(address(nft), v); // pays more than minPrice

        uint256 fee = (2 ether * FEE_BPS) / 10_000;
        assertEq(market.proceeds(creator), 2 ether - fee);
    }

    function test_BuyLazy_RevertsInsufficientPayment() public {
        MosaicERC721.NFTVoucher memory v = _voucher(1, 1 ether);
        vm.prank(buyer);
        vm.expectRevert(MosaicMarket.Mosaic__InsufficientPayment.selector);
        market.buyLazy{value: 0.5 ether}(address(nft), v);
    }

    function test_BuyLazy_RevertsTamperedVoucher() public {
        MosaicERC721.NFTVoucher memory v = _voucher(1, 1 ether);
        v.royaltyBps = 100; // tamper after signing
        vm.prank(buyer);
        vm.expectRevert(MosaicERC721.MosaicERC721__InvalidSignature.selector);
        market.buyLazy{value: 1 ether}(address(nft), v);
    }

    function test_BuyLazy_RevertsReplayedNonce() public {
        MosaicERC721.NFTVoucher memory v = _voucher(9, 1 ether);
        vm.prank(buyer);
        market.buyLazy{value: 1 ether}(address(nft), v);

        // second purchase of same voucher must fail (nonce used)
        vm.prank(buyer);
        vm.expectRevert(MosaicERC721.MosaicERC721__NonceAlreadyUsed.selector);
        market.buyLazy{value: 1 ether}(address(nft), v);
    }

    function test_BuyLazy_WrongSignerReverts() public {
        uint256 attackerKey = 0xA11CE;
        MosaicERC721.NFTVoucher memory v = VoucherSigner.sign(
            vm, address(nft), attackerKey, 1, 1 ether, URI, ROYALTY_BPS, creator
        );
        vm.prank(buyer);
        vm.expectRevert(MosaicERC721.MosaicERC721__InvalidSignature.selector);
        market.buyLazy{value: 1 ether}(address(nft), v);
    }

    function test_BuyLazy_ThenWithdraw() public {
        MosaicERC721.NFTVoucher memory v = _voucher(1, 1 ether);
        vm.prank(buyer);
        market.buyLazy{value: 1 ether}(address(nft), v);

        uint256 fee = (1 ether * FEE_BPS) / 10_000;
        uint256 creatorProceeds = 1 ether - fee;

        uint256 before = creator.balance;
        vm.prank(creator);
        market.withdrawProceeds();
        assertEq(creator.balance, before + creatorProceeds);
    }
}
