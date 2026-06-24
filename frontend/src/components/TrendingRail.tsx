import { useRef } from "react";
import { Link } from "react-router-dom";
import { useMetadata } from "../hooks/useMetadata";
import { ipfsToHttp } from "../lib/ipfs";
import { fmtEth, CURRENCY, timeLeft } from "../lib/format";
import { fallbackImg } from "../lib/fallbackImg";
import { EthIcon } from "./EthIcon";

export interface TrendItem {
  key: string;
  to: string;
  tokenURI?: string | null;
  price?: string | null;
  auctionBid?: string | null;
  auctionEnd?: string | null;
  rank: number;
}

/** Horizontal scroll rail of featured pieces - Rarible "Trending" hero strip. */
export function TrendingRail({ items }: { items: TrendItem[] }) {
  const railRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  function scroll(dir: 1 | -1) {
    railRef.current?.scrollBy({ left: dir * 360, behavior: "smooth" });
  }

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight">
          🔥 Trending now
        </h2>
        <div className="hidden gap-2 sm:flex">
          <ArrowBtn dir={-1} onClick={() => scroll(-1)} />
          <ArrowBtn dir={1} onClick={() => scroll(1)} />
        </div>
      </div>

      <div
        ref={railRef}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2"
      >
        {items.map((it) => (
          <TrendCard key={it.key} item={it} />
        ))}
      </div>
    </section>
  );
}

function TrendCard({ item }: { item: TrendItem }) {
  const { meta } = useMetadata(item.tokenURI);
  const ipfsImg = meta?.image ? ipfsToHttp(meta.image) : "";
  const img = ipfsImg || fallbackImg(item.to);
  const name = meta?.name || "Untitled";
  const amount = item.price ?? item.auctionBid;
  const isAuction = item.price == null && item.auctionBid != null;

  return (
    <Link
      to={item.to}
      className="card group w-[260px] shrink-0 snap-start sm:w-[300px]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img
          src={img}
          alt={name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            const el = e.currentTarget;
            const fb = fallbackImg(item.to);
            if (el.src !== fb) el.src = fb;
          }}
        />
        <span className="absolute left-3 top-3 grid size-7 place-items-center rounded-full bg-black/60 text-xs font-bold text-white backdrop-blur">
          #{item.rank}
        </span>
        {item.auctionEnd && (
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
            {timeLeft(item.auctionEnd)}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-display text-[15px] font-semibold text-stone-100">
            {name}
          </div>
          <div className="mt-0.5 text-xs text-stone-500">
            {isAuction ? "Auction" : "Fixed price"}
          </div>
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
    </Link>
  );
}

function ArrowBtn({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 1 ? "Scroll right" : "Scroll left"}
      className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-stone-300 transition hover:bg-white/10 hover:text-white"
    >
      {dir === 1 ? "›" : "‹"}
    </button>
  );
}
