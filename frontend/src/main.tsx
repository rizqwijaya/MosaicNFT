import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { Provider as UrqlProvider } from "urql";

import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";

import App from "./App.tsx";
import { wagmiConfig } from "./lib/wagmi";
import { graphClient } from "./lib/graph";
import { ToastProvider } from "./components/Toast";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({ accentColor: "#5b7fff", borderRadius: "large" })}
        >
          <UrqlProvider value={graphClient}>
            <ToastProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ToastProvider>
          </UrqlProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);
