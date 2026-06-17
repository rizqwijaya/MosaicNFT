// One-off generator: produces 36 EIP-712 signed lazy-mint vouchers for the demo
// seed. Run from the `frontend` dir: `node dev/sign-vouchers.cjs > dev/seed-vouchers.json`.
//
// The signer key below is a throwaway demo key (no funds). Its address is the
// voucher `creator`, so the deployed MosaicERC721.redeem() recovers it and the
// signature verifies. Buyers only need Sepolia ETH to pay + gas.
const { privateKeyToAccount } = require("viem/accounts");

const PK = "0xe8db75b3fb5404295c7653cbf78bbc028ad928ddec7ed229f9819048a134686d";
const account = privateKeyToAccount(PK);

const ERC721 = "0xd073a7563A7fcB3FA1651a5308C05c213430C834";
const CHAIN_ID = 11155111;

const domain = {
  name: "MosaicNFT",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: ERC721,
};
const types = {
  NFTVoucher: [
    { name: "nonce", type: "uint256" },
    { name: "minPrice", type: "uint256" },
    { name: "uri", type: "string" },
    { name: "royaltyBps", type: "uint96" },
    { name: "creator", type: "address" },
  ],
};

const ids = [
  "1517999144091-3d9dca6d1e43","1536566482680-fca31930a0bd","1465101046530-73398c7f28ca",
  "1487147264018-f937fba0c817","1502691876148-a84978e59af8","1508739773434-c26b3d09e071",
  "1419242902214-272b3f66ee7a","1454496522488-7a8e488e8606","1516981879613-9f5da904015f",
  "1494500764479-0c8f2919a3d8","1500530855697-b586d89ba3ee","1470071459604-3b5ec3a7fe05",
  "1444703686981-a3abbc4d4fe3","1490578474895-699cd4e2cf59","1505144808419-1957a94ca61e",
  "1448375240586-882707db888b","1418065460487-3e41a6c84dc5","1426604966848-d7adac402bff",
  "1441974231531-c6227db76b6e","1472214103451-9374bd1c798e","1433086966358-54859d0ed716",
  "1469474968028-56623f02e42e","1470770841072-f978cf4d019e","1439853949127-fa647821eba0",
  "1501785888041-af3ef285b470","1454372182658-c712e4c5a1db","1506744038136-46273834b3fb",
  "1470115636492-6d2b56f9146d","1447752875215-b2761acb3c5d","1509316975850-ff9c5deb0cd9",
  "1518173946687-a4c8892bbd9f","1518495973542-4542c06a5843","1470252649378-9c29740c9fa8",
  "1465146344425-f00d5f5c8f07","1462331940025-496dfbfc7564","1499428665502-503f6c608263"
];
const adj = ["Coral","Tessellate","Fault","Quiet","Amber","Slow","Night","Paper","Copper","Dawn","Iron","Glass","Stone","Velvet","Ash","Cinder","Marble","Slate","Onyx","Pearl","Frost","Ember","Dune","Echo","Drift","Hollow","Mono","Static","Tide","Veil","Pulse","Grain","Shade","Mist","Char","Lumen"];
const noun = ["Drift","Pattern","Lines","Static","Grid","Bloom","Garden","Tide","Veins","Mosaic","Field","House","Wall","Frame","Form","Block","Vein","Edge","Mark","Light","Bank","Glow","Sea","Loop","Path","Way","Tone","Noise","Wave","Cloud","Beat","Stone","Fold","Air","Coal","Glint"];
const prices = ["0.020","0.035","0.012","0.008","0.050","0.015","0.028","0.0095","0.042","0.060","0.018","0.025","0.007","0.033","0.048","0.011","0.022","0.055","0.016","0.009","0.038","0.027","0.014","0.045","0.0065","0.030","0.052","0.019","0.024","0.040","0.013","0.036","0.058","0.010","0.021","0.047"];

const toWei = (eth) => (BigInt(Math.round(parseFloat(eth) * 1e6)) * 10n ** 12n).toString();
const img = (id) => `https://images.unsplash.com/photo-${id}?w=700&h=700&fit=crop&q=80&sat=-100`;

(async () => {
  const out = [];
  for (let i = 0; i < 36; i++) {
    const n = i + 1;
    const num = String(n).padStart(2, "0");
    const name = `${adj[i]} ${noun[i]} #${num}`;
    const image = img(ids[i]);
    // On-chain tokenURI: self-contained metadata JSON as a base64 data URI,
    // so the minted token resolves anywhere with no extra hosting.
    const metaJson = JSON.stringify({
      name,
      description: "A Mosaic demo lazy-mint piece.",
      image,
    });
    const uri =
      "data:application/json;base64," +
      Buffer.from(metaJson, "utf8").toString("base64");

    const message = {
      nonce: BigInt(n),
      minPrice: BigInt(toWei(prices[i])),
      uri,
      royaltyBps: 500,
      creator: account.address,
    };
    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: "NFTVoucher",
      message,
    });

    out.push({
      id: `${ERC721}-${n}`,
      collection: ERC721,
      name,
      image,
      redeemed: false,
      createdAt: 1750000000000 + n * 10,
      voucher: {
        nonce: String(n),
        minPrice: toWei(prices[i]),
        uri,
        royaltyBps: 500,
        creator: account.address,
        signature,
      },
    });
  }
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.stderr.write(`signer=${account.address} count=${out.length}\n`);
})();
