// Deterministic placeholder image for tokens whose real art fails to load
// (truncated/expired Unsplash IDs, slow IPFS, 404s). picsum.photos always
// returns a valid image for any seed, so this never 404s - unlike hand-picked
// Unsplash photo IDs which rot over time.

/** Stable hash of a string -> non-negative int. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Grayscale placeholder, stable per token path. Uses the numeric tokenId from
 * "/item/{collection}/{tokenId}" (or "/airdrop/{id}") as the seed so the same
 * token always gets the same image; falls back to a hash for non-numeric paths.
 */
export function fallbackImg(to: string, size = 600): string {
  const parts = to.split("/");
  const last = parts[parts.length - 1];
  const tokenNum = parseInt(last, 10);
  const seed = isNaN(tokenNum) ? hashStr(to) : tokenNum;
  return `https://picsum.photos/seed/mosaic-${seed}/${size}/${size}?grayscale`;
}
