import { Link } from "react-router-dom";
import { useMetadata } from "../hooks/useMetadata";
import { ipfsToHttp } from "../lib/ipfs";
import { fmtEth, timeLeft } from "../lib/format";

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

  return (
    <Link
      to={to}
      className="tile-enter group mb-4 block break-inside-avoid"
      style={{ ["--i" as string]: index }}
    >
      <div className="card transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-black/5">
        <div className="relative bg-stone-100 dark:bg-stone-800">
          {loading ? (
            <div className="skeleton aspect-square w-full" />
          ) : img ? (
            <img
              src={img}
              alt={name}
              loading="lazy"
              className="w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center text-stone-400">
              ⬡
            </div>
          )}
          {lazy && (
            <span className="absolute left-3 top-3 rounded-full bg-coral-500/90 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              Lazy
            </span>
          )}
          {auctionEnd && (
            <span className="absolute right-3 top-3 rounded-full bg-stone-900/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              {timeLeft(auctionEnd)}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-2 p-3.5">
          <div className="min-w-0">
            <div className="truncate font-display font-medium">{name}</div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              {price != null
                ? "Fixed price"
                : auctionBid != null
                  ? "Auction"
                  : lazy
                    ? "Mint to buy"
                    : ""}
            </div>
          </div>
          {(price != null || auctionBid != null) && (
            <div className="shrink-0 text-right">
              <div className="font-display font-semibold text-coral-600 dark:text-coral-400">
                {fmtEth(price ?? auctionBid)} Ξ
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
