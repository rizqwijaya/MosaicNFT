import { Link } from "react-router-dom";
import { useMetadata } from "../hooks/useMetadata";
import { ipfsToHttp } from "../lib/ipfs";
import { fmtEth, shortAddr, timeLeft, CURRENCY } from "../lib/format";
import { EthIcon } from "./EthIcon";

export interface TableRow {
  key: string;
  to: string;
  tokenURI?: string | null;
  name: string;
  price?: string | null;
  auctionBid?: string | null;
  auctionEnd?: string | null;
  seller?: string | null;
  createdAt: number;
}

export type SortKey = "price" | "created" | "name";

interface Props {
  rows: TableRow[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}

/** Rarible-style data-dense marketplace table (desktop) + card list (mobile). */
export function StatsTable({ rows, sortKey, sortDir, onSort }: Props) {
  return (
    <div className="panel overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-stone-500">
              <th className="px-5 py-3.5 font-medium">#</th>
              <SortableTh label="Item" active={sortKey === "name"} dir={sortDir} onClick={() => onSort("name")} />
              <SortableTh label="Price" active={sortKey === "price"} dir={sortDir} onClick={() => onSort("price")} className="text-right" />
              <th className="px-5 py-3.5 font-medium">Type</th>
              <th className="px-5 py-3.5 font-medium">Seller</th>
              <SortableTh label="Listed" active={sortKey === "created"} dir={sortDir} onClick={() => onSort("created")} className="text-right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <TableRowView key={r.key} row={r} index={i + 1} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="divide-y divide-white/8 md:hidden">
        {rows.map((r, i) => (
          <MobileRow key={r.key} row={r} index={i + 1} />
        ))}
      </div>
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-5 py-3.5 font-medium ${className}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 transition hover:text-stone-200 ${
          active ? "text-brand-300" : ""
        } ${className.includes("text-right") ? "flex-row-reverse" : ""}`}
      >
        {label}
        <span className="text-[10px]">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function useRowMeta(row: TableRow) {
  const { meta } = useMetadata(row.tokenURI);
  const img = meta?.image ? ipfsToHttp(meta.image) : "";
  const name = meta?.name || row.name || "Untitled";
  const amount = row.price ?? row.auctionBid;
  const isAuction = row.price == null && row.auctionBid != null;
  return { img, name, amount, isAuction };
}

function TableRowView({ row, index }: { row: TableRow; index: number }) {
  const { img, name, amount, isAuction } = useRowMeta(row);

  return (
    <tr className="group border-b border-white/5 transition last:border-0 hover:bg-white/[0.025]">
      <td className="px-5 py-3 text-stone-500">{index}</td>
      <td className="px-5 py-3">
        <Link to={row.to} className="flex items-center gap-3">
          <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-panel-2">
            {img ? (
              <img src={img} alt={name} loading="lazy" className="size-full object-cover" />
            ) : (
              <div className="skeleton size-full" />
            )}
          </div>
          <span className="font-medium text-stone-100 transition group-hover:text-brand-300">
            {name}
          </span>
        </Link>
      </td>
      <td className="px-5 py-3 text-right">
        {amount != null ? (
          <span className="inline-flex items-center justify-end gap-1 font-display font-semibold text-stone-100">
            <EthIcon className="size-3.5 text-stone-400" />
            {fmtEth(amount)}{" "}
            <span className="text-xs font-normal text-stone-500">{CURRENCY}</span>
          </span>
        ) : (
          <span className="text-stone-600">-</span>
        )}
      </td>
      <td className="px-5 py-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isAuction
              ? "bg-iris-500/15 text-iris-400"
              : "bg-brand-500/15 text-brand-300"
          }`}
        >
          {isAuction ? "Auction" : "Fixed"}
        </span>
      </td>
      <td className="px-5 py-3 text-stone-400">
        {row.seller ? shortAddr(row.seller) : "-"}
      </td>
      <td className="px-5 py-3 text-right text-stone-400">
        {isAuction && row.auctionEnd ? timeLeft(row.auctionEnd) : relTime(row.createdAt)}
      </td>
    </tr>
  );
}

function MobileRow({ row, index }: { row: TableRow; index: number }) {
  const { img, name, amount, isAuction } = useRowMeta(row);

  return (
    <Link to={row.to} className="flex items-center gap-3 px-4 py-3">
      <span className="w-5 shrink-0 text-xs text-stone-500">{index}</span>
      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-panel-2">
        {img ? (
          <img src={img} alt={name} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="skeleton size-full" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-stone-100">{name}</div>
        <div className="mt-0.5 text-xs text-stone-500">
          {isAuction ? "Auction" : "Fixed"}
        </div>
      </div>
      {amount != null && (
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1 font-display font-semibold text-brand-400">
            <EthIcon className="size-3" />
            {fmtEth(amount)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-stone-500">{CURRENCY}</div>
        </div>
      )}
    </Link>
  );
}

/** Relative "time ago" from a unix-seconds timestamp. */
function relTime(sec: number): string {
  if (!sec) return "-";
  const diff = Date.now() - sec * 1000;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
