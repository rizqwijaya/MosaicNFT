import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "urql";
import { useAccount, useReadContract } from "wagmi";
import { TOKEN_DETAIL, AIRDROP_DETAIL } from "../lib/queries";
import { useMetadata } from "../hooks/useMetadata";
import { useMarket } from "../hooks/useMarket";
import { useToast } from "../components/Toast";
import { ipfsToHttp, type TokenMetadata } from "../lib/ipfs";
import { fmtEth, shortAddr, timeLeft, fmtDate, CURRENCY, humanizeError } from "../lib/format";
import { MOSAIC_ERC721, erc721Abi } from "../lib/contracts";
import { Skeleton } from "../components/Skeleton";
import type { GqlToken, GqlAirdrop } from "../lib/types";
import { formatEther } from "viem";

export default function ItemDetail() {
  const params = useParams();
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
      <MediaPanel meta={meta} loading={metaLoading} tokenPath={`/item/${collection}/${tokenId}`} />

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

// Same photo pool as NftCard — must stay in sync.
const DETAIL_PHOTOS = [
  "photo-1618005182384-a83a8bd57fbe",
  "photo-1558618666-fcd25c85cd64",
  "photo-1604871000636-074fa5117945",
  "photo-1617791160536-598cf32026fb",
  "photo-1541701494587-cb58502866ab",
  "photo-1618172193763-c511deb635ca",
  "photo-1620641788421-7a1c342ea42e",
  "photo-1559827260-dc66d52bef19",
  "photo-1567359781514-3b964e2b04d6",
  "photo-1553356084-58ef4a67b2a7",
  "photo-1614850523459-c2f4c699c52e",
  "photo-1635070041078-e363dbe005cb",
  "photo-1580927752452-89d86da3fa0a",
  "photo-1534796636912-3b952d172bf7",
  "photo-1533134486753-c833f0ed4866",
  "photo-1547036967-23d11aacaee0",
  "photo-1518640467707-6811f4a6ab73",
  "photo-1507525428034-b723cf961d3e",
  "photo-1519681393784-d120267933ba",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1506905925346-21bda4d32df4",
  "photo-1469474968028-56623f02e42e",
  "photo-1447752875215-b2761acf3dfd",
  "photo-1475924156734-496f6cac6ec1",
  "photo-1433086966358-54859d0ed716",
  "photo-1465146344425-f00d5f5c8f07",
  "photo-1418065460487-3e41a6c84dc5",
  "photo-1502082553048-f009c37129b9",
  "photo-1490730141103-6cac27aaab94",
  "photo-1504701954957-2010ec3bcec1",
  "photo-1511300636408-a63a89df3482",
  "photo-1500534314209-a25ddb2bd429",
  "photo-1470071459604-3b5ec3a7fe05",
  "photo-1444464666168-49d633b86797",
  "photo-1473773508845-188df298d2d1",
  "photo-1477346611705-65d1883cee1e",
];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function MediaPanel({
  meta,
  loading,
  tokenPath,
}: {
  meta: TokenMetadata | null;
  loading: boolean;
  tokenPath: string;
}) {
  const [imgError, setImgError] = useState(false);
  const ipfsImg = meta?.image ? ipfsToHttp(meta.image) : "";
  const fallback =
    `https://images.unsplash.com/${DETAIL_PHOTOS[hashStr(tokenPath) % DETAIL_PHOTOS.length]}` +
    `?auto=format&fit=crop&w=800&q=80&sat=-100`;
  const src = !imgError && ipfsImg ? ipfsImg : fallback;

  return (
    <div className="card sticky top-24 self-start">
      {loading ? (
        <Skeleton className="aspect-square w-full" />
      ) : (
        <img
          src={src}
          alt={meta?.name ?? "NFT"}
          className="w-full object-cover"
          onError={() => setImgError(true)}
        />
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
              placeholder="Start price (Sepolia ETH)"
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
                  {fmtEth(o.amount)} {CURRENCY}
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
              {fmtEth(s.price)} {CURRENCY}
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
        {fmtEth(wei)} <span className="text-base font-medium">{CURRENCY}</span>
      </div>
    </div>
  );
}

/* ---------------- free airdrop ---------------- */

export function AirdropDetail() {
  const { id } = useParams();
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const toast = useToast();

  const [res] = useQuery<{ airdrop: GqlAirdrop | null }>({
    query: AIRDROP_DETAIL,
    variables: { id },
  });
  const drop = res.data?.airdrop;
  const { meta, loading: metaLoading } = useMetadata(drop?.uri);
  const market = useMarket();

  // Has the connected wallet already claimed this campaign?
  const { data: claimed } = useReadContract({
    address: MOSAIC_ERC721,
    abi: erc721Abi,
    functionName: "hasClaimed",
    args: [BigInt(id ?? "0"), (address ?? "0x0") as `0x${string}`],
    query: { enabled: !!address && !!id },
  });

  if (res.fetching) return <DetailSkeleton />;
  if (!drop)
    return (
      <div className="py-20 text-center text-stone-500">
        This airdrop is no longer available.
      </div>
    );

  const max = BigInt(drop.maxClaims ?? "0");
  const minted = BigInt(drop.claimed ?? "0");
  const exhausted = max !== 0n && minted >= max;
  const alreadyClaimed = !!claimed;
  const canClaim =
    isConnected && drop.active && !exhausted && !alreadyClaimed && !market.isPending;

  const handleClaim = async () => {
    try {
      const hash = await market.claimAirdrop(BigInt(drop.id));
      if (hash) {
        toast.push("success", "Claimed! Find it in your Profile › Owned.");
        if (address) navigate(`/u/${address}`);
      }
    } catch (err) {
      toast.push("error", humanizeError(err));
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <MediaPanel meta={meta} loading={metaLoading} tokenPath={`/airdrop/${id}`} />
      <div>
        <span className="rounded-full bg-coral-500/90 px-2.5 py-1 text-xs font-medium text-white">
          Free claim
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {meta?.name || "Untitled"}
        </h1>
        <div className="mt-2 text-sm text-stone-500">
          Creator {shortAddr(drop.creator.id)} · Royalty{" "}
          {(drop.royaltyBps / 100).toFixed(1)}%
        </div>
        {meta?.description && (
          <p className="mt-4 text-stone-600 dark:text-stone-300">
            {meta.description}
          </p>
        )}

        <div className="card mt-6 p-5">
          <div className="text-xs text-stone-500">Price</div>
          <div className="font-display text-3xl font-bold text-coral-600 dark:text-coral-400">
            Free
          </div>
          <p className="mt-3 text-sm text-stone-500">
            {max === 0n
              ? `${minted.toString()} claimed so far.`
              : `${minted.toString()} of ${max.toString()} claimed.`}{" "}
            Claiming mints the NFT directly to you. You pay only gas.
          </p>

          {!isConnected ? (
            <p className="mt-4 text-sm text-stone-500">
              Connect your wallet to claim.
            </p>
          ) : alreadyClaimed ? (
            <div className="mt-4 text-sm text-stone-500">
              You already claimed this drop.
            </div>
          ) : exhausted || !drop.active ? (
            <div className="mt-4 text-sm text-stone-500">
              This drop is closed.
            </div>
          ) : (
            <button
              disabled={!canClaim}
              onClick={handleClaim}
              className="btn-primary mt-4 w-full"
            >
              {market.isPending ? "Claiming…" : "Claim free NFT"}
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
