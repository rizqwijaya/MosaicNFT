export interface GqlUser {
  id: string;
}
export interface GqlCollection {
  id: string;
  name?: string | null;
}
export interface GqlToken {
  id: string;
  tokenId: string;
  tokenURI?: string | null;
  collection: GqlCollection;
  owner?: GqlUser | null;
  creator?: GqlUser | null;
  createdAt?: string;
  listing?: GqlListing | null;
}
export interface GqlListing {
  id: string;
  price: string;
  active: boolean;
  createdAt?: string;
  seller?: GqlUser;
  token?: GqlToken;
}
export interface GqlAuction {
  id: string;
  startPrice: string;
  highestBid: string;
  endTime: string;
  settled: boolean;
  highestBidder?: GqlUser | null;
  seller?: GqlUser;
  token?: GqlToken;
}
export interface GqlBid {
  id: string;
  amount: string;
  timestamp: string;
  bidder: GqlUser;
}
export interface GqlOffer {
  id: string;
  amount: string;
  active: boolean;
  buyer: GqlUser;
}
export interface GqlSale {
  id: string;
  price: string;
  kind: "FIXED" | "AUCTION";
  timestamp: string;
  seller?: GqlUser | null;
  buyer: GqlUser;
  token?: GqlToken;
}

// A free airdrop campaign (owner-funded, self-claimed).
export interface GqlAirdrop {
  id: string;
  uri: string;
  royaltyBps: number;
  maxClaims: string; // BigInt as string; "0" = unlimited
  claimed: string; // BigInt as string
  active: boolean;
  createdAt?: string;
  creator: GqlUser;
  collection: GqlCollection;
}
