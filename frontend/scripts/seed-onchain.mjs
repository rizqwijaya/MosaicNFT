// One-off seed: mint + fixed-price list 36 monochrome NFTs on-chain (Sepolia).
//
// Metadata is embedded as a `data:application/json;base64,...` token URI (image
// = Unsplash monochrome via &sat=-100), so NO IPFS/Pinata is needed - the same
// trick the old demo seed used. Run from the `frontend` dir:
//
//   node scripts/seed-onchain.mjs
//
// Reads PRIVATE_KEY + SEPOLIA_RPC_URL from ../contracts/.env. The key is only
// used to sign locally; it is never printed.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- config from contracts/.env ---
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../../contracts/.env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const PRIVATE_KEY = env.PRIVATE_KEY.startsWith("0x")
  ? env.PRIVATE_KEY
  : `0x${env.PRIVATE_KEY}`;
const RPC = env.SEPOLIA_RPC_URL;

const MOSAIC_ERC721 = "0xaF2aC6bB88ec5cCD406356a8884a818D8e22170C";
const MOSAIC_MARKET = "0x4E6e96A3D5937FDFe39937a765929fdE87C4F88c";

// --- the 36 pieces (name, photoId, price in ETH) ---
const PIECES = [
  ["Coral Drift #01", "photo-1517999144091", "0.02"],
  ["Tessellate Pattern #02", "photo-1536566482680", "0.035"],
  ["Fault Lines #03", "photo-1465101046530", "0.012"],
  ["Quiet Static #04", "photo-1487147264018", "0.008"],
  ["Amber Grid #05", "photo-1502691876148", "0.05"],
  ["Slow Bloom #06", "photo-1508739773434", "0.015"],
  ["Night Garden #07", "photo-1419242902214", "0.028"],
  ["Paper Tide #08", "photo-1454496522488", "0.0095"],
  ["Copper Veins #09", "photo-1516981879613", "0.042"],
  ["Dawn Mosaic #10", "photo-1494500764479", "0.06"],
  ["Iron Field #11", "photo-1500530855697", "0.018"],
  ["Glass House #12", "photo-1470071459604", "0.025"],
  ["Stone Wall #13", "photo-1444703686981", "0.007"],
  ["Velvet Frame #14", "photo-1490578474895", "0.033"],
  ["Ash Form #15", "photo-1505144808419", "0.048"],
  ["Cinder Block #16", "photo-1448375240586", "0.011"],
  ["Marble Vein #17", "photo-1418065460487", "0.022"],
  ["Slate Edge #18", "photo-1426604966848", "0.055"],
  ["Onyx Mark #19", "photo-1441974231531", "0.016"],
  ["Pearl Light #20", "photo-1472214103451", "0.009"],
  ["Frost Bank #21", "photo-1433086966358", "0.038"],
  ["Ember Glow #22", "photo-1469474968028", "0.027"],
  ["Dune Sea #23", "photo-1470770841072", "0.014"],
  ["Echo Loop #24", "photo-1439853949127", "0.045"],
  ["Drift Path #25", "photo-1501785888041", "0.0065"],
  ["Hollow Way #26", "photo-1454372182658", "0.03"],
  ["Mono Tone #27", "photo-1506744038136", "0.052"],
  ["Static Noise #28", "photo-1470115636492", "0.019"],
  ["Tide Wave #29", "photo-1447752875215", "0.024"],
  ["Veil Cloud #30", "photo-1509316975850", "0.04"],
  ["Pulse Beat #31", "photo-1518173946687", "0.013"],
  ["Grain Stone #32", "photo-1518495973542", "0.036"],
  ["Shade Fold #33", "photo-1470252649378", "0.058"],
  ["Mist Air #34", "photo-1465146344425", "0.01"],
  ["Char Coal #35", "photo-1462331940025", "0.021"],
  ["Lumen Glint #36", "photo-1499428665502", "0.047"],
];

const erc721Abi = [
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
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
];

const marketAbi = [
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
];

function metadataUri(name, photoId) {
  const image = `https://images.unsplash.com/${photoId}?w=700&h=700&fit=crop&q=80&sat=-100`;
  const json = JSON.stringify({
    name,
    description: "A monochrome Mosaic piece.",
    image,
  });
  const b64 = Buffer.from(json, "utf8").toString("base64");
  return `data:application/json;base64,${b64}`;
}

const account = privateKeyToAccount(PRIVATE_KEY);
const transport = http(RPC);
const wallet = createWalletClient({ account, chain: sepolia, transport });
const pub = createPublicClient({ chain: sepolia, transport });

async function main() {
  console.log("Seeder account:", account.address);
  const bal = await pub.getBalance({ address: account.address });
  console.log("Balance:", Number(bal) / 1e18, "ETH");

  let nonce = await pub.getTransactionCount({ address: account.address });

  // --- phase 1: mint all 36 (fire with manual nonce, collect hashes) ---
  console.log("\nMinting 36 tokens…");
  const mintHashes = [];
  for (let i = 0; i < PIECES.length; i++) {
    const [name, photoId] = PIECES[i];
    const uri = metadataUri(name, photoId);
    const hash = await wallet.writeContract({
      address: MOSAIC_ERC721,
      abi: erc721Abi,
      functionName: "mintTo",
      args: [account.address, uri, 500n],
      nonce: nonce++,
    });
    mintHashes.push(hash);
    process.stdout.write(`  mint ${i + 1}/36 sent\r`);
  }
  console.log("\n  waiting for last mint to confirm…");
  await pub.waitForTransactionReceipt({ hash: mintHashes[mintHashes.length - 1] });
  console.log("  all mints confirmed. tokenIds 1..36");

  // --- phase 2: approve marketplace once ---
  console.log("\nApproving marketplace…");
  const approveHash = await wallet.writeContract({
    address: MOSAIC_ERC721,
    abi: erc721Abi,
    functionName: "setApprovalForAll",
    args: [MOSAIC_MARKET, true],
    nonce: nonce++,
  });
  await pub.waitForTransactionReceipt({ hash: approveHash });
  console.log("  approved.");

  // --- phase 3: list all 36 ---
  console.log("\nListing 36 tokens…");
  const listHashes = [];
  for (let i = 0; i < PIECES.length; i++) {
    const tokenId = BigInt(i + 1); // mints were sequential from 1
    const price = parseEther(PIECES[i][2]);
    const hash = await wallet.writeContract({
      address: MOSAIC_MARKET,
      abi: marketAbi,
      functionName: "listItem",
      args: [MOSAIC_ERC721, tokenId, price],
      nonce: nonce++,
    });
    listHashes.push(hash);
    process.stdout.write(`  list ${i + 1}/36 sent\r`);
  }
  console.log("\n  waiting for last listing to confirm…");
  await pub.waitForTransactionReceipt({ hash: listHashes[listHashes.length - 1] });

  console.log("\n✅ Done. 36 NFTs minted + listed. Give the subgraph a few minutes to index.");
}

main().catch((e) => {
  console.error("\nSeed failed:", e.shortMessage || e.message);
  process.exit(1);
});
