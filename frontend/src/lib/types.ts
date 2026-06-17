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
  kind: "FIXED" | "AUCTION" | "LAZY";
  timestamp: string;
  seller?: GqlUser | null;
  buyer: GqlUser;
  token?: GqlToken;
}

// The signed lazy-mint voucher stored off-chain and redeemed on buyLazy.
export interface Voucher {
  nonce: string;
  minPrice: string;
  uri: string;
  royaltyBps: number;
  creator: string;
  signature: string;
}

// Voucher record as stored/served by the vouchers Netlify function.
export interface VoucherRecord {
  id: string; // `${collection}-${nonce}`
  collection: string;
  voucher: Voucher;
  name?: string;
  image?: string; // ipfs:// for card preview
  redeemed?: boolean;
  createdAt: number;
}
