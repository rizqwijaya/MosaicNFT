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

  return (
    <div>
      {/* Hero */}
      <div className="mb-10">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Pieces. Collected. Connected.
        </h1>
        <p className="mt-3 max-w-xl text-stone-500 dark:text-stone-400">
          A living mosaic of on-chain art. Explore, collect, and create, with
          gasless lazy minting included.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-stone-200 p-1 dark:border-stone-800">
          {(["all", "fixed", "auction", "lazy"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                filter === f
                  ? "bg-coral-500 text-white"
                  : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
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
          className="input max-w-[160px]"
        >
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low → high</option>
          <option value="price-desc">Price: high → low</option>
        </select>
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
