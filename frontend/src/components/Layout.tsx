import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { ThemeToggle } from "./ThemeToggle";

function navClass({ isActive }: { isActive: boolean }) {
  return `text-sm font-medium transition hover:text-coral-600 dark:hover:text-coral-400 ${
    isActive ? "text-coral-600 dark:text-coral-400" : "text-stone-600 dark:text-stone-300"
  }`;
}

export function Layout() {
  const { address } = useAccount();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-stone-50/80 backdrop-blur-xl dark:border-stone-800 dark:bg-stone-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-coral-500 font-display text-lg font-bold text-white">
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
              {address && (
                <NavLink to={`/u/${address}`} className={navClass}>
                  Profile
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/create" className="btn-primary hidden sm:inline-flex">
              Create
            </Link>
            <ThemeToggle />
            <ConnectButton
              chainStatus="icon"
              accountStatus="address"
              showBalance={false}
            />
          </div>
        </div>
        <nav className="flex items-center gap-6 border-t border-stone-200/70 px-4 py-2 md:hidden dark:border-stone-800">
          <NavLink to="/" end className={navClass}>
            Explore
          </NavLink>
          <NavLink to="/create" className={navClass}>
            Create
          </NavLink>
          {address && (
            <button onClick={() => navigate(`/u/${address}`)} className={navClass({ isActive: false })}>
              Profile
            </button>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200/70 py-8 text-center text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
        <span className="font-display font-medium">Mosaic</span> · Pieces.
        Collected. Connected. · Sepolia testnet
      </footer>
    </div>
  );
}
