/** Ethereum diamond logo. Inherits color via currentColor; size via className. */
export function EthIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 417"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M127.96 0 125.16 9.5v275.7l2.8 2.79 127.95-75.64z" opacity="0.6" />
      <path d="M127.96 0 0 212.35l127.96 75.64V154.16z" />
      <path d="m127.96 312.19-1.58 1.92v98.2l1.58 4.61L256 236.59z" opacity="0.6" />
      <path d="M127.96 416.92v-104.73L0 236.59z" />
      <path d="m127.96 287.99 127.95-75.64-127.95-58.19z" opacity="0.2" />
      <path d="M0 212.35l127.96 75.64V154.16z" opacity="0.6" />
    </svg>
  );
}
