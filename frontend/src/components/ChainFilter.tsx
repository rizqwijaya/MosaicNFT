// Chain filter chip row - Rarible-style. MosaicNFT only runs on Sepolia, so the
// other chains are cosmetic/disabled. Sepolia is the single active network.

interface Chain {
  id: string;
  label: string;
  dot: string; // accent dot color
  live?: boolean;
}

const CHAINS: Chain[] = [
  { id: "sepolia", label: "Sepolia", dot: "#5b7fff", live: true },
  { id: "ethereum", label: "Ethereum", dot: "#627eea" },
  { id: "base", label: "Base", dot: "#0052ff" },
  { id: "polygon", label: "Polygon", dot: "#8247e5" },
  { id: "arbitrum", label: "Arbitrum", dot: "#28a0f0" },
];

export function ChainFilter() {
  return (
    <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-0.5">
      {CHAINS.map((c) => (
        <button
          key={c.id}
          disabled={!c.live}
          title={c.live ? `${c.label} (active)` : `${c.label} - not available on this testnet build`}
          className={`chip shrink-0 ${c.live ? "chip-active" : "opacity-55"} ${
            c.live ? "" : "cursor-not-allowed"
          }`}
        >
          <span className="size-2 rounded-full" style={{ background: c.dot }} />
          {c.label}
          {c.live && (
            <span className="ml-0.5 rounded-full bg-brand-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-brand-200">
              LIVE
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
