import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "urql";
import { useAccount, useReadContract } from "wagmi";
import { USER_PROFILE } from "../lib/queries";
import { Masonry, EmptyState } from "../components/Masonry";
import { NftCard } from "../components/NftCard";
import { CardSkeletonGrid } from "../components/Skeleton";
import { useMarket } from "../hooks/useMarket";
import { MOSAIC_MARKET, marketAbi } from "../lib/contracts";
import { fmtEth, shortAddr, fmtDate, CURRENCY } from "../lib/format";
import type { GqlToken, GqlSale } from "../lib/types";

type Tab = "owned" | "created" | "activity";

export default function Profile() {
  const { address: routeAddr } = useParams();
  const { address: connected } = useAccount();
  const id = (routeAddr ?? "").toLowerCase();
  const isSelf = !!connected && connected.toLowerCase() === id;

  const [tab, setTab] = useState<Tab>("owned");
  const [profileRes, refetch] = useQuery<{
    user: {
      id: string;
      totalWithdrawn: string;
      ownedTokens: GqlToken[];
      createdTokens: GqlToken[];
    } | null;
    sales: GqlSale[];
  }>({ query: USER_PROFILE, variables: { id } });

  const { data: proceeds, refetch: refetchProceeds } = useReadContract({
    address: MOSAIC_MARKET,
    abi: marketAbi,
    functionName: "proceeds",
    args: [id as `0x${string}`],
    query: { enabled: !!id },
  });

  const market = useMarket(() => {
    refetch({ requestPolicy: "network-only" });
    refetchProceeds();
  });

  const user = profileRes.data?.user;
  const sales = profileRes.data?.sales ?? [];
  const proceedsWei = (proceeds as bigint | undefined) ?? 0n;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-stone-500">Profile</div>
          <h1 className="font-display text-3xl font-bold">{shortAddr(id)}</h1>
        </div>

        {/* Withdraw proceeds */}
        <div className="card flex items-center gap-4 px-5 py-3">
          <div>
            <div className="text-xs text-stone-500">Withdrawable</div>
            <div className="font-display text-xl font-bold text-coral-600 dark:text-coral-400">
              {fmtEth(proceedsWei)} {CURRENCY}
            </div>
          </div>
          {isSelf && (
            <button
              disabled={market.isPending || proceedsWei === 0n}
              onClick={() => market.withdraw()}
              className="btn-primary"
            >
              Withdraw
            </button>
          )}
        </div>
      </div>

      {/* tabs */}
      <div className="mb-6 flex gap-1 border-b border-stone-200 dark:border-stone-800">
        {(["owned", "created", "activity"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition ${
              tab === t
                ? "border-coral-500 text-coral-600 dark:text-coral-400"
                : "border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {profileRes.fetching ? (
        <CardSkeletonGrid count={4} />
      ) : tab === "activity" ? (
        sales.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <div className="space-y-2">
            {sales.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3 text-sm dark:border-stone-800"
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
        )
      ) : (
        <TokenGrid
          tokens={tab === "owned" ? (user?.ownedTokens ?? []) : (user?.createdTokens ?? [])}
          empty={tab === "owned" ? "No tokens owned" : "Nothing created yet"}
        />
      )}
    </div>
  );
}

function TokenGrid({ tokens, empty }: { tokens: GqlToken[]; empty: string }) {
  if (tokens.length === 0) return <EmptyState title={empty} />;
  return (
    <Masonry>
      {tokens.map((t, i) => (
        <NftCard
          key={t.id}
          index={i}
          to={`/item/${t.collection.id}/${t.tokenId}`}
          tokenURI={t.tokenURI}
          price={t.listing?.active ? t.listing.price : null}
          fallbackName={`#${t.tokenId}`}
        />
      ))}
    </Masonry>
  );
}
