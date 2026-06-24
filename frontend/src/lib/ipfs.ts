// IPFS gateway + Pinata pinning client.

// Primary gateway (overridable). ipfs.io / dweb.link respond ~10x faster than
// gateway.pinata.cloud for non-dedicated content.
const GATEWAY =
  import.meta.env.VITE_IPFS_GATEWAY || "https://ipfs.io/ipfs/";

// Fallback gateways tried (in order) if the primary fetch fails or is slow.
const FALLBACK_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string | undefined;
const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

/** Extract the bare CID/path from an ipfs:// URI or pass through other forms. */
function ipfsPath(uri: string): string | null {
  if (uri.startsWith("ipfs://")) return uri.slice("ipfs://".length);
  if (uri.startsWith("http") || uri.startsWith("/") || uri.startsWith("data:"))
    return null; // not an ipfs path
  return uri; // bare CID
}

/** Resolve an ipfs:// URI (or bare CID) to an HTTP gateway URL. */
export function ipfsToHttp(uri: string | null | undefined): string {
  if (!uri) return "";
  if (uri.startsWith("http")) return uri;
  // Same-origin path (e.g. dev-served art) or data URI: use verbatim.
  if (uri.startsWith("/") || uri.startsWith("data:")) return uri;
  const path = ipfsPath(uri);
  return path != null ? GATEWAY + path : uri;
}

/** All candidate gateway URLs for an ipfs URI, primary first. */
function gatewayUrls(uri: string): string[] {
  const path = ipfsPath(uri);
  if (path == null) return [uri]; // http/data/path: single candidate
  const gws = [GATEWAY, ...FALLBACK_GATEWAYS.filter((g) => g !== GATEWAY)];
  return gws.map((g) => g + path);
}

export interface TokenMetadata {
  name: string;
  description: string;
  image: string; // ipfs:// uri
}

/** Pin a file - direct to Pinata if VITE_PINATA_JWT set, else via proxy. */
export async function pinFile(file: File): Promise<string> {
  if (PINATA_JWT) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(PIN_FILE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Pin failed: ${await res.text()}`);
    const { IpfsHash } = (await res.json()) as { IpfsHash: string };
    return `ipfs://${IpfsHash}`;
  }
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/pin?kind=file", { method: "POST", body: form });
  if (!res.ok) throw new Error(`Pin failed: ${await res.text()}`);
  const { uri } = (await res.json()) as { uri: string };
  return uri;
}

/** Pin metadata JSON - direct to Pinata if VITE_PINATA_JWT set, else via proxy. */
export async function pinJson(metadata: TokenMetadata): Promise<string> {
  if (PINATA_JWT) {
    const res = await fetch(PIN_JSON_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pinataContent: metadata }),
    });
    if (!res.ok) throw new Error(`Pin failed: ${await res.text()}`);
    const { IpfsHash } = (await res.json()) as { IpfsHash: string };
    return `ipfs://${IpfsHash}`;
  }
  const res = await fetch("/api/pin?kind=json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) throw new Error(`Pin failed: ${await res.text()}`);
  const { uri } = (await res.json()) as { uri: string };
  return uri;
}

/** Unsplash photo IDs seeded with truncated slugs - map to working replacements. */
const UNSPLASH_PATCH: Record<string, string> = {
  "photo-1517999144091": "photo-1618005182384-a83a8bd57fbe",
  "photo-1536566482680": "photo-1558618666-fcd25c85cd64",
  "photo-1465101046530": "photo-1604871000636-074fa5117945",
  "photo-1487147264018": "photo-1617791160536-598cf32026fb",
  "photo-1502691876148": "photo-1541701494587-cb58502866ab",
  "photo-1508739773434": "photo-1618172193763-c511deb635ca",
  "photo-1419242902214": "photo-1620641788421-7a1c342ea42e",
  "photo-1454496522488": "photo-1559827260-dc66d52bef19",
  "photo-1516981879613": "photo-1567359781514-3b964e2b04d6",
  "photo-1494500764479": "photo-1553356084-58ef4a67b2a7",
  "photo-1500530855697": "photo-1614850523459-c2f4c699c52e",
  "photo-1470071459604": "photo-1635070041078-e363dbe005cb",
  "photo-1444703686981": "photo-1580927752452-89d86da3fa0a",
  "photo-1490578474895": "photo-1534796636912-3b952d172bf7",
  "photo-1505144808419": "photo-1533134486753-c833f0ed4866",
  "photo-1448375240586": "photo-1547036967-23d11aacaee0",
  "photo-1418065460487": "photo-1518640467707-6811f4a6ab73",
  "photo-1426604966848": "photo-1507525428034-b723cf961d3e",
  "photo-1441974231531": "photo-1519681393784-d120267933ba",
  "photo-1472214103451": "photo-1464822759023-fed622ff2c3b",
  "photo-1433086966358": "photo-1506905925346-21bda4d32df4",
  "photo-1469474968028": "photo-1469474968028-56623f02e42e",
  "photo-1470770841072": "photo-1447752875215-b2761acf3dfd",
  "photo-1439853949127": "photo-1475924156734-496f6cac6ec1",
  "photo-1501785888041": "photo-1433086966358-54859d0ed716",
  "photo-1454372182658": "photo-1465146344425-f00d5f5c8f07",
  "photo-1506744038136": "photo-1418065460487-3e41a6c84dc5",
  "photo-1470115636492": "photo-1502082553048-f009c37129b9",
  "photo-1447752875215": "photo-1490730141103-6cac27aaab94",
  "photo-1509316975850": "photo-1504701954957-2010ec3bcec1",
  "photo-1518173946687": "photo-1511300636408-a63a89df3482",
  "photo-1518495973542": "photo-1500534314209-a25ddb2bd429",
  "photo-1470252649378": "photo-1470071459604-3b5ec3a7fe05",
  "photo-1465146344425": "photo-1444464666168-49d633b86797",
  "photo-1462331940025": "photo-1473773508845-188df298d2d1",
  "photo-1499428665502": "photo-1477346611705-65d1883cee1e",
};

/** Fix Unsplash URLs whose photo ID was seeded without the full slug. */
function patchImageUrl(url: string): string {
  for (const [bad, good] of Object.entries(UNSPLASH_PATCH)) {
    if (url.includes(bad)) return url.replace(bad, good);
  }
  return url;
}

/** Fetch JSON from the first gateway that responds, with a per-gateway timeout. */
async function fetchJsonMultiGateway(
  uri: string,
  perGatewayMs = 8000
): Promise<unknown | null> {
  for (const url of gatewayUrls(uri)) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), perGatewayMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) return await res.json();
    } catch {
      clearTimeout(timer);
      // try next gateway
    }
  }
  return null;
}

/** Fetch + parse token metadata JSON from IPFS. */
export async function fetchMetadata(
  tokenURI: string | null | undefined
): Promise<TokenMetadata | null> {
  if (!tokenURI) return null;
  try {
    let meta: TokenMetadata;
    if (tokenURI.startsWith("data:application/json;base64,")) {
      const b64 = tokenURI.slice("data:application/json;base64,".length);
      const json = atob(b64);
      meta = JSON.parse(json) as TokenMetadata;
    } else {
      const json = await fetchJsonMultiGateway(tokenURI);
      if (json == null) return null;
      meta = json as TokenMetadata;
    }
    if (meta.image) meta.image = patchImageUrl(meta.image);
    return meta;
  } catch {
    return null;
  }
}
