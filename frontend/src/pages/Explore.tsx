import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "urql";
import { ACTIVE_LISTINGS, LIVE_AUCTIONS } from "../lib/queries";
import { Masonry, EmptyState } from "../components/Masonry";
import { NftCard } from "../components/NftCard";
import { CardSkeletonGrid } from "../components/Skeleton";
import { TrendingRail, type TrendItem } from "../components/TrendingRail";
import { StatsTable, type TableRow, type SortKey } from "../components/StatsTable";
import type { GqlListing, GqlAuction } from "../lib/types";

type Filter = "all" | "fixed" | "auction";
type View = "list" | "grid";

const PAGE_SIZE = 16;

interface Item {
  key: string;
  to: string;
  tokenURI?: string | null;
  name: string;
  sortPrice: bigint;
  createdAt: number;
  seller?: string | null;
  price?: string | null;
  auctionBid?: string | null;
  auctionEnd?: string | null;
}

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("list");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const search = params.get("q") ?? "";
  const setSearch = (q: string) => setParams(q ? { q } : {}, { replace: true });

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

  // Build the full item list (unfiltered) once.
  const allItems = useMemo<Item[]>(() => {
    const listings = listingsRes.data?.listings ?? [];
    const auctions = auctionsRes.data?.auctions ?? [];
    const out: Item[] = [];

    for (const a of auctions) {
      const bid = a.highestBid !== "0" ? a.highestBid : a.startPrice;
      out.push({
        key: `a-${a.id}`,
        to: `/item/${a.token?.collection.id}/${a.token?.tokenId}`,
        tokenURI: a.token?.tokenURI,
        name: a.token?.tokenURI ?? "",
        sortPrice: BigInt(bid ?? "0"),
        createdAt: Number(a.endTime ?? 0),
        seller: a.seller?.id ?? null,
        auctionBid: bid,
        auctionEnd: a.endTime,
      });
    }
    for (const l of listings) {
      out.push({
        key: `l-${l.id}`,
        to: `/item/${l.token?.collection.id}/${l.token?.tokenId}`,
        tokenURI: l.token?.tokenURI,
        name: l.token?.tokenURI ?? "",
        sortPrice: BigInt(l.price ?? "0"),
        createdAt: Number(l.createdAt ?? 0),
        seller: l.seller?.id ?? null,
        price: l.price,
      });
    }
    return out;
  }, [listingsRes.data, auctionsRes.data]);

  // Trending = highest-priced live pieces (top 10).
  const trending = useMemo<TrendItem[]>(() => {
    return [...allItems]
      .sort((a, b) => (b.sortPrice < a.sortPrice ? -1 : b.sortPrice > a.sortPrice ? 1 : 0))
      .slice(0, 10)
      .map((it, i) => ({
        key: it.key,
        to: it.to,
        tokenURI: it.tokenURI,
        price: it.price,
        auctionBid: it.auctionBid,
        auctionEnd: it.auctionEnd,
        rank: i + 1,
      }));
  }, [allItems]);

  // Filtered + sorted for the main table/grid.
  const items = useMemo<Item[]>(() => {
    let out = allItems.filter((it) => {
      if (it.price != null && !showFixed) return false;
      if (it.auctionBid != null && !showAuction) return false;
      return true;
    });

    const q = search.trim().toLowerCase();
    if (q) out = out.filter((it) => it.name.toLowerCase().includes(q));

    const sign = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      if (sortKey === "price")
        return a.sortPrice < b.sortPrice ? -sign : a.sortPrice > b.sortPrice ? sign : 0;
      if (sortKey === "name") return a.name.localeCompare(b.name) * sign;
      return (a.createdAt - b.createdAt) * sign;
    });
    return out;
  }, [allItems, showFixed, showAuction, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageOffset = (safePage - 1) * PAGE_SIZE;
  const pageItems = items.slice(pageOffset, pageOffset + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter, sortKey, sortDir, search]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const nothing = !loading && items.length === 0;

  const tableRows: TableRow[] = pageItems.map((it) => ({
    key: it.key,
    to: it.to,
    tokenURI: it.tokenURI,
    name: it.name,
    price: it.price,
    auctionBid: it.auctionBid,
    auctionEnd: it.auctionEnd,
    seller: it.seller,
    createdAt: it.createdAt,
  }));

  return (
    <div>
      {/* Slim hero */}
      <div className="mb-9">
        <span className="inline-flex items-center gap-2 rounded-full glass-soft px-3 py-1 text-xs font-medium text-stone-300">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-400" />
          On-chain marketplace · collect &amp; create
        </span>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          <span className="text-gradient">Pieces. Collected. Connected.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-stone-400 sm:text-base">
          A living mosaic of on-chain art. Explore, collect, and create your own pieces.
        </p>
      </div>

      {/* Trending */}
      {!loading && <TrendingRail items={trending} />}

      {/* Controls bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-bold">All items</h2>

        <div className="flex rounded-full glass-soft p-1">
          {(["all", "fixed", "auction"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition ${
                filter === f ? "bg-brand-500 text-white" : "text-stone-400 hover:text-white"
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

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-3">
          {!loading && (
            <span className="text-sm text-stone-500">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          )}
          <div className="flex rounded-full glass-soft p-1">
            <ViewBtn active={view === "list"} onClick={() => setView("list")} label="List">
              <ListGlyph />
            </ViewBtn>
            <ViewBtn active={view === "grid"} onClick={() => setView("grid")} label="Grid">
              <GridGlyph />
            </ViewBtn>
          </div>
        </div>
      </div>

      {loading ? (
        <CardSkeletonGrid count={8} />
      ) : nothing ? (
        <EmptyState title="Nothing here yet" hint="Head to Create to mint a piece." />
      ) : view === "list" ? (
        <>
          <StatsTable rows={tableRows} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
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
      ) : (
        <>
          <Masonry>
            {pageItems.map((it, i) => (
              <NftCard
                key={it.key}
                index={pageOffset + i}
                to={it.to}
                tokenURI={it.tokenURI}
                price={it.price}
                auctionBid={it.auctionBid}
                auctionEnd={it.auctionEnd}
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

function ViewBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-full transition ${
        active ? "bg-brand-500 text-white" : "text-stone-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ListGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function GridGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
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
    <nav className="mt-8 flex items-center justify-center gap-2">
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
            p === page ? "bg-brand-500 text-white" : "glass-soft text-stone-300 hover:text-white"
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
