// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MosaicERC721} from "./MosaicERC721.sol";

/// @dev Minimal interface for lazy-mint redemption on a Mosaic collection.
interface IMosaicCollection {
    function redeem(address buyer, MosaicERC721.NFTVoucher calldata voucher)
        external
        returns (uint256 tokenId);
}

/// @title MosaicMarket: the MosaicNFT marketplace.
/// @notice Fixed-price listings, English auctions, offers, and lazy-mint
///         purchases. Orchestrates all payments, marketplace fees, and
///         EIP-2981 royalty distribution.
/// @dev Follows checks-effects-interactions. All outgoing value uses a
///      pull-payment pattern (credited to {proceeds}, withdrawn by the
///      recipient). ReentrancyGuard protects every fund/NFT-moving entry point.
contract MosaicMarket is Ownable, ReentrancyGuard, ERC721Holder {
    uint96 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Marketplace fee in basis points (e.g. 250 = 2.5%).
    uint96 public marketplaceFeeBps;
    /// @notice Address receiving marketplace fees (credited via pull-payment).
    address public feeRecipient;

    struct Listing {
        address seller;
        uint256 price;
    }

    struct Auction {
        address collection;
        uint256 tokenId;
        address seller;
        uint256 startPrice;
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool settled;
    }

    struct Offer {
        address collection;
        uint256 tokenId;
        address buyer;
        uint256 amount;
        bool active;
    }

    /// @notice Active fixed-price listings: collection => tokenId => Listing.
    mapping(address collection => mapping(uint256 tokenId => Listing)) public listings;

    /// @notice Auctions by id.
    mapping(uint256 auctionId => Auction) public auctions;
    uint256 public nextAuctionId = 1;

    /// @notice Offers by id.
    mapping(uint256 offerId => Offer) public offers;
    uint256 public nextOfferId = 1;

    /// @notice Pull-payment balances: address => withdrawable wei.
    mapping(address account => uint256 amount) public proceeds;

    // --- events (drive the subgraph) ---
    event ItemListed(
        address indexed collection, uint256 indexed tokenId, address indexed seller, uint256 price
    );
    event ListingCancelled(
        address indexed collection, uint256 indexed tokenId, address indexed seller
    );
    event ItemSold(
        address indexed collection,
        uint256 indexed tokenId,
        address seller,
        address indexed buyer,
        uint256 price
    );
    event LazyMintSold(
        address indexed collection,
        uint256 indexed tokenId,
        address creator,
        address indexed buyer,
        uint256 price
    );
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed collection,
        uint256 indexed tokenId,
        address seller,
        uint256 startPrice,
        uint256 endTime
    );
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionSettled(
        uint256 indexed auctionId, address indexed winner, uint256 amount
    );
    event OfferMade(
        uint256 indexed offerId,
        address indexed collection,
        uint256 indexed tokenId,
        address buyer,
        uint256 amount
    );
    event OfferCancelled(uint256 indexed offerId);
    event OfferAccepted(
        uint256 indexed offerId, address indexed seller, address indexed buyer, uint256 amount
    );
    event ProceedsWithdrawn(address indexed account, uint256 amount);
    event FeeConfigUpdated(uint96 feeBps, address feeRecipient);

    // --- errors ---
    error Mosaic__FeeTooHigh();
    error Mosaic__ZeroAddress();
    error Mosaic__ZeroPrice();
    error Mosaic__NotOwner();
    error Mosaic__NotApproved();
    error Mosaic__NotListed();
    error Mosaic__AlreadyListed();
    error Mosaic__WrongPrice();
    error Mosaic__SelfBuy();
    error Mosaic__BadDuration();
    error Mosaic__AuctionEnded();
    error Mosaic__AuctionNotEnded();
    error Mosaic__AuctionInactive();
    error Mosaic__BidTooLow();
    error Mosaic__OfferInactive();
    error Mosaic__NotOfferOwner();
    error Mosaic__ZeroOffer();
    error Mosaic__InsufficientPayment();
    error Mosaic__NothingToWithdraw();
    error Mosaic__TransferFailed();

    constructor(uint96 feeBps_, address feeRecipient_, address owner_) Ownable(owner_) {
        if (feeBps_ > BPS_DENOMINATOR) revert Mosaic__FeeTooHigh();
        if (feeRecipient_ == address(0)) revert Mosaic__ZeroAddress();
        marketplaceFeeBps = feeBps_;
        feeRecipient = feeRecipient_;
    }

    // ---------------------------------------------------------------
    // Config
    // ---------------------------------------------------------------

    function setFeeConfig(uint96 feeBps_, address feeRecipient_) external onlyOwner {
        if (feeBps_ > BPS_DENOMINATOR) revert Mosaic__FeeTooHigh();
        if (feeRecipient_ == address(0)) revert Mosaic__ZeroAddress();
        marketplaceFeeBps = feeBps_;
        feeRecipient = feeRecipient_;
        emit FeeConfigUpdated(feeBps_, feeRecipient_);
    }

    // ---------------------------------------------------------------
    // Fixed-price listings
    // ---------------------------------------------------------------

    /// @notice List an owned, approved NFT at a fixed price.
    function listItem(address collection, uint256 tokenId, uint256 price) external {
        if (price == 0) revert Mosaic__ZeroPrice();
        if (IERC721(collection).ownerOf(tokenId) != msg.sender) revert Mosaic__NotOwner();
        if (!_isApproved(collection, tokenId, msg.sender)) revert Mosaic__NotApproved();
        if (listings[collection][tokenId].seller != address(0)) revert Mosaic__AlreadyListed();

        listings[collection][tokenId] = Listing({seller: msg.sender, price: price});
        emit ItemListed(collection, tokenId, msg.sender, price);
    }

    /// @notice Cancel an active listing (seller only).
    function cancelListing(address collection, uint256 tokenId) external {
        Listing memory listing = listings[collection][tokenId];
        if (listing.seller == address(0)) revert Mosaic__NotListed();
        if (listing.seller != msg.sender) revert Mosaic__NotOwner();

        delete listings[collection][tokenId];
        emit ListingCancelled(collection, tokenId, msg.sender);
    }

    /// @notice Buy a fixed-price listing. Splits payment into royalty, fee, and
    ///         seller proceeds (all credited for pull-withdrawal), then transfers
    ///         the NFT. Secondary sale: royalty honored via EIP-2981.
    function buyItem(address collection, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[collection][tokenId];
        if (listing.seller == address(0)) revert Mosaic__NotListed();
        if (msg.value != listing.price) revert Mosaic__WrongPrice();
        if (msg.sender == listing.seller) revert Mosaic__SelfBuy();

        // effects
        delete listings[collection][tokenId];
        _splitSecondary(collection, tokenId, listing.price, listing.seller);

        // interactions
        IERC721(collection).safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit ItemSold(collection, tokenId, listing.seller, msg.sender, listing.price);
    }

    // ---------------------------------------------------------------
    // Lazy mint purchase (primary sale)
    // ---------------------------------------------------------------

    /// @notice Buy a lazily-listed token: mints on-chain and pays the creator.
    /// @dev Primary sale: proceeds go to the creator directly (minus fee), and
    ///      no separate EIP-2981 royalty is applied on this first sale.
    function buyLazy(address collection, MosaicERC721.NFTVoucher calldata voucher)
        external
        payable
        nonReentrant
    {
        if (msg.value < voucher.minPrice) revert Mosaic__InsufficientPayment();

        // interaction (mint): the collection re-verifies the signature & nonce.
        uint256 tokenId = IMosaicCollection(collection).redeem(msg.sender, voucher);

        // effects: primary sale split: fee + creator proceeds.
        uint256 fee = (msg.value * marketplaceFeeBps) / BPS_DENOMINATOR;
        uint256 creatorProceeds = msg.value - fee;
        if (fee > 0) proceeds[feeRecipient] += fee;
        proceeds[voucher.creator] += creatorProceeds;

        emit LazyMintSold(collection, tokenId, voucher.creator, msg.sender, msg.value);
    }

    // ---------------------------------------------------------------
    // Auctions (English)
    // ---------------------------------------------------------------

    /// @notice Create an auction; the NFT is escrowed in the marketplace.
    function createAuction(
        address collection,
        uint256 tokenId,
        uint256 startPrice,
        uint256 duration
    ) external nonReentrant returns (uint256 auctionId) {
        if (startPrice == 0) revert Mosaic__ZeroPrice();
        if (duration == 0) revert Mosaic__BadDuration();
        if (IERC721(collection).ownerOf(tokenId) != msg.sender) revert Mosaic__NotOwner();

        auctionId = nextAuctionId++;
        auctions[auctionId] = Auction({
            collection: collection,
            tokenId: tokenId,
            seller: msg.sender,
            startPrice: startPrice,
            highestBid: 0,
            highestBidder: address(0),
            endTime: block.timestamp + duration,
            settled: false
        });

        // escrow the NFT
        IERC721(collection).safeTransferFrom(msg.sender, address(this), tokenId);

        emit AuctionCreated(
            auctionId, collection, tokenId, msg.sender, startPrice, block.timestamp + duration
        );
    }

    /// @notice Place a bid. Must beat the current bid (or meet startPrice).
    ///         The previous bidder is refunded via pull-payment.
    function placeBid(uint256 auctionId) external payable nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.seller == address(0) || a.settled) revert Mosaic__AuctionInactive();
        if (block.timestamp >= a.endTime) revert Mosaic__AuctionEnded();

        uint256 minBid = a.highestBid == 0 ? a.startPrice : a.highestBid + 1;
        if (msg.value < minBid) revert Mosaic__BidTooLow();

        address prevBidder = a.highestBidder;
        uint256 prevBid = a.highestBid;

        a.highestBid = msg.value;
        a.highestBidder = msg.sender;

        // refund previous bidder via pull-payment (no push).
        if (prevBidder != address(0)) {
            proceeds[prevBidder] += prevBid;
        }

        emit BidPlaced(auctionId, msg.sender, msg.value);
    }

    /// @notice Settle an ended auction. Anyone may call after expiry.
    ///         Transfers NFT to the winner and splits funds (royalty + fee +
    ///         seller). If there were no bids, returns the NFT to the seller.
    function settleAuction(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        if (a.seller == address(0) || a.settled) revert Mosaic__AuctionInactive();
        if (block.timestamp < a.endTime) revert Mosaic__AuctionNotEnded();

        a.settled = true;

        if (a.highestBidder == address(0)) {
            // no bids: return escrowed NFT to seller.
            IERC721(a.collection).safeTransferFrom(address(this), a.seller, a.tokenId);
            emit AuctionSettled(auctionId, address(0), 0);
            return;
        }

        // effects: split the winning bid.
        _splitSecondary(a.collection, a.tokenId, a.highestBid, a.seller);

        // interaction: deliver NFT to winner.
        IERC721(a.collection).safeTransferFrom(address(this), a.highestBidder, a.tokenId);

        emit AuctionSettled(auctionId, a.highestBidder, a.highestBid);
    }

    // ---------------------------------------------------------------
    // Offers
    // ---------------------------------------------------------------

    /// @notice Make an offer on a token; the offered amount is escrowed.
    function makeOffer(address collection, uint256 tokenId)
        external
        payable
        nonReentrant
        returns (uint256 offerId)
    {
        if (msg.value == 0) revert Mosaic__ZeroOffer();

        offerId = nextOfferId++;
        offers[offerId] = Offer({
            collection: collection,
            tokenId: tokenId,
            buyer: msg.sender,
            amount: msg.value,
            active: true
        });

        emit OfferMade(offerId, collection, tokenId, msg.sender, msg.value);
    }

    /// @notice Cancel an offer; the escrowed amount is refunded via pull-payment.
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage o = offers[offerId];
        if (!o.active) revert Mosaic__OfferInactive();
        if (o.buyer != msg.sender) revert Mosaic__NotOfferOwner();

        o.active = false;
        proceeds[o.buyer] += o.amount;

        emit OfferCancelled(offerId);
    }

    /// @notice Accept an offer (must be the NFT owner). Splits escrowed funds
    ///         (royalty + fee + seller) and transfers the NFT to the buyer.
    function acceptOffer(uint256 offerId) external nonReentrant {
        Offer storage o = offers[offerId];
        if (!o.active) revert Mosaic__OfferInactive();

        address collection = o.collection;
        uint256 tokenId = o.tokenId;
        if (IERC721(collection).ownerOf(tokenId) != msg.sender) revert Mosaic__NotOwner();
        if (!_isApproved(collection, tokenId, msg.sender)) revert Mosaic__NotApproved();

        uint256 amount = o.amount;
        address buyer = o.buyer;

        // effects
        o.active = false;
        _splitSecondary(collection, tokenId, amount, msg.sender);

        // interaction
        IERC721(collection).safeTransferFrom(msg.sender, buyer, tokenId);

        emit OfferAccepted(offerId, msg.sender, buyer, amount);
    }

    // ---------------------------------------------------------------
    // Proceeds (pull-payment)
    // ---------------------------------------------------------------

    /// @notice Withdraw the caller's accumulated proceeds/refunds.
    function withdrawProceeds() external nonReentrant {
        uint256 amount = proceeds[msg.sender];
        if (amount == 0) revert Mosaic__NothingToWithdraw();

        proceeds[msg.sender] = 0; // effects before interaction
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert Mosaic__TransferFailed();

        emit ProceedsWithdrawn(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------

    /// @dev Split a secondary-sale `price` into EIP-2981 royalty, marketplace
    ///      fee, and seller proceeds, all credited for pull-withdrawal.
    function _splitSecondary(
        address collection,
        uint256 tokenId,
        uint256 price,
        address seller
    ) internal {
        (address royaltyReceiver, uint256 royaltyAmount) = _royaltyInfo(collection, tokenId, price);
        uint256 fee = (price * marketplaceFeeBps) / BPS_DENOMINATOR;

        // Guard against a misconfigured royalty exceeding the price.
        if (royaltyAmount + fee > price) {
            royaltyAmount = price > fee ? price - fee : 0;
        }
        uint256 sellerProceeds = price - fee - royaltyAmount;

        if (fee > 0) proceeds[feeRecipient] += fee;
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            proceeds[royaltyReceiver] += royaltyAmount;
        } else if (royaltyAmount > 0) {
            // royalty owed but no receiver: fold back into seller proceeds.
            sellerProceeds += royaltyAmount;
        }
        proceeds[seller] += sellerProceeds;
    }

    /// @dev Safe EIP-2981 lookup; returns (0,0) for collections without royalties.
    function _royaltyInfo(address collection, uint256 tokenId, uint256 price)
        internal
        view
        returns (address receiver, uint256 amount)
    {
        try IERC165(collection).supportsInterface(type(IERC2981).interfaceId) returns (bool ok) {
            if (!ok) return (address(0), 0);
        } catch {
            return (address(0), 0);
        }
        try IERC2981(collection).royaltyInfo(tokenId, price) returns (address r, uint256 a) {
            return (r, a);
        } catch {
            return (address(0), 0);
        }
    }

    function _isApproved(address collection, uint256 tokenId, address owner)
        internal
        view
        returns (bool)
    {
        IERC721 nft = IERC721(collection);
        return nft.getApproved(tokenId) == address(this)
            || nft.isApprovedForAll(owner, address(this));
    }
}
