// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {MosaicMarket} from "../../src/MosaicMarket.sol";

/// @dev A plain ERC-721 with no EIP-2981 support, to verify the market's
///      royalty lookup degrades gracefully (royalty = 0).
contract NoRoyalty721 is ERC721 {
    uint256 private _id = 1;

    constructor() ERC721("NoRoyalty", "NR") {}

    function mint(address to) external returns (uint256 id) {
        id = _id++;
        _mint(to, id);
    }
}

/// @dev Reentrancy attacker. On receiving ETH (during withdrawProceeds), it
///      attempts to re-enter the market. ReentrancyGuard must block it.
contract ReentrantAttacker {
    MosaicMarket public market;
    address public collection;
    uint256 public tokenId;
    bool public attackWithdraw;
    bool public reentered;

    constructor(MosaicMarket _market) {
        market = _market;
    }

    function setTarget(address _collection, uint256 _tokenId) external {
        collection = _collection;
        tokenId = _tokenId;
    }

    function buy() external payable {
        market.buyItem{value: msg.value}(collection, tokenId);
    }

    function makeOffer() external payable returns (uint256) {
        return market.makeOffer{value: msg.value}(collection, tokenId);
    }

    function enableWithdrawAttack() external {
        attackWithdraw = true;
    }

    function withdraw() external {
        market.withdrawProceeds();
    }

    // Re-enters on ETH receipt during withdrawProceeds.
    receive() external payable {
        if (attackWithdraw && address(market).balance > 0) {
            reentered = true;
            // This call must revert due to ReentrancyGuard; swallow to observe.
            try market.withdrawProceeds() {}
            catch {
                reentered = false;
            }
        }
    }
}
