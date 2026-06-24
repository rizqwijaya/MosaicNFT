import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useMetadata } from "../hooks/useMetadata";
import { ipfsToHttp } from "../lib/ipfs";
import { fmtEth, timeLeft, CURRENCY } from "../lib/format";

interface Props {
  to: string;
  tokenURI?: string | null;
  index?: number;
  // one of these badges:
  price?: string | null; // fixed listing price (wei)
  auctionBid?: string | null; // current/start bid (wei)
  auctionEnd?: string | null; // endTime sec
  free?: boolean; // free airdrop card
  fallbackName?: string;
}

// Curated aspect ratios so tiles vary in height -> a real mosaic wall.
// Weighted toward portrait/square; the occasional tall/wide adds rhythm.
const ASPECTS = ["1 / 1", "4 / 5", "3 / 4", "4 / 5", "1 / 1", "3 / 4", "5 / 4", "2 / 3", "1 / 1", "4 / 3"];

// 60 unique Unsplash photo IDs — abstract, texture, macro, landscape. No humans.
const FALLBACK_PHOTOS = [
  "photo-1618005182384-a83a8bd57fbe",
  "photo-1558618666-fcd25c85cd64",
  "photo-1604871000636-074fa5117945",
  "photo-1617791160536-598cf32026fb",
  "photo-1541701494587-cb58502866ab",
  "photo-1618172193763-c511deb635ca",
  "photo-1620641788421-7a1c342ea42e",
  "photo-1559827260-dc66d52bef19",
  "photo-1567359781514-3b964e2b04d6",
  "photo-1553356084-58ef4a67b2a7",
  "photo-1614850523459-c2f4c699c52e",
  "photo-1635070041078-e363dbe005cb",
  "photo-1580927752452-89d86da3fa0a",
  "photo-1534796636912-3b952d172bf7",
  "photo-1533134486753-c833f0ed4866",
  "photo-1547036967-23d11aacaee0",
  "photo-1518640467707-6811f4a6ab73",
  "photo-1507525428034-b723cf961d3e",
  "photo-1519681393784-d120267933ba",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1506905925346-21bda4d32df4",
  "photo-1469474968028-56623f02e42e",
  "photo-1447752875215-b2761acf3dfd",
  "photo-1475924156734-496f6cac6ec1",
  "photo-1433086966358-54859d0ed716",
  "photo-1465146344425-f00d5f5c8f07",
  "photo-1418065460487-3e41a6c84dc5",
  "photo-1502082553048-f009c37129b9",
  "photo-1490730141103-6cac27aaab94",
  "photo-1504701954957-2010ec3bcec1",
  "photo-1511300636408-a63a89df3482",
  "photo-1500534314209-a25ddb2bd429",
  "photo-1470071459604-3b5ec3a7fe05",
  "photo-1444464666168-49d633b86797",
  "photo-1473773508845-188df298d2d1",
  "photo-1477346611705-65d1883cee1e",
  "photo-1546587348-d12660c1961b",
  "photo-1520116468816-95b69f847357",
  "photo-1519681393784-d120267933ba",
  "photo-1484417894907-623942c8ee29",
  "photo-1446776811953-b23d57bd21aa",
  "photo-1419242902214-272b3f66ee7a",
  "photo-1462275646964-a0e3386b89fa",
  "photo-1444927182256-02671dd1bc0b",
  "photo-1419833173245-f59e1b93f9ee",
  "photo-1430026996702-608b84ce9281",
  "photo-1426604966848-d7adac402bff",
  "photo-1423345170965-39c584bf45cb",
  "photo-1421789665209-c9b2a435e3dc",
  "photo-1418983948791-3d3ca56f9a75",
  "photo-1414609245224-aea482020e07",
  "photo-1412012253572-ce6b3ca7a7b4",
  "photo-1404308894937-0fb55b699c5c",
  "photo-1403241076743-76f2b840ddba",
  "photo-1401838401769-c72f5c68fffa",
  "photo-1397940007271-e9a5f5b6aab3",
  "photo-1394426847459-6d58c78e5b49",
  "photo-1392433702200-7ebb3a38d4f1",
  "photo-1389307014012-5f6be3bcfad4",
  "photo-1387037934861-c8f2c8d5e4d1",
];

/** Aspect ratio by card index — varied mosaic heights. */
function aspectFor(index: number): string {
  return ASPECTS[index % ASPECTS.length];
}

/** Stable hash of a string → non-negative int. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Unsplash fallback — uses tokenId extracted from path for unique, stable assignment. */
function fallbackImg(to: string): string {
  // Extract numeric tokenId from "/item/{collection}/{tokenId}" or "/airdrop/{id}"
  const parts = to.split("/");
  const lastPart = parts[parts.length - 1];
  const tokenNum = parseInt(lastPart, 10);
  const idx = isNaN(tokenNum) ? hashStr(to) : tokenNum;
  const id = FALLBACK_PHOTOS[idx % FALLBACK_PHOTOS.length];
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80&sat=-100`;
}

export function NftCard({
  to,
  tokenURI,
  index = 0,
  price,
  auctionBid,
  auctionEnd,
  free,
  fallbackName,
}: Props) {
  const { meta, loading } = useMetadata(tokenURI);
  const [imgError, setImgError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ipfsImg = meta?.image ? ipfsToHttp(meta.image) : "";
  const img = (!imgError && ipfsImg) ? ipfsImg : fallbackImg(to);

  // Force fallback if IPFS image hasn't loaded within 20 seconds
  useEffect(() => {
    if (!ipfsImg || imgError) return;
    timeoutRef.current = setTimeout(() => setImgError(true), 20000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [ipfsImg, imgError]);
  const name = meta?.name || fallbackName || "Untitled";

  const kind = free
    ? "Free claim"
    : price != null
      ? "Fixed price"
      : auctionBid != null
        ? "Auction"
        : "";
  const amount = price ?? auctionBid;
  const aspect = aspectFor(index);

  return (
    <Link
      to={to}
      className="tile-enter group mb-5 block break-inside-avoid"
      style={{ ["--i" as string]: index }}
    >
      <div className="card group-hover:-translate-y-1.5">
        {/* Media (deterministic aspect ratio for a varied mosaic) */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: aspect }}
        >
          {loading ? (
            <div className="skeleton size-full" />
          ) : (
            <img
              src={img}
              alt={name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
              onError={() => setImgError(true)}
            />
          )}

          {/* gradient veil for legibility on hover */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Badges */}
          {free && (
            <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-coral-500/85 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur">
              FREE
            </span>
          )}
          {auctionEnd && (
            <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
              {timeLeft(auctionEnd)}
            </span>
          )}
        </div>

        {/* Caption */}
        <div className="flex items-end justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-semibold text-stone-100">
              {name}
            </div>
            <div className="mt-0.5 text-xs text-stone-400">{kind}</div>
          </div>
          {amount != null && (
            <div className="shrink-0 text-right">
              <div className="text-[10px] uppercase tracking-wider text-stone-500">
                {CURRENCY}
              </div>
              <div className="font-display text-base font-bold text-coral-400">
                {fmtEth(amount)}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
