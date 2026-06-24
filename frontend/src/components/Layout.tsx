import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link, NavLink, Outlet } from "react-router-dom";

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

/** Animated aurora gradient field that sits behind the whole app. */
function AuroraField() {
  return (
    <div className="aurora-field" aria-hidden>
      <div
        className="aurora-blob animate-aurora"
        style={{
          top: "-12%",
          left: "-8%",
          width: "48vw",
          height: "48vw",
          background:
            "radial-gradient(circle at 30% 30%, rgba(255,107,92,0.55), transparent 65%)",
        }}
      />
      <div
        className="aurora-blob animate-aurora"
        style={{
          top: "8%",
          right: "-10%",
          width: "42vw",
          height: "42vw",
          background:
            "radial-gradient(circle at 70% 30%, rgba(139,92,246,0.5), transparent 65%)",
          animationDelay: "-7s",
        }}
      />
      <div
        className="aurora-blob animate-aurora"
        style={{
          bottom: "-18%",
          left: "25%",
          width: "46vw",
          height: "46vw",
          background:
            "radial-gradient(circle at 50% 50%, rgba(56,189,248,0.32), transparent 65%)",
          animationDelay: "-13s",
        }}
      />
      {/* subtle grain/vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}

export function Layout() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <AuroraField />

      <header className="sticky top-0 z-40">
        <div className="mx-auto mt-3 flex max-w-7xl items-center justify-between gap-4 rounded-full glass px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-coral-400 to-coral-600 font-display text-lg font-bold text-white shadow-lg shadow-coral-500/30">
                M
              </span>
              <span className="hidden font-display text-lg font-bold tracking-tight sm:block">
                Mosaic
              </span>
            </Link>
            <nav className="hidden items-center gap-7 md:flex">
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
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/create" className="btn-primary hidden sm:inline-flex">
              Create
            </Link>
            <WalletButton />
          </div>
        </div>
        <nav className="mx-auto mt-2 flex max-w-7xl items-center gap-6 rounded-full glass-soft px-5 py-2 md:hidden">
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

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6">
        <div className="glass-soft rounded-2xl px-6 py-5 text-center text-sm text-stone-400">
          <span className="font-display font-semibold text-stone-200">Mosaic</span>{" "}
          · Pieces. Collected. Connected. ·{" "}
          <span className="text-coral-400">Sepolia testnet</span>
        </div>
      </footer>
    </div>
  );
}
