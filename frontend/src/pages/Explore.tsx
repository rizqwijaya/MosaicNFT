import { useEffect, useMemo, useState } from "react";
import { useQuery } from "urql";
import { ACTIVE_LISTINGS, LIVE_AUCTIONS } from "../lib/queries";
import { Masonry, EmptyState } from "../components/Masonry";
import { NftCard } from "../components/NftCard";
import { CardSkeletonGrid } from "../components/Skeleton";
import { listVouchers } from "../lib/vouchers";
import type { GqlListing, GqlAuction, VoucherRecord } from "../lib/types";

type Filter = "all" | "fixed" | "auction" | "lazy";
type Sort = "newest" | "price-asc" | "price-desc";

export default function Explore() {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [search, setSearch] = useState("");
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([]);

  const [listingsRes] = useQuery<{ listings: GqlListing[] }>({
    query: ACTIVE_LISTINGS,
    variables: { first: 60, orderBy: "createdAt", orderDirection: "desc" },
  });
  const [auctionsRes] = useQuery<{ auctions: GqlAuction[] }>({
    query: LIVE_AUCTIONS,
    variables: { first: 60, now: String(Math.floor(Date.now() / 1000)) },
  });

  useEffect(() => {
    listVouchers().then(setVouchers).catch(() => setVouchers([]));
  }, []);

  const loading = listingsRes.fetching || auctionsRes.fetching;

  const listings = useMemo(() => {
    let arr = listingsRes.data?.listings ?? [];
    if (sort === "price-asc")
      arr = [...arr].sort((a, b) => Number(BigInt(a.price) - BigInt(b.price)));
    if (sort === "price-desc")
      arr = [...arr].sort((a, b) => Number(BigInt(b.price) - BigInt(a.price)));
    return arr;
  }, [listingsRes.data, sort]);

  const auctions = auctionsRes.data?.auctions ?? [];

  const matches = (s?: string | null) =>
    !search || (s ?? "").toLowerCase().includes(search.toLowerCase());

  const showFixed = filter === "all" || filter === "fixed";
  const showAuction = filter === "all" || filter === "auction";
  const showLazy = filter === "all" || filter === "lazy";

  const nothing =
    !loading &&
    (!showFixed || listings.length === 0) &&
    (!showAuction || auctions.length === 0) &&
    (!showLazy || vouchers.length === 0);

  const liveCount =
    (showFixed ? listings.length : 0) +
    (showAuction ? auctions.length : 0) +
    (showLazy ? vouchers.length : 0);

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
            On-chain · gasless lazy minting
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            <span className="text-gradient">Pieces. Collected. Connected.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-stone-400 sm:text-lg">
            A living mosaic of on-chain art. Explore, collect, and create, with
            gasless lazy minting included.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-7 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full glass-soft p-1">
          {(["all", "fixed", "auction", "lazy"] as Filter[]).map((f) => (
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
          hint="Be the first. Head to Create to mint or lazy-list a piece."
        />
      ) : (
        <Masonry>
          {showAuction &&
            auctions
              .filter((a) => matches(a.token?.tokenURI))
              .map((a, i) => (
                <NftCard
                  key={`a-${a.id}`}
                  index={i}
                  to={`/item/${a.token?.collection.id}/${a.token?.tokenId}`}
                  tokenURI={a.token?.tokenURI}
                  auctionBid={a.highestBid !== "0" ? a.highestBid : a.startPrice}
                  auctionEnd={a.endTime}
                />
              ))}
          {showFixed &&
            listings
              .filter((l) => matches(l.token?.tokenURI))
              .map((l, i) => (
                <NftCard
                  key={`l-${l.id}`}
                  index={i}
                  to={`/item/${l.token?.collection.id}/${l.token?.tokenId}`}
                  tokenURI={l.token?.tokenURI}
                  price={l.price}
                />
              ))}
          {showLazy &&
            vouchers.map((v, i) => (
              <NftCard
                key={`v-${v.id}`}
                index={i}
                to={`/lazy/${v.collection}/${v.voucher.nonce}`}
                tokenURI={v.voucher.uri}
                price={v.voucher.minPrice}
                lazy
                fallbackName={v.name}
              />
            ))}
        </Masonry>
      )}
    </div>
  );
}
