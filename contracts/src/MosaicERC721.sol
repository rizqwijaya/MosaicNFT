// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title MosaicERC721: shared creator collection for MosaicNFT.
/// @notice ERC-721 with per-token IPFS metadata, per-token EIP-2981 royalties,
///         direct mint, and free airdrop campaigns (owner-funded, self-claimed).
/// @dev Airdrops let the owner publish a single artwork that many wallets can
///      claim for free (claimer pays only gas). Each wallet may claim a given
///      campaign at most once, capped by a per-campaign max.
contract MosaicERC721 is ERC721URIStorage, ERC2981, Ownable {
    /// @notice A free airdrop campaign created by the owner.
    /// @param uri        IPFS metadata URI minted to each claimer.
    /// @param royaltyBps Creator royalty in basis points for claimed tokens.
    /// @param maxClaims  Maximum number of tokens claimable (0 = unlimited).
    /// @param claimed    Number of tokens claimed so far.
    /// @param active     Whether the campaign currently accepts claims.
    /// @param creator    Royalty receiver for tokens minted from this campaign.
    struct Airdrop {
        string uri;
        uint96 royaltyBps;
        uint64 maxClaims;
        uint64 claimed;
        bool active;
        address creator;
    }

    /// @notice Auto-incrementing token id counter.
    uint256 private _nextTokenId = 1;

    /// @notice Airdrop campaigns by id.
    mapping(uint256 airdropId => Airdrop) public airdrops;
    uint256 public nextAirdropId = 1;

    /// @notice Tracks which wallets have claimed a given campaign.
    mapping(uint256 airdropId => mapping(address claimer => bool)) public hasClaimed;

    event Minted(uint256 indexed tokenId, address indexed creator, string uri);
    event AirdropCreated(
        uint256 indexed airdropId, address indexed creator, string uri, uint96 royaltyBps, uint64 maxClaims
    );
    event AirdropClaimed(uint256 indexed airdropId, address indexed claimer, uint256 indexed tokenId);
    event AirdropClosed(uint256 indexed airdropId);

    error MosaicERC721__RoyaltyTooHigh();
    error MosaicERC721__ZeroAddress();
    error MosaicERC721__AirdropNotFound();
    error MosaicERC721__AirdropInactive();
    error MosaicERC721__AirdropExhausted();
    error MosaicERC721__AlreadyClaimed();

    constructor(string memory name_, string memory symbol_, address owner_)
        ERC721(name_, symbol_)
        Ownable(owner_)
    {}

    // ---------------------------------------------------------------
    // Direct mint
    // ---------------------------------------------------------------

    /// @notice Direct mint by a creator; sets royalty receiver to the creator.
    /// @param to         Recipient of the new token.
    /// @param uri        IPFS metadata URI.
    /// @param royaltyBps Royalty in basis points (<= 10000).
    /// @return tokenId   The minted token id.
    function mintTo(address to, string calldata uri, uint96 royaltyBps)
        external
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert MosaicERC721__ZeroAddress();
        if (royaltyBps > _feeDenominator()) revert MosaicERC721__RoyaltyTooHigh();

        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        // Royalty receiver is the creator (msg.sender), not necessarily `to`.
        _setTokenRoyalty(tokenId, msg.sender, royaltyBps);

        emit Minted(tokenId, msg.sender, uri);
    }

    // ---------------------------------------------------------------
    // Free airdrop campaigns
    // ---------------------------------------------------------------

    /// @notice Create a free airdrop campaign. Owner only.
    /// @param uri        IPFS metadata URI minted to each claimer.
    /// @param royaltyBps Creator royalty in basis points (<= 10000).
    /// @param maxClaims  Max claimable tokens (0 = unlimited).
    /// @return airdropId The new campaign id.
    function createAirdrop(string calldata uri, uint96 royaltyBps, uint64 maxClaims)
        external
        onlyOwner
        returns (uint256 airdropId)
    {
        if (royaltyBps > _feeDenominator()) revert MosaicERC721__RoyaltyTooHigh();

        airdropId = nextAirdropId++;
        airdrops[airdropId] = Airdrop({
            uri: uri,
            royaltyBps: royaltyBps,
            maxClaims: maxClaims,
            claimed: 0,
            active: true,
            creator: msg.sender
        });

        emit AirdropCreated(airdropId, msg.sender, uri, royaltyBps, maxClaims);
    }

    /// @notice Claim a free token from an active campaign. One per wallet.
    /// @dev The claimer pays only gas; the token mints directly to them.
    /// @param airdropId The campaign to claim from.
    /// @return tokenId  The minted token id.
    function claimAirdrop(uint256 airdropId) external returns (uint256 tokenId) {
        Airdrop storage a = airdrops[airdropId];
        if (a.creator == address(0)) revert MosaicERC721__AirdropNotFound();
        if (!a.active) revert MosaicERC721__AirdropInactive();
        if (hasClaimed[airdropId][msg.sender]) revert MosaicERC721__AlreadyClaimed();
        if (a.maxClaims != 0 && a.claimed >= a.maxClaims) revert MosaicERC721__AirdropExhausted();

        // effects
        hasClaimed[airdropId][msg.sender] = true;
        a.claimed += 1;

        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, a.uri);
        _setTokenRoyalty(tokenId, a.creator, a.royaltyBps);

        emit Minted(tokenId, a.creator, a.uri);
        emit AirdropClaimed(airdropId, msg.sender, tokenId);
    }

    /// @notice Close a campaign so it no longer accepts claims. Owner only.
    function closeAirdrop(uint256 airdropId) external onlyOwner {
        Airdrop storage a = airdrops[airdropId];
        if (a.creator == address(0)) revert MosaicERC721__AirdropNotFound();
        a.active = false;
        emit AirdropClosed(airdropId);
    }

    // --- required overrides for multiple inheritance ---

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
