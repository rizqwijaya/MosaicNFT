// Deployed Sepolia addresses (see deployments/sepolia.json).
export const SEPOLIA_CHAIN_ID = 11155111;

export const MOSAIC_ERC721 =
  "0xd073a7563A7fcB3FA1651a5308C05c213430C834" as const;
export const MOSAIC_MARKET =
  "0x6f4c6951ba5dcF19952f9E7cA2D47eA1c30Ad131" as const;

// EIP-712 domain for NFTVoucher signing (must match the contract).
export const VOUCHER_DOMAIN = {
  name: "MosaicNFT",
  version: "1",
  chainId: SEPOLIA_CHAIN_ID,
  verifyingContract: MOSAIC_ERC721,
} as const;

export const VOUCHER_TYPES = {
  NFTVoucher: [
    { name: "nonce", type: "uint256" },
    { name: "minPrice", type: "uint256" },
    { name: "uri", type: "string" },
    { name: "royaltyBps", type: "uint96" },
    { name: "creator", type: "address" },
  ],
} as const;

// --- ABIs (only the entries the frontend uses) ---

export const erc721Abi = [
  {
    type: "function",
    name: "mintTo",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "uri", type: "string" },
      { name: "royaltyBps", type: "uint96" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "nonceUsed",
    stateMutability: "view",
    inputs: [
      { name: "creator", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const marketAbi = [
  {
    type: "function",
    name: "marketplaceFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint96" }],
  },
  {
    type: "function",
    name: "proceeds",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "listItem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelListing",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "buyItem",
    stateMutability: "payable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "buyLazy",
    stateMutability: "payable",
    inputs: [
      { name: "collection", type: "address" },
      {
        name: "voucher",
        type: "tuple",
        components: [
          { name: "nonce", type: "uint256" },
          { name: "minPrice", type: "uint256" },
          { name: "uri", type: "string" },
          { name: "royaltyBps", type: "uint96" },
          { name: "creator", type: "address" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "createAuction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "startPrice", type: "uint256" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [{ name: "auctionId", type: "uint256" }],
  },
  {
    type: "function",
    name: "placeBid",
    stateMutability: "payable",
    inputs: [{ name: "auctionId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "settleAuction",
    stateMutability: "nonpayable",
    inputs: [{ name: "auctionId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "makeOffer",
    stateMutability: "payable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "offerId", type: "uint256" }],
  },
  {
    type: "function",
    name: "cancelOffer",
    stateMutability: "nonpayable",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "acceptOffer",
    stateMutability: "nonpayable",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawProceeds",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;
