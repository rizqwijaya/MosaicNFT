// Batch cancel all active listings owned by deployer, then relist at NEW_PRICE.
//
// Usage (from frontend/ dir):
//   node scripts/relist.mjs 0.001
//
// Reads PRIVATE_KEY + SEPOLIA_RPC_URL from ../../contracts/.env

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../../contracts/.env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const PRIVATE_KEY = env.PRIVATE_KEY.startsWith("0x") ? env.PRIVATE_KEY : `0x${env.PRIVATE_KEY}`;
const RPC = env.SEPOLIA_RPC_URL;
const NEW_PRICE = process.argv[2] ?? "0.001";

const MOSAIC_ERC721 = "0xaF2aC6bB88ec5cCD406356a8884a818D8e22170C";
const MOSAIC_MARKET = "0x4E6e96A3D5937FDFe39937a765929fdE87C4F88c";
const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/1755292/mosaicnft/v0.2.0-airdrop";

const cancelAbi = [{
  type: "function", name: "cancelListing", stateMutability: "nonpayable",
  inputs: [{ name: "collection", type: "address" }, { name: "tokenId", type: "uint256" }],
  outputs: [],
}];

const listAbi = [{
  type: "function", name: "listItem", stateMutability: "nonpayable",
  inputs: [
    { name: "collection", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "price", type: "uint256" },
  ],
  outputs: [],
}];

const account = privateKeyToAccount(PRIVATE_KEY);
const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });

async function fetchListings(owner) {
  const query = `{
    listings(where: { seller: "${owner.toLowerCase()}", active: true }, first: 100) {
      id
      token { tokenId }
    }
  }`;
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const { data } = await res.json();
  return data?.listings ?? [];
}

async function waitTx(hash) {
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return receipt;
}

console.log(`Account : ${account.address}`);
console.log(`New price: ${NEW_PRICE} ETH\n`);

const listings = await fetchListings(account.address);
console.log(`Found ${listings.length} active listings to relist.\n`);

if (listings.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

// Step 1: cancel all
console.log("=== CANCELLING ===");
for (const l of listings) {
  const tokenId = BigInt(l.token.tokenId);
  console.log(`  Cancelling tokenId ${tokenId}...`);
  const hash = await wallet.writeContract({
    address: MOSAIC_MARKET,
    abi: cancelAbi,
    functionName: "cancelListing",
    args: [MOSAIC_ERC721, tokenId],
  });
  await waitTx(hash);
  console.log(`  ✓ Cancelled tokenId ${tokenId} (${hash})`);
}

// Step 2: relist all at new price
console.log("\n=== RELISTING ===");
const priceWei = parseEther(NEW_PRICE);
for (const l of listings) {
  const tokenId = BigInt(l.token.tokenId);
  console.log(`  Listing tokenId ${tokenId} at ${NEW_PRICE} ETH...`);
  const hash = await wallet.writeContract({
    address: MOSAIC_MARKET,
    abi: listAbi,
    functionName: "listItem",
    args: [MOSAIC_ERC721, tokenId, priceWei],
  });
  await waitTx(hash);
  console.log(`  ✓ Listed tokenId ${tokenId} (${hash})`);
}

console.log(`\nDone! All ${listings.length} tokens relisted at ${NEW_PRICE} ETH.`);
