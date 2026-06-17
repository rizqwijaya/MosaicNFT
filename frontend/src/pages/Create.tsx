import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useSignTypedData } from "wagmi";
import { parseEther } from "viem";
import { useMarket } from "../hooks/useMarket";
import { useToast } from "../components/Toast";
import { pinFile, pinJson } from "../lib/ipfs";
import { saveVoucher } from "../lib/vouchers";
import { humanizeError } from "../lib/format";
import {
  MOSAIC_ERC721,
  VOUCHER_DOMAIN,
  VOUCHER_TYPES,
} from "../lib/contracts";

type Mode = "mint" | "lazy";

export default function Create() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const toast = useToast();
  const market = useMarket();
  const { signTypedDataAsync } = useSignTypedData();

  const [mode, setMode] = useState<Mode>("lazy");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [royalty, setRoyalty] = useState("5");
  const [price, setPrice] = useState("0.05");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string>("");

  function onPick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  const royaltyBps = Math.round(Number(royalty) * 100);

  async function uploadMetadata(): Promise<string> {
    setStep("Pinning image to IPFS…");
    const imageUri = await pinFile(file!);
    setStep("Pinning metadata to IPFS…");
    return pinJson({ name, description, image: imageUri });
  }

  async function handleMintNow() {
    if (!address) return;
    setBusy(true);
    try {
      const uri = await uploadMetadata();
      setStep("");
      const hash = await market.mint(address, uri, royaltyBps);
      if (hash) {
        toast.push("success", "Minted! Find it in your Profile › Owned.");
        navigate(`/u/${address}`);
      }
    } catch (err) {
      toast.push("error", humanizeError(err));
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  async function handleLazyList() {
    if (!address) return;
    setBusy(true);
    try {
      const uri = await uploadMetadata();
      const nonce = BigInt(Date.now()); // unique per creator
      const minPrice = parseEther(price);

      setStep("Sign the voucher in your wallet (no gas)…");
      const signature = await signTypedDataAsync({
        domain: VOUCHER_DOMAIN,
        types: VOUCHER_TYPES,
        primaryType: "NFTVoucher",
        message: {
          nonce,
          minPrice,
          uri,
          royaltyBps: BigInt(royaltyBps),
          creator: address,
        },
      });

      setStep("Saving voucher…");
      await saveVoucher({
        id: `${MOSAIC_ERC721.toLowerCase()}-${nonce}`,
        collection: MOSAIC_ERC721.toLowerCase(),
        name,
        image: uri,
        voucher: {
          nonce: nonce.toString(),
          minPrice: minPrice.toString(),
          uri,
          royaltyBps,
          creator: address,
          signature,
        },
      });

      toast.push("success", "Lazy-listed! It's now on Explore, gas-free.");
      navigate(`/lazy/${MOSAIC_ERC721.toLowerCase()}/${nonce}`);
    } catch (err) {
      toast.push("error", humanizeError(err));
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  const canSubmit = isConnected && file && name && !busy;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold">Create</h1>
      <p className="mt-2 text-stone-500 dark:text-stone-400">
        Upload your art, set a royalty, and choose how to sell it.
      </p>

      {/* mode toggle */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <ModeCard
          active={mode === "lazy"}
          onClick={() => setMode("lazy")}
          title="Lazy list"
          desc="Sign a voucher, no gas. Minted only when someone buys."
          badge="Recommended"
        />
        <ModeCard
          active={mode === "mint"}
          onClick={() => setMode("mint")}
          title="Mint now"
          desc="Mint on-chain immediately. You pay gas; it lands in your wallet."
        />
      </div>

      <div className="card mt-6 space-y-5 p-6">
        {/* uploader */}
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Artwork</span>
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-stone-300 dark:border-stone-700">
            {preview ? (
              <img src={preview} alt="preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-sm text-stone-400">
                Click to upload image
              </span>
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
          {mode === "lazy" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Price (Sepolia ETH)</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} className="input" inputMode="decimal" />
            </div>
          )}
        </div>

        {step && (
          <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-3 py-2.5 text-sm text-coral-700 dark:bg-coral-900/20 dark:text-coral-300">
            <span className="size-2 animate-ping rounded-full bg-coral-500" />
            {step}
          </div>
        )}

        {!isConnected ? (
          <p className="text-sm text-stone-500">Connect your wallet to create.</p>
        ) : (
          <button
            disabled={!canSubmit}
            onClick={mode === "mint" ? handleMintNow : handleLazyList}
            className="btn-primary w-full"
          >
            {busy
              ? "Working…"
              : mode === "mint"
                ? "Mint now"
                : "Sign & lazy-list (no gas)"}
          </button>
        )}
      </div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  desc,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[var(--radius-card)] border p-4 text-left transition ${
        active
          ? "border-coral-500 bg-coral-50 dark:bg-coral-900/20"
          : "border-stone-200 hover:border-stone-300 dark:border-stone-800"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-display font-semibold">{title}</span>
        {badge && (
          <span className="rounded-full bg-coral-500 px-2 py-0.5 text-[10px] font-medium text-white">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{desc}</p>
    </button>
  );
}
