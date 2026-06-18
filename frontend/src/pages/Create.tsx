import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useMarket } from "../hooks/useMarket";
import { useToast } from "../components/Toast";
import { pinFile, pinJson } from "../lib/ipfs";
import { humanizeError } from "../lib/format";

export default function Create() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const toast = useToast();
  const market = useMarket();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [royalty, setRoyalty] = useState("5");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string>("");

  function onPick(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  const royaltyBps = Math.round(Number(royalty) * 100);

  async function handleMintNow() {
    if (!address) return;
    setBusy(true);
    try {
      setStep("Pinning image to IPFS…");
      const imageUri = await pinFile(file!);
      setStep("Pinning metadata to IPFS…");
      const uri = await pinJson({ name, description, image: imageUri });
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

  const canSubmit = isConnected && file && name && !busy;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold">Create</h1>
      <p className="mt-2 text-stone-500 dark:text-stone-400">
        Upload your art, set a royalty, and mint it to your wallet.
      </p>

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
            onClick={handleMintNow}
            className="btn-primary w-full"
          >
            {busy ? "Working…" : "Mint now"}
          </button>
        )}
      </div>
    </div>
  );
}
