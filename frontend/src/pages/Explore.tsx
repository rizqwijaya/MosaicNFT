import { useEffect, useMemo, useState } from "react";
import { useQuery } from "urql";
import { ACTIVE_LISTINGS, LIVE_AUCTIONS } from "../lib/queries";
import { Masonry, EmptyState } from "../components/Masonry";
import { NftCard } from "../components/NftCard";
import { CardSkeletonGrid } from "../components/Skeleton";
import type { GqlListing, GqlAuction } from "../lib/types";

type Filter = "all" | "fixed" | "auction";
type Sort = "newest" | "price-asc" | "price-desc";

const PAGE_SIZE = 12; // max tiles per page (4 columns x 3 rows on xl)

// Unified descriptor so listings and auctions paginate together.
interface Item {
  key: string;
  to: string;
  tokenURI?: string | null;
  name: string; // for search + sort fallback
  sortPrice: bigint; // for price sorting
  createdAt: number; // for "newest"
  price?: string | null;
  auctionBid?: string | null;
  auctionEnd?: string | null;
  fallbackName?: string;
}

export default function Explore() {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [listingsRes] = useQuery<{ listings: GqlListing[] }>({
    query: ACTIVE_LISTINGS,
    variables: { first: 60, orderBy: "createdAt", orderDirection: "desc" },
  });
  const [auctionsRes] = useQuery<{ auctions: GqlAuction[] }>({
    query: LIVE_AUCTIONS,
    variables: { first: 60, now: String(Math.floor(Date.now() / 1000)) },
  });

  const loading = listingsRes.fetching || auctionsRes.fetching;

  const showFixed = filter === "all" || filter === "fixed";
  const showAuction = filter === "all" || filter === "auction";

  // Build the full, filtered, sorted item list.
  const items = useMemo<Item[]>(() => {
    const listings = listingsRes.data?.listings ?? [];
    const auctions = auctionsRes.data?.auctions ?? [];
    const all: Item[] = [];

    if (showAuction)
      for (const a of auctions) {
        const bid = a.highestBid !== "0" ? a.highestBid : a.startPrice;
        all.push({
          key: `a-${a.id}`,
          to: `/item/${a.token?.collection.id}/${a.token?.tokenId}`,
          tokenURI: a.token?.tokenURI,
          name: a.token?.tokenURI ?? "",
          sortPrice: BigInt(bid ?? "0"),
          createdAt: Number(a.endTime ?? 0),
          auctionBid: bid,
          auctionEnd: a.endTime,
        });
      }
    if (showFixed)
      for (const l of listings) {
        all.push({
          key: `l-${l.id}`,
          to: `/item/${l.token?.collection.id}/${l.token?.tokenId}`,
          tokenURI: l.token?.tokenURI,
          name: l.token?.tokenURI ?? "",
          sortPrice: BigInt(l.price ?? "0"),
          createdAt: Number(l.createdAt ?? 0),
          price: l.price,
        });
      }

    const q = search.trim().toLowerCase();
    const filtered = q
      ? all.filter((it) => it.name.toLowerCase().includes(q))
      : all;

    const sorted = [...filtered];
    if (sort === "newest") sorted.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "price-asc")
      sorted.sort((a, b) => (a.sortPrice < b.sortPrice ? -1 : a.sortPrice > b.sortPrice ? 1 : 0));
    if (sort === "price-desc")
      sorted.sort((a, b) => (b.sortPrice < a.sortPrice ? -1 : b.sortPrice > a.sortPrice ? 1 : 0));
    return sorted;
  }, [listingsRes.data, auctionsRes.data, showFixed, showAuction, search, sort]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Reset to page 1 whenever the filtered set changes.
  useEffect(() => {
    setPage(1);
  }, [filter, sort, search]);

  const nothing = !loading && items.length === 0;
  const liveCount = items.length;

  return (
    <div>
      {/* Hero */}
      <div className="relative mb-12 overflow-hidden rounded-[2rem] glass px-6 py-14 sm:px-12 sm:py-20">
        <div
          className="pointer-events-none absolute -right-10 -top-20 size-72 rounded-full opacity-60 blur-3xl animate-float"
          style={{ background: "radial-gradient(circle, rgba(255,107,92,0.5), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full opacity-50 blur-3xl animate-float"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.45), transparent 70%)", animationDelay: "-4s" }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full glass-soft px-3.5 py-1.5 text-xs font-medium text-stone-300">
            <span className="size-1.5 animate-pulse rounded-full bg-coral-400" />
            On-chain marketplace · free drops in Airdrop
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            <span className="text-gradient">Pieces. Collected. Connected.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-stone-400 sm:text-lg">
            A living mosaic of on-chain art. Explore, collect, and create — and
            grab free pieces from the Airdrop page.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-7 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full glass-soft p-1">
          {(["all", "fixed", "auction"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                filter === f
                  ? "bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-lg shadow-coral-500/30"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="input max-w-[170px]"
        >
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low → high</option>
          <option value="price-desc">Price: high → low</option>
        </select>
        {!loading && (
          <span className="ml-auto text-sm text-stone-500">
            {liveCount} {liveCount === 1 ? "piece" : "pieces"}
          </span>
        )}
      </div>

      {loading ? (
        <CardSkeletonGrid count={8} />
      ) : nothing ? (
        <EmptyState
          title="Nothing here yet"
          hint="Be the first. Head to Create to mint a piece."
        />
      ) : (
        <>
          <Masonry>
            {pageItems.map((it, i) => (
              <NftCard
                key={it.key}
                index={i}
                to={it.to}
                tokenURI={it.tokenURI}
                price={it.price}
                auctionBid={it.auctionBid}
                auctionEnd={it.auctionEnd}
                fallbackName={it.fallbackName}
              />
            ))}
          </Masonry>

          {totalPages > 1 && (
            <Pager
              page={safePage}
              totalPages={totalPages}
              onChange={(p) => {
                setPage(p);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav className="mt-12 flex items-center justify-center gap-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="btn-ghost size-10 !px-0 disabled:opacity-40"
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={`size-10 rounded-full text-sm font-medium transition ${
            p === page
              ? "bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-lg shadow-coral-500/30"
              : "glass-soft text-stone-300 hover:text-white"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="btn-ghost size-10 !px-0 disabled:opacity-40"
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
