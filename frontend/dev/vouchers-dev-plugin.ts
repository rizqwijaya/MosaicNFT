import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Plugin, Connect } from "vite";

// Dev-only mock for the Netlify-function API routes.
//
// Plain `vite` does not run Netlify functions, so `fetch("/api/vouchers")`
// would fall through to the SPA index.html and the Explore grid stays empty.
// This middleware serves:
//   - /api/vouchers[/:collection/:nonce]  -> seeded lazy-mint voucher records
//   - /api/dev-meta/:nonce                -> token metadata JSON for a voucher
// In production the real Netlify function (backed by Netlify Blobs) handles
// the voucher routes, and real metadata/images live on IPFS. This plugin is
// `apply: "serve"` only and never ships to the build.

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, "seed-vouchers.json");

interface VoucherRecord {
  id: string;
  collection: string;
  name?: string;
  image?: string;
  voucher: { nonce: string; [k: string]: unknown };
  redeemed?: boolean;
  createdAt: number;
  [k: string]: unknown;
}

function loadSeed(): VoucherRecord[] {
  // Read on every request so edits to the seed show up without a restart.
  try {
    return JSON.parse(readFileSync(SEED_PATH, "utf8")) as VoucherRecord[];
  } catch {
    return [];
  }
}

type Res = Parameters<Connect.NextHandleFunction>[1];

function sendJson(res: Res, obj: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

export function vouchersDevPlugin(): Plugin {
  return {
    name: "mosaic-vouchers-dev",
    apply: "serve",
    configureServer(server) {
      // --- Token metadata JSON for a voucher nonce ---
      server.middlewares.use("/api/dev-meta", (req, res, next) => {
        const path = (req.url || "/").split("?")[0];
        const m = path.match(/\/(\d+)$/);
        if (!m) return next();
        const n = m[1];
        const rec = loadSeed().find((r) => r.voucher.nonce === n);
        if (!rec) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        sendJson(res, {
          name: rec.name ?? `Mosaic #${n}`,
          description: "A demo lazy-mint piece on the Mosaic gallery.",
          image: rec.image ?? "",
        });
      });

      // --- Lazy-mint voucher store ---
      server.middlewares.use("/api/vouchers", (req, res, next) => {
        const method = req.method || "GET";
        // req.url here is relative to the mounted base ("/api/vouchers").
        const path = (req.url || "/").split("?")[0];
        const segs = path.split("/").filter(Boolean);

        if (method === "GET") {
          const all = loadSeed();
          if (segs.length >= 2) {
            const [collection, nonce] = segs;
            const rec = all.find(
              (r) =>
                r.collection.toLowerCase() === collection.toLowerCase() &&
                r.voucher.nonce === nonce
            );
            if (!rec) {
              res.statusCode = 404;
              res.end("Not found");
              return;
            }
            return sendJson(res, rec);
          }
          const vouchers = all
            .filter((r) => !r.redeemed)
            .sort((a, b) => b.createdAt - a.createdAt);
          return sendJson(res, { vouchers });
        }

        // POST/DELETE: accept but no-op in dev (seed is read-only).
        if (method === "POST" || method === "DELETE") {
          return sendJson(res, { ok: true });
        }

        next();
      });
    },
  };
}
