import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useMetadata } from "../hooks/useMetadata";
import { ipfsToHttp } from "../lib/ipfs";
import { fmtEth, timeLeft, CURRENCY } from "../lib/format";
import { fallbackImg } from "../lib/fallbackImg";
import { EthIcon } from "./EthIcon";

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

/** Aspect ratio by card index - varied mosaic heights. */
function aspectFor(index: number): string {
  return ASPECTS[index % ASPECTS.length];
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
            <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-brand-500/85 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur">
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
              <div className="flex items-center justify-end gap-1 font-display text-base font-bold text-brand-400">
                <EthIcon className="size-3.5" />
                {fmtEth(amount)}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
