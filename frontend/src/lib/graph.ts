import { Client, cacheExchange, fetchExchange } from "urql";

// Subgraph query endpoint (Subgraph Studio). Override with VITE_SUBGRAPH_URL.
const SUBGRAPH_URL =
  import.meta.env.VITE_SUBGRAPH_URL ||
  "https://api.studio.thegraph.com/query/1755292/mosaicnft/v0.0.1";

export const graphClient = new Client({
  url: SUBGRAPH_URL,
  exchanges: [cacheExchange, fetchExchange],
  requestPolicy: "cache-and-network",
});
