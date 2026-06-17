import type { VoucherRecord } from "./types";

const BASE = "/api/vouchers";

/** Store a signed voucher (creator side, after signing). */
export async function saveVoucher(
  record: Omit<VoucherRecord, "createdAt" | "redeemed">
): Promise<void> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`Save voucher failed: ${await res.text()}`);
}

/** List all open (un-redeemed) vouchers for the Explore grid. */
export async function listVouchers(): Promise<VoucherRecord[]> {
  const res = await fetch(BASE);
  if (!res.ok) return [];
  const { vouchers } = (await res.json()) as { vouchers: VoucherRecord[] };
  return vouchers.filter((v) => !v.redeemed);
}

/** Fetch a single voucher by collection + nonce. */
export async function getVoucher(
  collection: string,
  nonce: string
): Promise<VoucherRecord | null> {
  const res = await fetch(`${BASE}/${collection}/${nonce}`);
  if (!res.ok) return null;
  return (await res.json()) as VoucherRecord;
}

/** Mark a voucher redeemed after a successful buyLazy (best-effort). */
export async function markRedeemed(
  collection: string,
  nonce: string
): Promise<void> {
  await fetch(`${BASE}/${collection}/${nonce}`, { method: "DELETE" }).catch(
    () => {}
  );
}
