# MosaicNFT

> Pieces. Collected. Connected.

A full-stack NFT marketplace on Ethereum Sepolia. Mint, list, auction, offer,
and buy. Royalties honored on every secondary sale. Includes gasless lazy
minting via EIP-712 signed vouchers and a subgraph-powered frontend.

## Highlights

- **Lazy minting (EIP-712):** creators sign an off-chain voucher; the NFT mints
  on-chain only when a buyer purchases it (mint-on-buy). No upfront gas.
- **Subgraph-driven:** all listings, auctions, offers, and history are read from
  a The Graph subgraph, not by scanning chain state.
- **Security:** ReentrancyGuard, checks-effects-interactions, pull-payments for
  all outgoing funds, fuzz-tested price splits.

## Stack

| Layer      | Tech                                                        |
| ---------- | ----------------------------------------------------------- |
| Contracts  | Solidity ^0.8.24, Foundry, OpenZeppelin                     |
| Indexer    | The Graph (subgraph)                                        |
| Frontend   | React + Vite + TS, wagmi + viem, RainbowKit, TailwindCSS    |
| Storage    | IPFS via Pinata; voucher store on Netlify Blobs             |
| Serverless | Netlify Functions (IPFS pin proxy, voucher store)          |
| Network    | Ethereum Sepolia                                            |

## Structure

```
contracts/    Foundry: MosaicERC721, MosaicMarket, tests, Deploy.s.sol
subgraph/     schema.graphql, subgraph.yaml, mappings
frontend/     Vite + React app + Netlify Functions
deployments/  Sepolia addresses + ABIs
```

## Deployed (Sepolia)

| Contract     | Address                                      |
| ------------ | -------------------------------------------- |
| MosaicERC721 | `0xd073a7563A7fcB3FA1651a5308C05c213430C834` |
| MosaicMarket | `0x6f4c6951ba5dcF19952f9E7cA2D47eA1c30Ad131` |

Both verified on Etherscan. See [deployments/sepolia.json](deployments/sepolia.json).

## Develop

```bash
# Contracts
cd contracts && forge test

# Subgraph
cd subgraph && npm install && npm run codegen && npm run build

# Frontend (full stack incl. Netlify Functions)
cd frontend && npm install && npx netlify dev
```

`forge install` restores contract deps (OpenZeppelin v5.6.1, forge-std). Copy
`.env.example` to `.env` in `contracts/` and `frontend/` and fill in values.
