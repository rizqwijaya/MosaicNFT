import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "wagmi";

// WalletConnect project id — set VITE_WALLETCONNECT_PROJECT_ID in env.
// A placeholder still lets injected wallets (MetaMask) work locally.
const projectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "MOSAICNFT_DEV";

const rpcUrl = import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined;

export const wagmiConfig = getDefaultConfig({
  appName: "MosaicNFT",
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(rpcUrl), // falls back to public RPC when undefined
  },
  ssr: false,
});
