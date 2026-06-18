import { useState } from "react";
import { useQuery } from "urql";
import { useAccount, useReadContract } from "wagmi";
import { ACTIVE_AIRDROPS } from "../lib/queries";
import { Masonry, EmptyState } from "../components/Masonry";
import { NftCard } from "../components/NftCard";
import { CardSkeletonGrid } from "../components/Skeleton";
import { useMarket } from "../hooks/useMarket";
import { useToast } from "../components/Toast";
import { pinFile, pinJson } from "../lib/ipfs";
import { humanizeError } from "../lib/format";
import { MOSAIC_ERC721, erc721Abi } from "../lib/contracts";
import type { GqlAirdrop } from "../lib/types";

export default function Airdrop() {
  const { address } = useAccount();

  // Only the collection owner may create airdrop campaigns.
  const { data: ownerAddr } = useReadContract({
    address: MOSAIC_ERC721,
    abi: erc721Abi,
    functionName: "owner",
  });
  const isOwner =
    !!address &&
    !!ownerAddr &&
    (ownerAddr as string).toLowerCase() === address.toLowerCase();

  const [res, refetch] = useQuery<{ airdrops: GqlAirdrop[] }>({
    query: ACTIVE_AIRDROPS,
    variables: { first: 60 },
  });
  const reload = () => refetch({ requestPolicy: "network-only" });

  const all = res.data?.airdrops ?? [];
  // Hide exhausted campaigns (maxClaims > 0 && claimed >= maxClaims).
  const drops = all.filter((d) => {
    const max = BigInt(d.maxClaims ?? "0");
    const claimed = BigInt(d.claimed ?? "0");
    return max === 0n || claimed < max;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Free drops</h1>
        <p className="mt-2 text-stone-500 dark:text-stone-400">
          Claim a free piece — you pay only gas. One per wallet.
        </p>
      </div>

      {isOwner && <CreateAirdropForm onCreated={reload} />}

      {res.fetching ? (
        <CardSkeletonGrid count={8} />
      ) : drops.length === 0 ? (
        <EmptyState
          title="No live drops"
          hint={
            isOwner
              ? "Publish one above to get started."
              : "Check back soon for free claimable pieces."
          }
        />
      ) : (
        <Masonry>
          {drops.map((d, i) => (
            <NftCard
              key={d.id}
              index={i}
              to={`/airdrop/${d.id}`}
              tokenURI={d.uri}
              free
            />
          ))}
        </Masonry>
      )}
    </div>
  );
}

function CreateAirdropForm({ onCreated }: { onCreated: () => void }) {
  const { isConnected } = useAccount();
  const toast = useToast();
  const market = useMarket(onCreated);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [royalty, setRoyalty] = useState("5");
  const [maxClaims, setMaxClaims] = useState("100");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");

  function onPick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  function reset() {
    setFile(null);
    setPreview("");
    setName("");
    setDescription("");
    setRoyalty("5");
    setMaxClaims("100");
  }

  async function handleCreate() {
    setBusy(true);
    try {
      setStep("Pinning image to IPFS…");
      const imageUri = await pinFile(file!);
      setStep("Pinning metadata to IPFS…");
      const uri = await pinJson({ name, description, image: imageUri });
      setStep("");
      const royaltyBps = Math.round(Number(royalty) * 100);
      const hash = await market.createAirdrop(
        uri,
        royaltyBps,
        Math.max(0, Math.round(Number(maxClaims) || 0))
      );
      if (hash) {
        toast.push("success", "Airdrop live! It's now claimable below.");
        reset();
        setOpen(false);
      }
    } catch (err) {
      toast.push("error", humanizeError(err));
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  const canSubmit = isConnected && file && name && !busy;

  if (!open) {
    return (
      <div className="card mb-8 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="font-display font-semibold">Publish a free drop</div>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Owner only. Anyone can then claim it (they pay gas).
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary shrink-0">
          New airdrop
        </button>
      </div>
    );
  }

  return (
    <div className="card mb-8 space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">New airdrop</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-sm text-stone-400 hover:text-white"
        >
          Cancel
        </button>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium">Artwork</span>
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-stone-300 dark:border-stone-700">
          {preview ? (
            <img src={preview} alt="preview" className="h-full w-full object-contain" />
          ) : (
            <span className="text-sm text-stone-400">Click to upload image</span>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </label>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Title</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="input resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Royalty %</label>
          <input value={royalty} onChange={(e) => setRoyalty(e.target.value)} className="input" inputMode="decimal" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Max claims (0 = unlimited)
          </label>
          <input
            value={maxClaims}
            onChange={(e) => setMaxClaims(e.target.value)}
            className="input"
            inputMode="numeric"
          />
        </div>
      </div>

      {step && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-3 py-2.5 text-sm text-coral-700 dark:bg-coral-900/20 dark:text-coral-300">
          <span className="size-2 animate-ping rounded-full bg-coral-500" />
          {step}
        </div>
      )}

      <button disabled={!canSubmit} onClick={handleCreate} className="btn-primary w-full">
        {busy ? "Working…" : "Publish airdrop"}
      </button>
    </div>
  );
}

// Re-export the detail/claim view so the router can import both from pages.
export { AirdropDetail } from "./ItemDetail";
