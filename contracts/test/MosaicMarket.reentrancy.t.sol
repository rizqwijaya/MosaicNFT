// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {MosaicMarket} from "../src/MosaicMarket.sol";
import {ReentrantAttacker, NoRoyalty721} from "./helpers/Mocks.sol";

contract MarketReentrancyTest is BaseTest {
    ReentrantAttacker internal attacker;
    NoRoyalty721 internal plain;

    function setUp() public override {
        super.setUp();
        attacker = new ReentrantAttacker(market);
        plain = new NoRoyalty721();
    }

    /// withdrawProceeds is the only path that pushes ETH via call{} — verify a
    /// re-entrant withdraw during that call cannot drain extra funds.
    function test_Reentrancy_WithdrawIsGuarded() public {
        // attacker accrues 1 ether of proceeds by making then cancelling an
        // offer. The offer is funded by ETH the test forwards into makeOffer, so
        // the attacker contract itself starts and stays at 0 balance — making any
        // post-withdraw balance attributable solely to the withdrawal path.
        uint256 offerId = attacker.makeOffer{value: 1 ether}();
        assertEq(address(attacker).balance, 0, "attacker holds no ETH pre-withdraw");
        vm.prank(address(attacker));
        market.cancelOffer(offerId);
        assertEq(market.proceeds(address(attacker)), 1 ether);

        // seed extra ETH in the market (another user's escrowed offer) so a
        // successful re-entrant drain would over-withdraw.
        vm.prank(buyer);
        market.makeOffer{value: 5 ether}(address(plain), 1);
        assertEq(address(market).balance, 6 ether);

        attacker.enableWithdrawAttack();
        attacker.withdraw();

        // attacker received exactly its 1 ether; re-entrant call was blocked.
        assertEq(address(attacker).balance, 1 ether, "no over-withdraw");
        assertEq(market.proceeds(address(attacker)), 0);
        assertFalse(attacker.reentered(), "re-entrant withdraw reverted");
        // other user's escrow untouched
        assertEq(address(market).balance, 5 ether);
    }

    /// A collection without EIP-2981 must not break the split (royalty = 0).
    function test_NoRoyaltyCollection_SplitsWithoutRoyalty() public {
        uint256 id = plain.mint(seller);
        vm.prank(seller);
        plain.setApprovalForAll(address(market), true);
        vm.prank(seller);
        market.listItem(address(plain), id, 4 ether);

        vm.prank(buyer);
        market.buyItem{value: 4 ether}(address(plain), id);

        uint256 fee = (4 ether * FEE_BPS) / 10_000;
        assertEq(market.proceeds(feeRecipient), fee);
        assertEq(market.proceeds(seller), 4 ether - fee, "seller gets all minus fee");
        assertEq(nft.balanceOf(address(this)), 0); // sanity
        assertEq(plain.ownerOf(id), buyer);
    }
}
