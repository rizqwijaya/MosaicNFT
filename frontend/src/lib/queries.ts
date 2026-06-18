// GraphQL documents for the MosaicNFT subgraph.

export const ACTIVE_LISTINGS = `
  query ActiveListings($first: Int!, $orderBy: Listing_orderBy!, $orderDirection: OrderDirection!) {
    listings(where: { active: true }, first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {
      id
      price
      createdAt
      seller { id }
      token {
        id
        tokenId
        tokenURI
        collection { id }
        owner { id }
      }
    }
  }
`;

export const LIVE_AUCTIONS = `
  query LiveAuctions($first: Int!, $now: BigInt!) {
    auctions(where: { settled: false }, first: $first, orderBy: endTime, orderDirection: asc) {
      id
      startPrice
      highestBid
      endTime
      settled
      highestBidder { id }
      seller { id }
      token {
        id
        tokenId
        tokenURI
        collection { id }
        owner { id }
      }
    }
  }
`;

export const ACTIVE_AIRDROPS = `
  query ActiveAirdrops($first: Int!) {
    airdrops(where: { active: true }, first: $first, orderBy: createdAt, orderDirection: desc) {
      id
      uri
      royaltyBps
      maxClaims
      claimed
      active
      createdAt
      creator { id }
      collection { id name }
    }
  }
`;

export const AIRDROP_DETAIL = `
  query AirdropDetail($id: ID!) {
    airdrop(id: $id) {
      id
      uri
      royaltyBps
      maxClaims
      claimed
      active
      createdAt
      creator { id }
      collection { id name }
    }
  }
`;

export const TOKEN_DETAIL = `
  query TokenDetail($id: ID!) {
    token(id: $id) {
      id
      tokenId
      tokenURI
      createdAt
      collection { id name }
      creator { id }
      owner { id }
      listing { id price active seller { id } }
      auctions(orderBy: createdAt, orderDirection: desc, first: 1) {
        id startPrice highestBid endTime settled highestBidder { id } seller { id }
      }
      offers(where: { active: true }, orderBy: amount, orderDirection: desc) {
        id amount active buyer { id }
      }
      sales(orderBy: timestamp, orderDirection: desc) {
        id price kind timestamp seller { id } buyer { id }
      }
    }
  }
`;

export const COLLECTION_TOKENS = `
  query CollectionTokens($id: ID!, $first: Int!) {
    collection(id: $id) {
      id
      name
      tokens(first: $first, orderBy: tokenId, orderDirection: desc) {
        id tokenId tokenURI owner { id } listing { id price active }
      }
    }
  }
`;

export const USER_PROFILE = `
  query UserProfile($id: ID!) {
    user(id: $id) {
      id
      totalWithdrawn
      ownedTokens(first: 100) { id tokenId tokenURI collection { id } listing { id price active } }
      createdTokens(first: 100) { id tokenId tokenURI collection { id } }
    }
    sales(where: { or: [{ seller: $id }, { buyer: $id }] }, orderBy: timestamp, orderDirection: desc, first: 50) {
      id price kind timestamp token { id tokenId collection { id } } seller { id } buyer { id }
    }
  }
`;
