// IPFS gateway + Pinata pinning client.

const GATEWAY =
  import.meta.env.VITE_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string | undefined;
const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

/** Resolve an ipfs:// URI (or bare CID) to an HTTP gateway URL. */
export function ipfsToHttp(uri: string | null | undefined): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return GATEWAY + uri.slice("ipfs://".length);
  if (uri.startsWith("http")) return uri;
  // Same-origin path (e.g. dev-served art) or data URI: use verbatim.
  if (uri.startsWith("/") || uri.startsWith("data:")) return uri;
  return GATEWAY + uri;
}

export interface TokenMetadata {
  name: string;
  description: string;
  image: string; // ipfs:// uri
}

/** Pin a file — direct to Pinata if VITE_PINATA_JWT set, else via proxy. */
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

/** Pin metadata JSON — direct to Pinata if VITE_PINATA_JWT set, else via proxy. */
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

/** Fetch + parse token metadata JSON from IPFS. */
export async function fetchMetadata(
  tokenURI: string | null | undefined
): Promise<TokenMetadata | null> {
  if (!tokenURI) return null;
  try {
    const res = await fetch(ipfsToHttp(tokenURI));
    if (!res.ok) return null;
    return (await res.json()) as TokenMetadata;
  } catch {
    return null;
  }
}
