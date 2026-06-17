import { formatEther } from "viem";

/** Display label for the native token (Sepolia testnet ETH). */
export const CURRENCY = "Sepolia ETH";

export function shortAddr(addr?: string | null): string {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export function fmtEth(wei?: string | bigint | null, dp = 4): string {
  if (wei == null) return "0";
  const v = typeof wei === "bigint" ? wei : BigInt(wei);
  const s = formatEther(v);
  const n = Number(s);
  if (n === 0) return "0";
  // trim to dp significant decimals
  return n.toLocaleString(undefined, { maximumFractionDigits: dp });
}

export function timeLeft(endTimeSec: string | number): string {
  const end = Number(endTimeSec) * 1000;
  const diff = end - Date.now();
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function fmtDate(sec: string | number): string {
  return new Date(Number(sec) * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Turn a raw wallet/contract error into a human message. */
export function humanizeError(err: unknown): string {
  const raw =
    (err as { shortMessage?: string; message?: string })?.shortMessage ||
    (err as { message?: string })?.message ||
    String(err);

  const lower = raw.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied"))
    return "You cancelled the transaction.";
  if (lower.includes("insufficient funds"))
    return "Not enough ETH to cover the price plus gas.";
  if (lower.includes("wrongprice")) return "The price doesn't match the listing.";
  if (lower.includes("notlisted")) return "This item is no longer listed.";
  if (lower.includes("selfbuy")) return "You can't buy your own listing.";
  if (lower.includes("bidtoolow")) return "Your bid must beat the current bid.";
  if (lower.includes("auctionended")) return "This auction has already ended.";
  if (lower.includes("auctionnotended"))
    return "The auction hasn't ended yet, can't settle.";
  if (lower.includes("noncealreadyused"))
    return "This lazy-mint voucher was already redeemed.";
  if (lower.includes("invalidsignature"))
    return "The voucher signature is invalid.";
  if (lower.includes("insufficientpayment"))
    return "Payment is below the voucher's minimum price.";
  if (lower.includes("nothingtowithdraw"))
    return "You have no proceeds to withdraw.";
  if (lower.includes("notapproved"))
    return "Approve the marketplace for this collection first.";
  // fall back to the short message, capped
  return raw.length > 140 ? raw.slice(0, 140) + "…" : raw;
}
