import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ChainFilter } from "./ChainFilter";

function navClass({ isActive }: { isActive: boolean }) {
  return `text-sm font-medium transition hover:text-white ${
    isActive ? "text-white" : "text-stone-400"
  }`;
}

/**
 * Wallet button styled to match the app's own buttons (.btn-primary / .btn-ghost)
 * so it sits flush with "Create" instead of RainbowKit's taller default chrome.
 */
function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {!connected ? (
              <button onClick={openConnectModal} className="btn-primary">
                Connect Wallet
              </button>
            ) : chain.unsupported ? (
              <button onClick={openChainModal} className="btn-primary">
                Wrong network
              </button>
            ) : (
              <button onClick={openAccountModal} className="btn-ghost">
                {chain.hasIcon && chain.iconUrl && (
                  <img
                    src={chain.iconUrl}
                    alt={chain.name ?? "Chain"}
                    className="size-4 rounded-full"
                  />
                )}
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

/** Trust strip: a muted row of partner/brand badges, Rarible-style. */
const TRUST_BRANDS = ["Ethereum", "IPFS", "The Graph", "Pinata", "RainbowKit", "Viem"];

function TrustStrip() {
  return (
    <div className="border-y border-white/5 bg-white/[0.015]">
      <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-8 overflow-x-auto px-4 py-5 sm:px-6">
        <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-stone-600">
          Built with
        </span>
        {TRUST_BRANDS.map((b) => (
          <span
            key={b}
            className="shrink-0 font-display text-sm font-semibold text-stone-500 transition hover:text-stone-300"
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Layout() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Top navigation bar - flat, full-width */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-iris-500 font-display text-lg font-bold text-white">
              M
            </span>
            <span className="hidden font-display text-lg font-bold tracking-tight sm:block">
              Mosaic
            </span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <NavLink to="/" end className={navClass}>
              Explore
            </NavLink>
            <NavLink to="/create" className={navClass}>
              Create
            </NavLink>
            <NavLink to="/profile" className={navClass}>
              Profile
            </NavLink>
          </nav>

          {/* Search - center/grow */}
          <div className="relative ml-auto hidden max-w-sm flex-1 lg:block">
            <SearchIcon />
            <input
              placeholder="Search items, collections…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const q = (e.target as HTMLInputElement).value.trim();
                  navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
                }
              }}
              className="input !pl-10"
            />
          </div>

          <div className="ml-auto flex items-center gap-2.5 lg:ml-0">
            <Link to="/create" className="btn-primary hidden sm:inline-flex">
              Create
            </Link>
            <WalletButton />
          </div>
        </div>

        {/* Chain filter row */}
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6">
          <ChainFilter />
        </div>

        {/* Mobile nav */}
        <nav className="mx-auto flex max-w-7xl items-center gap-6 border-t border-white/5 px-4 py-2.5 md:hidden">
          <NavLink to="/" end className={navClass}>
            Explore
          </NavLink>
          <NavLink to="/create" className={navClass}>
            Create
          </NavLink>
          <NavLink to="/profile" className={navClass}>
            Profile
          </NavLink>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <TrustStrip />

      <footer className="bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-stone-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-iris-500 font-display text-sm font-bold text-white">
              M
            </span>
            <span className="font-display font-semibold text-stone-300">Mosaic</span>
            <span className="text-stone-600">· Pieces. Collected. Connected.</span>
          </div>
          <span className="text-stone-600">
            Running on{" "}
            <span className="font-medium text-brand-400">Sepolia testnet</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
