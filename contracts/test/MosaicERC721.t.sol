// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {MosaicERC721} from "../src/MosaicERC721.sol";
import {VoucherSigner} from "./helpers/VoucherSigner.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MosaicERC721Test is BaseTest {
    string constant URI = "ipfs://QmTokenMeta";

    // --- direct mint ---

    function test_MintTo_SetsOwnerUriRoyalty() public {
        uint256 id = _mint(creator, seller, URI, 500);
        assertEq(nft.ownerOf(id), seller);
        assertEq(nft.tokenURI(id), URI);

        (address receiver, uint256 amount) = nft.royaltyInfo(id, 10_000);
        assertEq(receiver, creator, "royalty receiver = creator/minter");
        assertEq(amount, 500, "5% of 10000");
    }

    function test_MintTo_IncrementsTokenId() public {
        uint256 a = _mint(creator, seller, URI, 0);
        uint256 b = _mint(creator, seller, URI, 0);
        assertEq(b, a + 1);
    }

    function test_MintTo_RevertsOnRoyaltyTooHigh() public {
        vm.prank(creator);
        vm.expectRevert(MosaicERC721.MosaicERC721__RoyaltyTooHigh.selector);
        nft.mintTo(seller, URI, 10_001);
    }

    function test_MintTo_RevertsOnZeroAddress() public {
        vm.prank(creator);
        vm.expectRevert(MosaicERC721.MosaicERC721__ZeroAddress.selector);
        nft.mintTo(address(0), URI, 0);
    }

    function test_SupportsInterfaces() public view {
        assertTrue(nft.supportsInterface(type(IERC2981).interfaceId), "ERC2981");
        assertTrue(nft.supportsInterface(0x80ac58cd), "ERC721");
        assertTrue(nft.supportsInterface(0x5b5e139f), "ERC721Metadata");
    }

    // --- setMarket access control ---

    function test_SetMarket_OnlyOwner() public {
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, buyer));
        nft.setMarket(buyer);
    }

    function test_SetMarket_RevertsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(MosaicERC721.MosaicERC721__ZeroAddress.selector);
        nft.setMarket(address(0));
    }

    // --- redeem: access control ---

    function test_Redeem_OnlyMarket() public {
        MosaicERC721.NFTVoucher memory voucher = VoucherSigner.sign(
            vm, address(nft), creatorKey, 1, 1 ether, URI, 500, creator
        );
        // direct caller (not market) must revert
        vm.prank(buyer);
        vm.expectRevert(MosaicERC721.MosaicERC721__NotMarket.selector);
        nft.redeem(buyer, voucher);
    }

    // --- redeem: signature cases (invoked via market prank) ---

    function test_Redeem_ValidSignature() public {
        MosaicERC721.NFTVoucher memory voucher = VoucherSigner.sign(
            vm, address(nft), creatorKey, 1, 1 ether, URI, 500, creator
        );
        vm.prank(address(market));
        uint256 id = nft.redeem(buyer, voucher);

        assertEq(nft.ownerOf(id), buyer);
        assertEq(nft.tokenURI(id), URI);
        (address r, uint256 a) = nft.royaltyInfo(id, 10_000);
        assertEq(r, creator);
        assertEq(a, 500);
        assertTrue(nft.nonceUsed(creator, 1));
    }

    function test_Redeem_RevertsTamperedVoucher() public {
        MosaicERC721.NFTVoucher memory voucher = VoucherSigner.sign(
            vm, address(nft), creatorKey, 1, 1 ether, URI, 500, creator
        );
        // tamper minPrice after signing: signature no longer matches digest
        voucher.minPrice = 0.001 ether;

        vm.prank(address(market));
        vm.expectRevert(MosaicERC721.MosaicERC721__InvalidSignature.selector);
        nft.redeem(buyer, voucher);
    }

    function test_Redeem_RevertsWrongSigner() public {
        uint256 attackerKey = 0xBADBADBAD;
        // attacker signs but claims `creator` as the creator field
        MosaicERC721.NFTVoucher memory voucher = VoucherSigner.sign(
            vm, address(nft), attackerKey, 1, 1 ether, URI, 500, creator
        );
        vm.prank(address(market));
        vm.expectRevert(MosaicERC721.MosaicERC721__InvalidSignature.selector);
        nft.redeem(buyer, voucher);
    }

    function test_Redeem_RevertsReplayedNonce() public {
        MosaicERC721.NFTVoucher memory voucher = VoucherSigner.sign(
            vm, address(nft), creatorKey, 7, 1 ether, URI, 500, creator
        );
        vm.prank(address(market));
        nft.redeem(buyer, voucher);

        // same voucher / nonce again
        vm.prank(address(market));
        vm.expectRevert(MosaicERC721.MosaicERC721__NonceAlreadyUsed.selector);
        nft.redeem(buyer, voucher);
    }

    function test_Redeem_RevertsRoyaltyTooHigh() public {
        MosaicERC721.NFTVoucher memory voucher = VoucherSigner.sign(
            vm, address(nft), creatorKey, 1, 1 ether, URI, 10_001, creator
        );
        vm.prank(address(market));
        vm.expectRevert(MosaicERC721.MosaicERC721__RoyaltyTooHigh.selector);
        nft.redeem(buyer, voucher);
    }

    function test_RecoverVoucherSigner_Matches() public view {
        MosaicERC721.NFTVoucher memory voucher = VoucherSigner.sign(
            vm, address(nft), creatorKey, 1, 1 ether, URI, 500, creator
        );
        assertEq(nft.recoverVoucherSigner(voucher), creator);
    }
}
