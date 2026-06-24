import { useState } from "react";
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

// 36 unique Unsplash photo IDs — abstract, texture, macro, landscape. No humans.
const FALLBACK_PHOTOS = [
  "photo-1618005182384-a83a8bd57fbe", // abstract ink
  "photo-1558618666-fcd25c85cd64", // concrete
  "photo-1604871000636-074fa5117945", // dark marble
  "photo-1617791160536-598cf32026fb", // smoke
  "photo-1541701494587-cb58502866ab", // paint abstract
  "photo-1618172193763-c511deb635ca", // ink water
  "photo-1620641788421-7a1c342ea42e", // fluid art
  "photo-1559827260-dc66d52bef19", // dark waves
  "photo-1567359781514-3b964e2b04d6", // charcoal texture
  "photo-1553356084-58ef4a67b2a7", // dark stone
  "photo-1614850523459-c2f4c699c52e", // dark liquid
  "photo-1635070041078-e363dbe005cb", // black abstract
  "photo-1580927752452-89d86da3fa0a", // dark code/circuit
  "photo-1534796636912-3b952d172bf7", // neon abstract
  "photo-1533134486753-c833f0ed4866", // paint texture
  "photo-1547036967-23d11aacaee0", // lightning
  "photo-1518640467707-6811f4a6ab73", // dark bokeh
  "photo-1507525428034-b723cf961d3e", // ocean waves
  "photo-1519681393784-d120267933ba", // snowy mountain
  "photo-1464822759023-fed622ff2c3b", // rocky landscape
  "photo-1506905925346-21bda4d32df4", // mountain fog
  "photo-1469474968028-56623f02e42e", // dark nature
  "photo-1447752875215-b2761acf3dfd", // dark forest
  "photo-1475924156734-496f6cac6ec1", // aerial dark
  "photo-1433086966358-54859d0ed716", // waterfall dark
  "photo-1465146344425-f00d5f5c8f07", // dark flower macro
  "photo-1418065460487-3e41a6c84dc5", // tree silhouette
  "photo-1502082553048-f009c37129b9", // forest path
  "photo-1490730141103-6cac27aaab94", // dark sea
  "photo-1504701954957-2010ec3bcec1", // bokeh lights
  "photo-1511300636408-a63a89df3482", // snow landscape
  "photo-1500534314209-a25ddb2bd429", // dark road
  "photo-1470071459604-3b5ec3a7fe05", // foggy forest
  "photo-1444464666168-49d633b86797", // bird silhouette
  "photo-1473773508845-188df298d2d1", // dark aerial
  "photo-1477346611705-65d1883cee1e", // dark river
];

/** Aspect ratio by card index — varied mosaic heights. */
function aspectFor(index: number): string {
  return ASPECTS[index % ASPECTS.length];
}

/** Unsplash fallback — abstract/texture/landscape, no humans, unique per slot. */
function fallbackImg(index: number): string {
  const id = FALLBACK_PHOTOS[index % FALLBACK_PHOTOS.length];
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
  const ipfsImg = meta?.image ? ipfsToHttp(meta.image) : "";
  const img = (!imgError && ipfsImg) ? ipfsImg : fallbackImg(index);
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
