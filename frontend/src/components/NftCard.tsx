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
  lazy?: boolean; // lazy-mint voucher card
  fallbackName?: string;
}

// Curated aspect ratios so tiles vary in height -> a real mosaic wall.
// Weighted toward portrait/square; the occasional tall/wide adds rhythm.
const ASPECTS = ["1 / 1", "4 / 5", "3 / 4", "4 / 5", "1 / 1", "3 / 4", "5 / 4", "2 / 3", "1 / 1", "4 / 3"];

/** Stable hash of a string -> small non-negative int. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

/** Deterministic aspect ratio for a card, keyed by its link (stable per token). */
function aspectFor(key: string): string {
  return ASPECTS[hashStr(key) % ASPECTS.length];
}

export function NftCard({
  to,
  tokenURI,
  index = 0,
  price,
  auctionBid,
  auctionEnd,
  lazy,
  fallbackName,
}: Props) {
  const { meta, loading } = useMetadata(tokenURI);
  const img = meta?.image ? ipfsToHttp(meta.image) : "";
  const name = meta?.name || fallbackName || "Untitled";

  const kind = lazy
    ? "Mint to buy"
    : price != null
      ? "Fixed price"
      : auctionBid != null
        ? "Auction"
        : "";
  const amount = price ?? auctionBid;
  const aspect = aspectFor(to);

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
          ) : img ? (
            <img
              src={img}
              alt={name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-3xl text-stone-600">
              ⬡
            </div>
          )}

          {/* gradient veil for legibility on hover */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Badges */}
          {lazy && (
            <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-coral-500/85 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur">
              LAZY
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
