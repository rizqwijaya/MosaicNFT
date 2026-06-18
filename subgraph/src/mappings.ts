import { BigInt } from "@graphprotocol/graph-ts";
import {
  Minted,
  Transfer,
  AirdropCreated,
  AirdropClaimed,
  AirdropClosed,
} from "../generated/MosaicERC721/MosaicERC721";
import {
  ItemListed,
  ListingCancelled,
  ItemSold,
  AuctionCreated,
  BidPlaced,
  AuctionSettled,
  OfferMade,
  OfferCancelled,
  OfferAccepted,
  ProceedsWithdrawn,
} from "../generated/MosaicMarket/MosaicMarket";
import {
  Airdrop,
  AirdropClaim,
  Auction,
  Bid,
  Listing,
  Offer,
  Sale,
} from "../generated/schema";
import {
  eventId,
  getOrCreateCollection,
  getOrCreateToken,
  getOrCreateUser,
  tokenKey,
  ZERO,
  ZERO_ADDRESS,
} from "./helpers";

// ---------------------------------------------------------------
// MosaicERC721
// ---------------------------------------------------------------

export function handleMinted(event: Minted): void {
  // event.address is the collection (the ERC721 contract that emitted).
  let token = getOrCreateToken(
    event.address,
    event.params.tokenId,
    event.block.timestamp
  );
  let creator = getOrCreateUser(event.params.creator);
  token.creator = creator.id;
  token.tokenURI = event.params.uri;
  if (token.createdAt === null) {
    token.createdAt = event.block.timestamp;
  }
  token.save();
}

export function handleTransfer(event: Transfer): void {
  // Authoritative owner source. Covers mint (from 0x0), buy, auction escrow,
  // settle, and offer-accept transfers.
  let token = getOrCreateToken(
    event.address,
    event.params.tokenId,
    event.block.timestamp
  );
  let to = getOrCreateUser(event.params.to);
  token.owner = to.id;
  token.save();
}

// ---------------------------------------------------------------
// MosaicMarket: fixed-price listings
// ---------------------------------------------------------------

export function handleItemListed(event: ItemListed): void {
  let token = getOrCreateToken(
    event.params.collection,
    event.params.tokenId,
    event.block.timestamp
  );
  let seller = getOrCreateUser(event.params.seller);

  let id = tokenKey(event.params.collection, event.params.tokenId);
  let listing = Listing.load(id);
  if (listing == null) {
    listing = new Listing(id);
    listing.createdAt = event.block.timestamp;
  }
  listing.token = token.id;
  listing.seller = seller.id;
  listing.price = event.params.price;
  listing.active = true;
  listing.updatedAt = event.block.timestamp;
  listing.save();
}

export function handleListingCancelled(event: ListingCancelled): void {
  let id = tokenKey(event.params.collection, event.params.tokenId);
  let listing = Listing.load(id);
  if (listing == null) return;
  listing.active = false;
  listing.updatedAt = event.block.timestamp;
  listing.save();
}

export function handleItemSold(event: ItemSold): void {
  let token = getOrCreateToken(
    event.params.collection,
    event.params.tokenId,
    event.block.timestamp
  );
  getOrCreateCollection(event.params.collection);
  let seller = getOrCreateUser(event.params.seller);
  let buyer = getOrCreateUser(event.params.buyer);

  // deactivate listing
  let listingId = tokenKey(event.params.collection, event.params.tokenId);
  let listing = Listing.load(listingId);
  if (listing != null) {
    listing.active = false;
    listing.updatedAt = event.block.timestamp;
    listing.save();
  }

  let sale = new Sale(eventId(event));
  sale.token = token.id;
  sale.seller = seller.id;
  sale.buyer = buyer.id;
  sale.price = event.params.price;
  sale.kind = "FIXED";
  sale.timestamp = event.block.timestamp;
  sale.save();
}

// ---------------------------------------------------------------
// MosaicERC721: airdrop campaigns
// ---------------------------------------------------------------

export function handleAirdropCreated(event: AirdropCreated): void {
  // event.address is the collection (the ERC721 contract that emitted).
  let collection = getOrCreateCollection(event.address);
  let creator = getOrCreateUser(event.params.creator);

  let airdrop = new Airdrop(event.params.airdropId.toString());
  airdrop.collection = collection.id;
  airdrop.creator = creator.id;
  airdrop.uri = event.params.uri;
  airdrop.royaltyBps = event.params.royaltyBps.toI32();
  airdrop.maxClaims = event.params.maxClaims;
  airdrop.claimed = ZERO;
  airdrop.active = true;
  airdrop.createdAt = event.block.timestamp;
  airdrop.save();
}

export function handleAirdropClaimed(event: AirdropClaimed): void {
  let airdrop = Airdrop.load(event.params.airdropId.toString());
  if (airdrop == null) return;

  airdrop.claimed = airdrop.claimed.plus(BigInt.fromI32(1));
  airdrop.save();

  // Token entity is created/owned via Minted + Transfer (mint-on-claim).
  let token = getOrCreateToken(
    event.address,
    event.params.tokenId,
    event.block.timestamp
  );
  let claimer = getOrCreateUser(event.params.claimer);

  let claim = new AirdropClaim(eventId(event));
  claim.airdrop = airdrop.id;
  claim.claimer = claimer.id;
  claim.token = token.id;
  claim.timestamp = event.block.timestamp;
  claim.save();
}

export function handleAirdropClosed(event: AirdropClosed): void {
  let airdrop = Airdrop.load(event.params.airdropId.toString());
  if (airdrop == null) return;
  airdrop.active = false;
  airdrop.save();
}

// ---------------------------------------------------------------
// MosaicMarket: auctions
// ---------------------------------------------------------------

export function handleAuctionCreated(event: AuctionCreated): void {
  let token = getOrCreateToken(
    event.params.collection,
    event.params.tokenId,
    event.block.timestamp
  );
  let seller = getOrCreateUser(event.params.seller);

  let auction = new Auction(event.params.auctionId.toString());
  auction.token = token.id;
  auction.seller = seller.id;
  auction.startPrice = event.params.startPrice;
  auction.highestBid = ZERO;
  auction.highestBidder = null;
  auction.endTime = event.params.endTime;
  auction.settled = false;
  auction.createdAt = event.block.timestamp;
  auction.save();
}

export function handleBidPlaced(event: BidPlaced): void {
  let auction = Auction.load(event.params.auctionId.toString());
  if (auction == null) return;

  let bidder = getOrCreateUser(event.params.bidder);

  auction.highestBid = event.params.amount;
  auction.highestBidder = bidder.id;
  auction.save();

  let bid = new Bid(eventId(event));
  bid.auction = auction.id;
  bid.bidder = bidder.id;
  bid.amount = event.params.amount;
  bid.timestamp = event.block.timestamp;
  bid.save();
}

export function handleAuctionSettled(event: AuctionSettled): void {
  let auction = Auction.load(event.params.auctionId.toString());
  if (auction == null) return;

  auction.settled = true;
  auction.save();

  // winner == address(0) means no bids: NFT returned to seller, no Sale.
  if (event.params.winner.equals(ZERO_ADDRESS)) return;

  let winner = getOrCreateUser(event.params.winner);

  let sale = new Sale(eventId(event));
  sale.token = auction.token;
  sale.seller = auction.seller;
  sale.buyer = winner.id;
  sale.price = event.params.amount;
  sale.kind = "AUCTION";
  sale.timestamp = event.block.timestamp;
  sale.save();
}

// ---------------------------------------------------------------
// MosaicMarket: offers
// ---------------------------------------------------------------

export function handleOfferMade(event: OfferMade): void {
  let token = getOrCreateToken(
    event.params.collection,
    event.params.tokenId,
    event.block.timestamp
  );
  let buyer = getOrCreateUser(event.params.buyer);

  let offer = new Offer(event.params.offerId.toString());
  offer.token = token.id;
  offer.buyer = buyer.id;
  offer.amount = event.params.amount;
  offer.active = true;
  offer.createdAt = event.block.timestamp;
  offer.save();
}

export function handleOfferCancelled(event: OfferCancelled): void {
  let offer = Offer.load(event.params.offerId.toString());
  if (offer == null) return;
  offer.active = false;
  offer.save();
}

export function handleOfferAccepted(event: OfferAccepted): void {
  let offer = Offer.load(event.params.offerId.toString());
  if (offer == null) return;

  offer.active = false;
  offer.save();

  let seller = getOrCreateUser(event.params.seller);
  let buyer = getOrCreateUser(event.params.buyer);

  let sale = new Sale(eventId(event));
  sale.token = offer.token;
  sale.seller = seller.id;
  sale.buyer = buyer.id;
  sale.price = event.params.amount;
  sale.kind = "FIXED"; // offer-accept is a direct secondary sale
  sale.timestamp = event.block.timestamp;
  sale.save();
}

// ---------------------------------------------------------------
// MosaicMarket: proceeds
// ---------------------------------------------------------------

export function handleProceedsWithdrawn(event: ProceedsWithdrawn): void {
  let user = getOrCreateUser(event.params.account);
  user.totalWithdrawn = user.totalWithdrawn.plus(event.params.amount);
  user.save();
}
