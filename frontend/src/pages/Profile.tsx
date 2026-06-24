import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
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
  const navigate = useNavigate();

  // The /profile route has no address param: it's the connected wallet's own
  // profile. Redirect to its canonical /u/{address} URL, or prompt to connect.
  if (!routeAddr) {
    if (connected) return <Navigate to={`/u/${connected}`} replace />;
    return <ConnectPrompt />;
  }

  return <ProfileView routeAddr={routeAddr} connected={connected} navigate={navigate} />;
}

/** Shown on /profile when no wallet is connected. */
function ConnectPrompt() {
  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-stone-500">Profile</div>
        <h1 className="font-display text-3xl font-bold">Your collection</h1>
      </div>
      <div className="card flex flex-col items-center gap-5 px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-coral-500/10 text-coral-400">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M16 12h.01M2 10h20" />
          </svg>
        </span>
        <div>
          <div className="font-display text-lg font-semibold text-stone-100">
            Connect your wallet
          </div>
          <p className="mt-1 max-w-sm text-sm text-stone-400">
            Connect a wallet to view the pieces you own, the ones you created,
            and your activity.
          </p>
        </div>
        <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
      </div>
    </div>
  );
}

interface ProfileViewProps {
  routeAddr: string;
  connected?: `0x${string}`;
  navigate: ReturnType<typeof useNavigate>;
}

function ProfileView({ routeAddr, connected, navigate }: ProfileViewProps) {
  const id = routeAddr.toLowerCase();
  const isSelf = !!connected && connected.toLowerCase() === id;

  // When the active MetaMask account changes, follow it: snap the Profile route
  // to the newly connected wallet so it never shows a stale, different account.
  const prevConnected = useRef<string | undefined>(connected);
  useEffect(() => {
    if (connected && connected !== prevConnected.current) {
      prevConnected.current = connected;
      if (connected.toLowerCase() !== id) {
        navigate(`/u/${connected}`, { replace: true });
      }
    }
  }, [connected, id, navigate]);

  const [tab, setTab] = useState<Tab>("owned");
  const [profileRes, refetch] = useQuery<{
    user: {
      id: string;
      totalWithdrawn: string;
      ownedTokens: GqlToken[];
      createdTokens: GqlToken[];
    } | null;
    sales: GqlSale[];
  }>({
    query: USER_PROFILE,
    variables: { id },
    // Always hit the network: the subgraph indexes a few blocks behind a mint,
    // so a cached "no tokens" result would otherwise stick around.
    requestPolicy: "network-only",
  });

  // The subgraph lags the chain by a few blocks after a mint/buy. Poll a few
  // times on mount so a freshly bought token appears without a manual refresh.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!id) return;
    let tries = 0;
    pollRef.current = setInterval(() => {
      tries += 1;
      refetch({ requestPolicy: "network-only" });
      if (tries >= 6 && pollRef.current) clearInterval(pollRef.current);
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, refetch]);

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

      {/* Different-account notice: the connected wallet is not the profile shown. */}
      {connected && !isSelf && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-coral-500/30 bg-coral-500/10 px-5 py-3.5 text-sm">
          <div className="text-stone-200">
            You are viewing{" "}
            <span className="font-medium">{shortAddr(id)}</span>. Your connected
            wallet is{" "}
            <span className="font-medium text-coral-300">
              {shortAddr(connected)}
            </span>
            . NFTs you bought live on the wallet you paid with.
          </div>
          <Link to={`/u/${connected}`} className="btn-primary shrink-0">
            View my profile
          </Link>
        </div>
      )}

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

      {profileRes.error && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3.5 text-sm text-red-200">
          Failed to load profile data: {profileRes.error.message}
        </div>
      )}

      {profileRes.fetching && !profileRes.data ? (
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
