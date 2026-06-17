// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title MosaicERC721: shared creator collection for MosaicNFT.
/// @notice ERC-721 with per-token IPFS metadata, per-token EIP-2981 royalties,
///         direct mint, and lazy-mint redemption via EIP-712 signed vouchers.
/// @dev Lazy-mint vouchers are signed off-chain by a creator and only minted
///      on-chain when a buyer purchases through MosaicMarket (mint-on-buy).
contract MosaicERC721 is ERC721URIStorage, ERC2981, Ownable, EIP712 {
    /// @notice A lazy-mint voucher signed off-chain by a creator.
    /// @param nonce      Unique per creator; prevents replay.
    /// @param minPrice   Wei the buyer must pay.
    /// @param uri        IPFS metadata URI for the token.
    /// @param royaltyBps Creator royalty in basis points.
    /// @param creator    Signer and royalty receiver.
    /// @param signature  EIP-712 signature over the above fields.
    struct NFTVoucher {
        uint256 nonce;
        uint256 minPrice;
        string uri;
        uint96 royaltyBps;
        address creator;
        bytes signature;
    }

    /// @dev EIP-712 typehash for NFTVoucher (signature excluded from the struct hash).
    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "NFTVoucher(uint256 nonce,uint256 minPrice,string uri,uint96 royaltyBps,address creator)"
    );

    /// @notice The only address allowed to call {redeem}.
    address public market;

    /// @notice Auto-incrementing token id counter.
    uint256 private _nextTokenId = 1;

    /// @notice Tracks used voucher nonces per creator to prevent replay.
    mapping(address creator => mapping(uint256 nonce => bool used)) public nonceUsed;

    event Minted(uint256 indexed tokenId, address indexed creator, string uri);
    event MarketSet(address indexed market);

    error MosaicERC721__NotMarket();
    error MosaicERC721__InvalidSignature();
    error MosaicERC721__NonceAlreadyUsed();
    error MosaicERC721__RoyaltyTooHigh();
    error MosaicERC721__ZeroAddress();

    modifier onlyMarket() {
        if (msg.sender != market) revert MosaicERC721__NotMarket();
        _;
    }

    constructor(string memory name_, string memory symbol_, address owner_)
        ERC721(name_, symbol_)
        Ownable(owner_)
        EIP712("MosaicNFT", "1")
    {}

    /// @notice Owner sets the authorized marketplace allowed to call {redeem}.
    function setMarket(address market_) external onlyOwner {
        if (market_ == address(0)) revert MosaicERC721__ZeroAddress();
        market = market_;
        emit MarketSet(market_);
    }

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

    /// @notice Mint a lazily-listed token. Callable only by MosaicMarket.
    /// @dev Verifies the EIP-712 signature recovers `voucher.creator`, marks the
    ///      nonce used, mints to `buyer`, and sets URI + royalty to the creator.
    /// @param buyer   The purchaser receiving the token.
    /// @param voucher The signed voucher.
    /// @return tokenId The minted token id.
    function redeem(address buyer, NFTVoucher calldata voucher)
        external
        onlyMarket
        returns (uint256 tokenId)
    {
        if (buyer == address(0)) revert MosaicERC721__ZeroAddress();
        if (voucher.royaltyBps > _feeDenominator()) revert MosaicERC721__RoyaltyTooHigh();

        address signer = _recoverVoucherSigner(voucher);
        if (signer != voucher.creator) revert MosaicERC721__InvalidSignature();
        if (nonceUsed[voucher.creator][voucher.nonce]) revert MosaicERC721__NonceAlreadyUsed();

        nonceUsed[voucher.creator][voucher.nonce] = true;

        tokenId = _nextTokenId++;
        _safeMint(buyer, tokenId);
        _setTokenURI(tokenId, voucher.uri);
        _setTokenRoyalty(tokenId, voucher.creator, voucher.royaltyBps);

        emit Minted(tokenId, voucher.creator, voucher.uri);
    }

    /// @notice Recover the signer of a voucher (view helper for off-chain checks).
    function recoverVoucherSigner(NFTVoucher calldata voucher) external view returns (address) {
        return _recoverVoucherSigner(voucher);
    }

    function _recoverVoucherSigner(NFTVoucher calldata voucher) internal view returns (address) {
        bytes32 structHash = keccak256(
            abi.encode(
                VOUCHER_TYPEHASH,
                voucher.nonce,
                voucher.minPrice,
                keccak256(bytes(voucher.uri)),
                voucher.royaltyBps,
                voucher.creator
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        return ECDSA.recover(digest, voucher.signature);
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
