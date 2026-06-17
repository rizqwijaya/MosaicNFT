---
name: urql-get-method-subgraph-bug
description: Why all subgraph queries silently returned empty in the MosaicNFT frontend, and the one-line fix
metadata:
  type: project
---

In the MosaicNFT frontend, every The Graph subgraph query (Explore listings/auctions, ItemDetail, Profile, Collection) silently returned empty/errored, so on-chain data never showed (only Netlify-function lazy vouchers appeared).

Root cause: `@urql/core` v6 defaults query requests to **GET**. The Graph Studio endpoint (`api.studio.thegraph.com/query/.../mosaicnft/...`) **redirects GET to its GraphiQL HTML UI**, so urql received HTML instead of JSON → `result.error` set, `data` undefined. POST works fine (curl/raw fetch POST returns JSON).

Fix: set `preferGetMethod: false` on the urql `Client` in [frontend/src/lib/graph.ts](frontend/src/lib/graph.ts). Forces POST → JSON.

**Why:** the symptom (empty Profile/Explore) looks like indexing lag or a wallet/account mismatch, so it's easy to chase the wrong thing for a long time. The subgraph itself was fine the whole time.

**How to apply:** when subgraph reads come back empty but a manual `curl -X POST` to the same endpoint returns data, suspect the GraphQL client's HTTP method (GET vs POST) before blaming indexing, cache, or addresses. Related: [[mosaicnft-demo-vouchers-onchain]].
