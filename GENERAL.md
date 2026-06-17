# MosaicNFT — GENERAL.md

> **Tagline:** *Pieces. Collected. Connected.*

This document is the single source of truth for building **MosaicNFT**. It is written to be consumed by Claude Code in VS Code. Build in the order described in **§9 Build Sequence**.

---

## 1. Overview

MosaicNFT is a full-stack NFT marketplace on an EVM testnet. Creators can mint and list NFTs; collectors can buy at a fixed price, bid in auctions, or make offers. Royalties are honored on every secondary sale. The project is designed to demonstrate the exact skills freelance clients hire for (marketplace mechanics, ERC-721/1155, EIP-2981, minting) plus three senior-level differentiators:

1. **Lazy minting via EIP-712 signed vouchers** — creators sign an off-chain voucher; the NFT is only minted on-chain when a buyer purchases it (mint-on-buy). No upfront gas for creators.
2. **Subgraph-powered frontend** — all listings, auctions, offers, and history are read from a The Graph subgraph, not by scanning chain state. Demonstrates full-stack Web3 competence.
3. **Polished, gallery-grade UX** — a distinctive interface, not a default template.

**Positioning (for portfolio/proposals):** an *NFT marketplace + minting + token-gated creator tooling for digital art*, not "an OpenSea clone."

---

## 2. Scope

**In scope (core):**
- ERC-721 collection with on-chain royalties (EIP-2981)
- Marketplace: fixed-price listings, English auctions, and offers
- Lazy minting (EIP-712 voucher redemption)
- Marketplace fee + royalty distribution
- Subgraph indexer for all marketplace activity
- React frontend: explore, item detail, create/mint, collection, profile

**Secondary (include if time allows, keep clean for later):**
- ERC-1155 multi-edition support

**Out of scope (do not build):**
- Cross-chain / bridging
- Fiat on-ramp
- Mobile native app
- Mainnet deployment (testnet only)

Keep the core tight and fully finished before touching anything secondary. A complete small marketplace beats a sprawling half-built one.

---

## 3. Architecture

```
                 ┌──────────────────────────────┐
                 │         Frontend (React)       │
                 │  wagmi/viem + RainbowKit + TW  │
                 └───────────────┬───────────────┘
                  reads (queries)│ writes (txs)
            ┌────────────────────┴───────────────────┐
            │                                         │
   ┌────────▼────────┐                     ┌──────────▼──────────┐
   │  Subgraph (Graph)│  indexes events    │  Smart Contracts     │
   │  Collections /   │◄───────────────────│  MosaicERC721        │
   │  Listings / Bids │                     │  MosaicMarket        │
   │  Offers / Sales  │                     │  (MosaicERC1155)*    │
   └─────────────────┘                     └──────────┬──────────┘
                                                       │
                                            ┌──────────▼──────────┐
                                            │   IPFS (Pinata)      │
                                            │   metadata + images  │
                                            └─────────────────────┘
```

- **Contracts** hold all logic and money. Frontend never trusts off-chain numbers for value transfer.
- **Subgraph** is read-only display data, derived from emitted events.
- **IPFS** stores token metadata JSON and media.

---

## 4. Smart Contracts (Solidity, Foundry)

Solidity `^0.8.24`, OpenZeppelin contracts, built and tested with Foundry. Follow checks-effects-interactions, use `ReentrancyGuard`, and use a **pull-payment** pattern for all outgoing funds (proceeds and refunds are withdrawn, not pushed).

### 4.1 MosaicERC721.sol
Shared creator collection.
- Inherits: `ERC721URIStorage`, `ERC2981`, `Ownable` (or `AccessControl`).
- Per-token metadata URI (IPFS) and per-token royalty.
- Direct mint and lazy-mint redemption.

Key functions:
- `mintTo(address to, string uri, uint96 royaltyBps) returns (uint256 tokenId)` — direct mint by a creator; sets token royalty receiver to the creator.
- `redeem(address buyer, NFTVoucher voucher) returns (uint256 tokenId)` — **callable only by MosaicMarket**. Verifies the EIP-712 signature recovers `voucher.creator`, mints to `buyer`, sets `uri` and royalty, marks the voucher nonce as used. Reverts on reused nonce or bad signature.
- `setMarket(address market)` — owner sets the authorized marketplace.

Events: `Minted(uint256 indexed tokenId, address indexed creator, string uri)`.

#### NFTVoucher (EIP-712)
```solidity
struct NFTVoucher {
    uint256 nonce;       // unique per creator, prevents replay
    uint256 minPrice;    // wei the buyer must pay
    string  uri;         // IPFS metadata URI
    uint96  royaltyBps;  // creator royalty in basis points
    address creator;     // signer / royalty receiver
    bytes   signature;   // EIP-712 signature over the above
}
```
Domain: `name="MosaicNFT"`, `version="1"`, `chainId`, `verifyingContract=MosaicERC721`.

### 4.2 MosaicMarket.sol
The marketplace. Holds listings, auctions, offers, and accumulated proceeds. Orchestrates all payments, fees, and royalties.

Config:
- `uint96 marketplaceFeeBps` (e.g. 250 = 2.5%), `address feeRecipient`, owner-settable.

**Fixed-price listings**
- `listItem(address collection, uint256 tokenId, uint256 price)` — seller must have approved the market. Records listing.
- `cancelListing(address collection, uint256 tokenId)`
- `buyItem(address collection, uint256 tokenId) payable` — transfers NFT to buyer; splits `msg.value` into royalty (via `IERC2981.royaltyInfo`), marketplace fee, and seller proceeds; credits proceeds for pull-withdrawal.

**Lazy mint purchase**
- `buyLazy(address collection, NFTVoucher voucher) payable` — requires `msg.value >= voucher.minPrice`; calls `collection.redeem(msg.sender, voucher)` to mint; splits funds into fee + creator proceeds (this is a primary sale, so creator receives proceeds directly).

**Auctions (English)**
- `createAuction(address collection, uint256 tokenId, uint256 startPrice, uint256 duration)`
- `placeBid(uint256 auctionId) payable` — must beat current bid; previous bidder's funds credited for pull-withdrawal (no push refunds).
- `settleAuction(uint256 auctionId)` — after end time, transfers NFT to highest bidder; splits funds (royalty + fee + seller). Anyone can call after expiry.

**Offers**
- `makeOffer(address collection, uint256 tokenId) payable` — escrows the offer amount in the contract.
- `cancelOffer(uint256 offerId)` — refunds (pull).
- `acceptOffer(uint256 offerId)` — owner of the NFT accepts; transfers NFT, splits escrowed funds.

**Proceeds**
- `withdrawProceeds()` — pull-payment; transfers caller's accumulated balance.

Events (drive the subgraph):
`ItemListed`, `ListingCancelled`, `ItemSold`, `LazyMintSold`, `AuctionCreated`, `BidPlaced`, `AuctionSettled`, `OfferMade`, `OfferCancelled`, `OfferAccepted`, `ProceedsWithdrawn`.

### 4.3 MosaicERC1155.sol *(secondary)*
Multi-edition contract mirroring the 721 pattern (ERC-1155 + ERC-2981). Marketplace functions should accept it via the same `collection` address parameter and an `amount` field. Defer until the 721 path is fully working and tested.

### 4.4 Testing (Foundry — required, do not skip)
Full unit + fuzz tests for: listing → buy with correct royalty/fee/seller split; auction happy path + outbid refunds via pull; offer accept/cancel; lazy mint signature verification (valid, tampered, replayed nonce, wrong signer); reentrancy attempt on buy/settle; access control on `redeem`. Target high coverage and include at least a couple of fuzz tests on price splits.

### 4.5 Royalty enforcement note (be able to explain this)
EIP-2981 is a *signal*; enforcement happens at the marketplace level. MosaicMarket honors `royaltyInfo` on every secondary sale by construction. State this nuance in the README — it shows you understand the standard rather than assuming royalties are enforced at the token-transfer layer.

---

## 5. Subgraph (The Graph)

Index MosaicMarket + MosaicERC721 events into queryable entities.

Entities:
- `Collection { id, address, name }`
- `Token { id, collection, tokenId, creator, owner, tokenURI }`
- `Listing { id, token, seller, price, active }`
- `Auction { id, token, seller, startPrice, highestBid, highestBidder, endTime, settled }`
- `Bid { id, auction, bidder, amount, timestamp }`
- `Offer { id, token, buyer, amount, active }`
- `Sale { id, token, seller, buyer, price, kind, timestamp }`  // kind: FIXED | AUCTION | LAZY
- `User { id, address, ownedTokens, createdTokens }`

Mappings update entities on each event. The frontend queries this subgraph for all listing/explore/history views.

---

## 6. Frontend (React)

Stack: React + Vite + TypeScript, `wagmi` + `viem`, RainbowKit (wallet), TailwindCSS, GraphQL client (urql or Apollo) for the subgraph.

Pages:
- **Explore** `/` — responsive masonry/mosaic grid of active listings + auctions. Filters (price, type, collection), search, sort. Reads subgraph.
- **Item detail** `/item/:collection/:tokenId` — media, metadata, owner, current price/auction state, and action panel (Buy / Place bid / Make offer). Activity/history timeline from `Sale`/`Bid`/`Offer`.
- **Create / Mint** `/create` — upload media → pin to IPFS → enter title, description, royalty %. Choose **Mint now** (on-chain `mintTo`) or **Lazy list** (sign an EIP-712 voucher, no gas). Then optionally list.
- **Collection** `/collection/:address` — collection header + its tokens.
- **Profile** `/u/:address` — tabs: Owned, Created, Activity. **Withdraw proceeds** button (calls `withdrawProceeds`).

### UX direction (this is a differentiator — make it intentional)
- **Concept:** a living mosaic. The explore grid uses varied tile sizes that assemble into a cohesive wall; subtle entrance animation as tiles "set" into place.
- Generous whitespace, art-first cards (image dominant, chrome minimal), refined type scale, one confident accent color over a neutral base. Light + dark.
- Smooth, fast transitions; skeleton loaders while subgraph queries resolve; clear tx states (pending / confirmed / failed) with human-readable messaging.
- Avoid default component-library look. Aim for something that reads as designed, not assembled.

---

## 6a. Why There's No Traditional Backend

This architecture intentionally has no Node/Express server holding application state. Its usual responsibilities are split across:

- **Smart contracts** — own all state that matters for money/ownership (listings, bids, offers, balances). This replaces a backend's business logic + database.
- **Subgraph** — replaces a backend's "API + read database." It listens to contract events and serves them pre-indexed and query-ready.
- **IPFS** — replaces file/object storage for images and metadata JSON.

The frontend talks directly to the subgraph (reads) and the smart contracts (writes). No backend server is needed for the marketplace to function.

**Two small serverless pieces are still needed** (Netlify Functions — not a full backend, just thin proxies):

1. **IPFS pinning proxy** — `POST /api/pin` uploads media + metadata JSON to Pinata. Done server-side (as a Netlify Function) so the Pinata API key is never exposed to the browser.
2. **Lazy-mint voucher storage** — `POST /api/vouchers` and `GET /api/vouchers/:collection/:tokenRef`. A signed `NFTVoucher` (§4.1) exists only off-chain until someone buys it, so it needs *somewhere* to live between "creator signs it" and "buyer purchases it." Use a lightweight store (e.g. a small hosted Postgres/SQLite via Netlify Function, or even a simple key-value store like Netlify Blobs) keyed by collection + nonce. This store holds only the already-signed voucher payload — it has no authority of its own; the contract re-verifies the signature on `redeem`, so this store being wrong or even compromised can't forge a sale.

Keep both as small, single-purpose functions. Do not grow this into a general-purpose backend or duplicate state that the subgraph already provides.

---

- **Contracts:** Solidity ^0.8.24, Foundry, OpenZeppelin
- **Indexer:** The Graph (subgraph)
- **Frontend:** React + Vite + TypeScript, wagmi + viem, RainbowKit, TailwindCSS
- **Storage:** IPFS via Pinata (or nft.storage) for metadata + media
- **Serverless:** Netlify Functions — thin proxies only (IPFS pin, voucher store), no application backend
- **Network:** Ethereum **Sepolia** testnet. *Optional lower-fee alternative for a smoother demo: Base Sepolia or Polygon Amoy.*
- **Frontend hosting:** **Netlify**

---

## 8. Project Structure

```
mosaicnft/
├── contracts/                 # Foundry
│   ├── src/
│   │   ├── MosaicERC721.sol
│   │   ├── MosaicMarket.sol
│   │   └── MosaicERC1155.sol   # secondary
│   ├── test/
│   ├── script/                 # Deploy.s.sol
│   └── foundry.toml
├── subgraph/
│   ├── schema.graphql
│   ├── subgraph.yaml
│   └── src/mappings.ts
├── frontend/                   # Vite + React
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/                # wagmi config, contract ABIs, graph client
│   │   └── styles/
│   ├── netlify/
│   │   └── functions/
│   │       ├── pin.ts           # IPFS pinning proxy
│   │       └── vouchers.ts      # lazy-mint voucher store
│   ├── netlify.toml
│   └── package.json
└── GENERAL.md
```

---

## 9. Build Sequence

Work in three phases. Finish and test each before moving on.

**Phase 1 — Contracts**
1. Scaffold Foundry, install OpenZeppelin.
2. Implement `MosaicERC721` (ERC-2981 + EIP-712 `redeem`).
3. Implement `MosaicMarket` (listings, auctions, offers, fee + royalty split, pull-payments, `ReentrancyGuard`).
4. Write the full Foundry test suite from §4.4 (incl. fuzz + lazy-mint signature cases).
5. `Deploy.s.sol` → deploy to Sepolia, verify, record addresses + ABIs.

**Phase 2 — Subgraph**
6. Define `schema.graphql` and `subgraph.yaml` for the deployed addresses.
7. Implement mappings for all events in §4.2/§5; deploy the subgraph.

**Phase 3 — Frontend**
8. Scaffold Vite + wagmi + RainbowKit + Tailwind; wire Sepolia + contract ABIs + subgraph client.
9. Build pages (Explore → Item detail → Create/Mint → Collection → Profile).
10. Implement the lazy-mint flow end to end (sign voucher in Create, redeem via `buyLazy` on Item detail).
11. Polish the UX per §6; add loading/tx states.
12. Deploy to Netlify; confirm full flow on Sepolia (mint, list, buy, bid, offer, lazy-buy, withdraw).

---

## 10. Differentiators Recap (portfolio talking points)

- **Lazy minting (EIP-712)** — gasless creation, mint-on-buy. Demonstrates signature/voucher mastery.
- **Subgraph-driven** — performant reads, real indexing, not chain-scanning.
- **EIP-2981 royalties honored on every secondary sale**, with a clear understanding of where enforcement lives.
- **Security**: ReentrancyGuard, checks-effects-interactions, pull-payments, fuzz-tested splits.
- **Designed UX** that stands apart from clone marketplaces — your UI/UX edge made visible.
