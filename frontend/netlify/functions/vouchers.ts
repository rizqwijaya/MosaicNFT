import type { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Lazy-mint voucher store (§6a).
//
// Storage choice: **Netlify Blobs** — a built-in key-value store, no external
// DB to provision, keyed by `${collection}-${nonce}`. This holds ONLY the
// already-signed voucher payload between "creator signs" and "buyer redeems".
// It has no authority: the MosaicERC721 contract re-verifies the EIP-712
// signature and the nonce on redeem(), so a wrong/compromised store can't forge
// a sale — at worst a voucher is unavailable, never a fake mint.
//
// Routes (via redirect in netlify.toml: /api/vouchers/* -> this function):
//   GET    /api/vouchers                       -> { vouchers: [...] }   (open only)
//   GET    /api/vouchers/:collection/:nonce    -> VoucherRecord
//   POST   /api/vouchers   { id, collection, voucher, name, image }
//   DELETE /api/vouchers/:collection/:nonce    -> mark redeemed (best-effort)

interface VoucherRecord {
  id: string;
  collection: string;
  voucher: Record<string, unknown>;
  name?: string;
  image?: string;
  redeemed?: boolean;
  createdAt: number;
}

function store() {
  return getStore({ name: "vouchers", consistency: "strong" });
}

function key(collection: string, nonce: string) {
  return `${collection.toLowerCase()}-${nonce}`;
}

function json(obj: unknown, statusCode = 200) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

// Extract trailing path segments after the function name.
function segments(path: string): string[] {
  const after = path.split("/vouchers")[1] || "";
  return after.split("/").filter(Boolean);
}

export const handler: Handler = async (event) => {
  const s = store();
  const segs = segments(event.path);

  try {
    if (event.httpMethod === "GET") {
      if (segs.length >= 2) {
        const rec = await s.get(key(segs[0], segs[1]), { type: "json" });
        if (!rec) return { statusCode: 404, body: "Not found" };
        return json(rec);
      }
      // list all open vouchers
      const { blobs } = await s.list();
      const vouchers: VoucherRecord[] = [];
      for (const b of blobs) {
        const rec = (await s.get(b.key, { type: "json" })) as VoucherRecord | null;
        if (rec && !rec.redeemed) vouchers.push(rec);
      }
      vouchers.sort((a, b) => b.createdAt - a.createdAt);
      return json({ vouchers });
    }

    if (event.httpMethod === "POST") {
      const rec = JSON.parse(event.body || "{}") as VoucherRecord;
      if (!rec.collection || !rec.voucher) {
        return { statusCode: 400, body: "Missing collection or voucher" };
      }
      const nonce = String((rec.voucher as { nonce?: string }).nonce ?? "");
      const k = key(rec.collection, nonce);
      const existing = await s.get(k, { type: "json" });
      if (existing) return { statusCode: 409, body: "Voucher already exists" };
      rec.createdAt = Date.now();
      rec.redeemed = false;
      await s.setJSON(k, rec);
      return json({ ok: true });
    }

    if (event.httpMethod === "DELETE") {
      if (segs.length < 2) return { statusCode: 400, body: "Missing key" };
      const k = key(segs[0], segs[1]);
      const rec = (await s.get(k, { type: "json" })) as VoucherRecord | null;
      if (rec) {
        rec.redeemed = true;
        await s.setJSON(k, rec);
      }
      return json({ ok: true });
    }

    return { statusCode: 405, body: "Method not allowed" };
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
};
