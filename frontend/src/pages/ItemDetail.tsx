import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "urql";
import { useAccount } from "wagmi";
import { TOKEN_DETAIL } from "../lib/queries";
import { useMetadata } from "../hooks/useMetadata";
import { useMarket } from "../hooks/useMarket";
import { getVoucher, markRedeemed } from "../lib/vouchers";
import { ipfsToHttp, fetchMetadata, type TokenMetadata } from "../lib/ipfs";
import { fmtEth, shortAddr, timeLeft, fmtDate } from "../lib/format";
import { Skeleton } from "../components/Skeleton";
import type { GqlToken, VoucherRecord } from "../lib/types";
import { formatEther } from "viem";

export default function ItemDetail() {
  const params = useParams();
  const isLazy = !!params.nonce;
  if (isLazy)
    return <LazyDetail collection={params.collection!} nonce={params.nonce!} />;
  return <OnchainDetail collection={params.collection!} tokenId={params.tokenId!} />;
}

/* ---------------- on-chain token ---------------- */

function OnchainDetail({
  collection,
  tokenId,
}: {
  collection: string;
  tokenId: string;
}) {
  const { address } = useAccount();
  const id = `${collection.toLowerCase()}-${tokenId}`;
  const [res, refetch] = useQuery<{ token: GqlToken & Record<string, unknown> }>({
    query: TOKEN_DETAIL,
    variables: { id },
  });
  const reload = () => refetch({ requestPolicy: "network-only" });
  const market = useMarket(reload);

  const token = res.data?.token;
  const { meta, loading: metaLoading } = useMetadata(token?.tokenURI);

  if (res.fetching) return <DetailSkeleton />;
  if (!token)
    return (
      <div className="py-20 text-center text-stone-500">
        Token not found yet. If you just minted, give the indexer a moment.
      </div>
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = token as any;
  const listing = t.listing;
  const auction = t.auctions?.[0];
  const offers = t.offers ?? [];
  const sales = t.sales ?? [];
  const owner = t.owner?.id as string | undefined;
  const isOwner = !!address && owner?.toLowerCase() === address.toLowerCase();

  const auctionLive = auction && !auction.settled;
  const auctionEnded =
    auctionLive && Number(auction.endTime) * 1000 <= Date.now();

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <MediaPanel meta={meta} loading={metaLoading} />

      <div>
        <Link
          to={`/collection/${collection}`}
          className="text-sm text-coral-600 hover:underline dark:text-coral-400"
        >
          {t.collection?.name || "MosaicNFT"} →
        </Link>
        <h1 className="mt-1 font-display text-3xl font-bold">
          {meta?.name || `Token #${tokenId}`}
        </h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-stone-500 dark:text-stone-400">
          <span>
            Owner{" "}
            <Link to={`/u/${owner}`} className="text-stone-800 hover:underline dark:text-stone-200">
              {isOwner ? "You" : shortAddr(owner)}
            </Link>
          </span>
          {t.creator?.id && (
            <span>
              Creator{" "}
              <Link to={`/u/${t.creator.id}`} className="text-stone-800 hover:underline dark:text-stone-200">
                {shortAddr(t.creator.id)}
              </Link>
            </span>
          )}
        </div>
        {meta?.description && (
          <p className="mt-4 text-stone-600 dark:text-stone-300">
            {meta.description}
          </p>
        )}

        {/* action panel */}
        <div className="card mt-6 p-5">
          {auctionLive ? (
            <AuctionPanel
              auction={auction}
              isOwner={isOwner}
              ended={!!auctionEnded}
              market={market}
            />
          ) : listing?.active ? (
            <FixedPanel
              listing={listing}
              tokenId={BigInt(tokenId)}
              isOwner={isOwner}
              market={market}
            />
          ) : isOwner ? (
            <OwnerActions tokenId={BigInt(tokenId)} market={market} />
          ) : (
            <div className="text-sm text-stone-500">
              Not currently for sale.
            </div>
          )}

          {/* offers: anyone can offer; owner can accept */}
          {!auctionLive && (
            <OffersBlock
              offers={offers}
              tokenId={BigInt(tokenId)}
              isOwner={isOwner}
              viewer={address}
              market={market}
            />
          )}
        </div>

        {/* activity */}
        <Activity sales={sales} />
      </div>
    </div>
  );
}

function MediaPanel({
  meta,
  loading,
}: {
  meta: TokenMetadata | null;
  loading: boolean;
}) {
  return (
    <div className="card sticky top-24 self-start">
      {loading ? (
        <Skeleton className="aspect-square w-full" />
      ) : meta?.image ? (
        <img src={ipfsToHttp(meta.image)} alt={meta.name} className="w-full object-cover" />
      ) : (
        <div className="flex aspect-square items-center justify-center text-5xl text-stone-300">
          ⬡
        </div>
      )}
    </div>
  );
}

/* ---------------- panels ---------------- */

type Market = ReturnType<typeof useMarket>;

function FixedPanel({
  listing,
  tokenId,
  isOwner,
  market,
}: {
  listing: { price: string };
  tokenId: bigint;
  isOwner: boolean;
  market: Market;
}) {
  return (
    <div>
      <PriceTag label="Fixed price" wei={listing.price} />
      <div className="mt-4 flex gap-2">
        {isOwner ? (
          <button
            disabled={market.isPending}
            onClick={() => market.cancelListing(tokenId)}
            className="btn-ghost"
          >
            Cancel listing
          </button>
        ) : (
          <button
            disabled={market.isPending}
            onClick={() => market.buy(tokenId, BigInt(listing.price))}
            className="btn-primary flex-1"
          >
            Buy now
          </button>
        )}
      </div>
    </div>
  );
}

function AuctionPanel({
  auction,
  isOwner,
  ended,
  market,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auction: any;
  isOwner: boolean;
  ended: boolean;
  market: Market;
}) {
  const hasBid = auction.highestBid !== "0";
  const current = hasBid ? auction.highestBid : auction.startPrice;
  const minNext = hasBid
    ? formatEther(BigInt(auction.highestBid) + 1n)
    : formatEther(BigInt(auction.startPrice));
  const [bid, setBid] = useState(minNext);

  return (
    <div>
      <div className="flex items-center justify-between">
        <PriceTag label={hasBid ? "Current bid" : "Starting price"} wei={current} />
        <div className="text-right">
          <div className="text-xs text-stone-500">Ends in</div>
          <div className="font-display font-semibold">
            {timeLeft(auction.endTime)}
          </div>
        </div>
      </div>

      {ended ? (
        <button
          disabled={market.isPending}
          onClick={() => market.settleAuction(BigInt(auction.id))}
          className="btn-primary mt-4 w-full"
        >
          Settle auction
        </button>
      ) : isOwner ? (
        <div className="mt-4 text-sm text-stone-500">
          Your auction is live. It can be settled after it ends.
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <input
            value={bid}
            onChange={(e) => setBid(e.target.value)}
            className="input"
            inputMode="decimal"
          />
          <button
            disabled={market.isPending}
            onClick={() => market.placeBid(BigInt(auction.id), bid)}
            className="btn-primary shrink-0"
          >
            Place bid
          </button>
        </div>
      )}
    </div>
  );
}

function OwnerActions({
  tokenId,
  market,
}: {
  tokenId: bigint;
  market: Market;
}) {
  const [mode, setMode] = useState<null | "list" | "auction">(null);
  const [price, setPrice] = useState("0.05");
  const [days, setDays] = useState("1");

  return (
    <div>
      <div className="text-sm text-stone-500">You own this. Sell it:</div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => setMode("list")} className="btn-ghost">
          Fixed price
        </button>
        <button onClick={() => setMode("auction")} className="btn-ghost">
          Auction
        </button>
      </div>

      {mode === "list" && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-stone-500">
            Approve the marketplace once, then list.
          </p>
          <div className="flex gap-2">
            <input value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
            <button onClick={() => market.approveCollection()} className="btn-ghost shrink-0">
              Approve
            </button>
            <button
              disabled={market.isPending}
              onClick={() => market.list(tokenId, price)}
              className="btn-primary shrink-0"
            >
              List
            </button>
          </div>
        </div>
      )}

      {mode === "auction" && (
        <div className="mt-4">
          <div className="flex gap-2">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input"
              placeholder="Start price (ETH)"
            />
            <input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="input max-w-[110px]"
              placeholder="Days"
            />
            <button
              disabled={market.isPending}
              onClick={() =>
                market.createAuction(tokenId, price, Math.round(Number(days) * 86400))
              }
              className="btn-primary shrink-0"
            >
              Start
            </button>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            The NFT is escrowed in the marketplace until the auction settles.
          </p>
        </div>
      )}
    </div>
  );
}

function OffersBlock({
  offers,
  tokenId,
  isOwner,
  viewer,
  market,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offers: any[];
  tokenId: bigint;
  isOwner: boolean;
  viewer?: string;
  market: Market;
}) {
  const [amount, setAmount] = useState("0.02");
  return (
    <div className="mt-5 border-t border-stone-200 pt-5 dark:border-stone-800">
      {!isOwner && (
        <div className="mb-4 flex gap-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
          <button
            disabled={market.isPending}
            onClick={() => market.makeOffer(tokenId, amount)}
            className="btn-ghost shrink-0"
          >
            Make offer
          </button>
        </div>
      )}
      {offers.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Offers
          </div>
          {offers.map((o) => {
            const mine = viewer && o.buyer.id.toLowerCase() === viewer.toLowerCase();
            return (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm dark:bg-stone-800/50"
              >
                <span className="font-medium text-coral-600 dark:text-coral-400">
                  {fmtEth(o.amount)} Ξ
                </span>
                <span className="text-stone-500">{shortAddr(o.buyer.id)}</span>
                {isOwner && (
                  <button
                    disabled={market.isPending}
                    onClick={() => market.acceptOffer(BigInt(o.id))}
                    className="btn-primary !px-3 !py-1 text-xs"
                  >
                    Accept
                  </button>
                )}
                {mine && (
                  <button
                    disabled={market.isPending}
                    onClick={() => market.cancelOffer(BigInt(o.id))}
                    className="btn-ghost !px-3 !py-1 text-xs"
                  >
                    Cancel
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Activity({
  sales,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sales: any[];
}) {
  if (!sales.length) return null;
  return (
    <div className="mt-8">
      <h2 className="mb-3 font-display text-lg font-semibold">Activity</h2>
      <div className="space-y-2">
        {sales.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-2.5 text-sm dark:border-stone-800"
          >
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium dark:bg-stone-800">
              {s.kind}
            </span>
            <span className="text-stone-500">
              {shortAddr(s.seller?.id)} → {shortAddr(s.buyer.id)}
            </span>
            <span className="font-medium text-coral-600 dark:text-coral-400">
              {fmtEth(s.price)} Ξ
            </span>
            <span className="text-xs text-stone-400">{fmtDate(s.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceTag({ label, wei }: { label: string; wei: string }) {
  return (
    <div>
      <div className="text-xs text-stone-500">{label}</div>
      <div className="font-display text-3xl font-bold text-coral-600 dark:text-coral-400">
        {fmtEth(wei)} <span className="text-xl">Ξ</span>
      </div>
    </div>
  );
}

/* ---------------- lazy voucher ---------------- */

function LazyDetail({ collection, nonce }: { collection: string; nonce: string }) {
  const { address } = useAccount();
  const [rec, setRec] = useState<VoucherRecord | null>(null);
  const [meta, setMeta] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const market = useMarket();

  useEffect(() => {
    let alive = true;
    getVoucher(collection, nonce).then(async (r) => {
      if (!alive) return;
      setRec(r);
      if (r) setMeta(await fetchMetadata(r.voucher.uri));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [collection, nonce]);

  if (loading) return <DetailSkeleton />;
  if (!rec)
    return (
      <div className="py-20 text-center text-stone-500">
        This voucher is no longer available.
      </div>
    );

  const isCreator =
    !!address && rec.voucher.creator.toLowerCase() === address.toLowerCase();

  const handleBuy = async () => {
    const hash = await market.buyLazy(rec.voucher, BigInt(rec.voucher.minPrice));
    if (hash) markRedeemed(collection, nonce);
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <MediaPanel meta={meta} loading={false} />
      <div>
        <span className="rounded-full bg-coral-500/90 px-2.5 py-1 text-xs font-medium text-white">
          Lazy mint
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {meta?.name || rec.name || "Untitled"}
        </h1>
        <div className="mt-2 text-sm text-stone-500">
          Creator {shortAddr(rec.voucher.creator)} · Royalty{" "}
          {(rec.voucher.royaltyBps / 100).toFixed(1)}%
        </div>
        {meta?.description && (
          <p className="mt-4 text-stone-600 dark:text-stone-300">
            {meta.description}
          </p>
        )}

        <div className="card mt-6 p-5">
          <PriceTag label="Mint price" wei={rec.voucher.minPrice} />
          <p className="mt-3 text-sm text-stone-500">
            Nothing is on-chain yet. Buying mints the NFT directly to you
            (mint-on-buy) and pays the creator.
          </p>
          {isCreator ? (
            <div className="mt-4 text-sm text-stone-500">
              This is your voucher, waiting for a buyer.
            </div>
          ) : (
            <button
              disabled={market.isPending}
              onClick={handleBuy}
              className="btn-primary mt-4 w-full"
            >
              Mint &amp; buy for {fmtEth(rec.voucher.minPrice)} Ξ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <Skeleton className="aspect-square w-full rounded-[var(--radius-card)]" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
