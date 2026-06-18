// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {MosaicERC721} from "../src/MosaicERC721.sol";
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

    // --- airdrop: create access control ---

    function test_CreateAirdrop_OnlyOwner() public {
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, buyer));
        nft.createAirdrop(URI, 500, 10);
    }

    function test_CreateAirdrop_RevertsRoyaltyTooHigh() public {
        vm.prank(owner);
        vm.expectRevert(MosaicERC721.MosaicERC721__RoyaltyTooHigh.selector);
        nft.createAirdrop(URI, 10_001, 10);
    }

    function test_CreateAirdrop_StoresCampaign() public {
        vm.prank(owner);
        uint256 id = nft.createAirdrop(URI, 500, 10);

        (
            string memory uri,
            uint96 royaltyBps,
            uint64 maxClaims,
            uint64 claimed,
            bool active,
            address campaignCreator
        ) = nft.airdrops(id);
        assertEq(uri, URI);
        assertEq(royaltyBps, 500);
        assertEq(maxClaims, 10);
        assertEq(claimed, 0);
        assertTrue(active);
        assertEq(campaignCreator, owner);
    }

    // --- airdrop: claim ---

    function test_ClaimAirdrop_MintsFreeToken() public {
        vm.prank(owner);
        uint256 id = nft.createAirdrop(URI, 500, 10);

        vm.prank(buyer);
        uint256 tokenId = nft.claimAirdrop(id);

        assertEq(nft.ownerOf(tokenId), buyer);
        assertEq(nft.tokenURI(tokenId), URI);
        (address r, uint256 a) = nft.royaltyInfo(tokenId, 10_000);
        assertEq(r, owner, "royalty receiver = campaign creator");
        assertEq(a, 500);
        assertTrue(nft.hasClaimed(id, buyer));

        (, , , uint64 claimed, , ) = nft.airdrops(id);
        assertEq(claimed, 1);
    }

    function test_ClaimAirdrop_RevertsDoubleClaim() public {
        vm.prank(owner);
        uint256 id = nft.createAirdrop(URI, 0, 0);

        vm.prank(buyer);
        nft.claimAirdrop(id);

        vm.prank(buyer);
        vm.expectRevert(MosaicERC721.MosaicERC721__AlreadyClaimed.selector);
        nft.claimAirdrop(id);
    }

    function test_ClaimAirdrop_RevertsWhenExhausted() public {
        vm.prank(owner);
        uint256 id = nft.createAirdrop(URI, 0, 1);

        vm.prank(buyer);
        nft.claimAirdrop(id);

        vm.prank(bidder1);
        vm.expectRevert(MosaicERC721.MosaicERC721__AirdropExhausted.selector);
        nft.claimAirdrop(id);
    }

    function test_ClaimAirdrop_RevertsWhenNotFound() public {
        vm.prank(buyer);
        vm.expectRevert(MosaicERC721.MosaicERC721__AirdropNotFound.selector);
        nft.claimAirdrop(999);
    }

    function test_ClaimAirdrop_RevertsWhenInactive() public {
        vm.prank(owner);
        uint256 id = nft.createAirdrop(URI, 0, 0);
        vm.prank(owner);
        nft.closeAirdrop(id);

        vm.prank(buyer);
        vm.expectRevert(MosaicERC721.MosaicERC721__AirdropInactive.selector);
        nft.claimAirdrop(id);
    }

    function test_ClaimAirdrop_UnlimitedWhenMaxZero() public {
        vm.prank(owner);
        uint256 id = nft.createAirdrop(URI, 0, 0);

        vm.prank(buyer);
        nft.claimAirdrop(id);
        vm.prank(bidder1);
        nft.claimAirdrop(id);
        vm.prank(bidder2);
        nft.claimAirdrop(id);

        (, , , uint64 claimed, , ) = nft.airdrops(id);
        assertEq(claimed, 3);
    }

    // --- airdrop: close access control ---

    function test_CloseAirdrop_OnlyOwner() public {
        vm.prank(owner);
        uint256 id = nft.createAirdrop(URI, 0, 0);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, buyer));
        nft.closeAirdrop(id);
    }

    function test_CloseAirdrop_RevertsWhenNotFound() public {
        vm.prank(owner);
        vm.expectRevert(MosaicERC721.MosaicERC721__AirdropNotFound.selector);
        nft.closeAirdrop(999);
    }
}
