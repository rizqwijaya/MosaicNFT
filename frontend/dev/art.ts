// Deterministic generative mosaic artwork for the demo seed vouchers.
//
// Each piece is a self-contained SVG built from a seeded PRNG, so the same
// nonce always yields the same image. Served as image/svg+xml by the dev
// plugin — no external image host, no network flakiness, OpenSea-style tiles.

// Small, fast, deterministic PRNG (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Curated palettes that sit well next to the coral brand color.
const PALETTES: string[][] = [
  ["#ff6b5c", "#ffa093", "#882c1f", "#1c1917"],
  ["#0ea5e9", "#22d3ee", "#0c4a6e", "#0f172a"],
  ["#a855f7", "#f0abfc", "#581c87", "#1e1b4b"],
  ["#10b981", "#6ee7b7", "#064e3b", "#0c1f1a"],
  ["#f59e0b", "#fcd34d", "#92400e", "#1c1411"],
  ["#ec4899", "#f9a8d4", "#831843", "#1f1018"],
  ["#6366f1", "#a5b4fc", "#312e81", "#11132b"],
  ["#14b8a6", "#5eead4", "#134e4a", "#0b1a18"],
  ["#ef4444", "#fca5a5", "#7f1d1d", "#1a0f0f"],
  ["#eab308", "#fde047", "#854d0e", "#1a160a"],
];

const SIZE = 600;

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

/** Build a deterministic mosaic SVG string for a given nonce (1-based). */
export function mosaicSvg(nonce: number): string {
  const r = rng(nonce * 2654435761);
  const pal = PALETTES[(nonce - 1) % PALETTES.length];
  const [c1, c2, c3, bg] = pal;
  const cells = 6; // 6x6 grid
  const cell = SIZE / cells;

  const shapes: string[] = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (r() < 0.18) continue; // leave some negative space
      const cx = x * cell;
      const cy = y * cell;
      const fill = pick(r, [c1, c2, c3, c1, c2]);
      const op = (0.45 + r() * 0.55).toFixed(2);
      const kind = r();
      if (kind < 0.4) {
        const inset = r() * cell * 0.18;
        shapes.push(
          `<rect x="${(cx + inset).toFixed(1)}" y="${(cy + inset).toFixed(1)}" width="${(cell - inset * 2).toFixed(1)}" height="${(cell - inset * 2).toFixed(1)}" rx="${(r() * 10).toFixed(1)}" fill="${fill}" opacity="${op}"/>`
        );
      } else if (kind < 0.72) {
        const rad = (cell / 2) * (0.55 + r() * 0.4);
        shapes.push(
          `<circle cx="${(cx + cell / 2).toFixed(1)}" cy="${(cy + cell / 2).toFixed(1)}" r="${rad.toFixed(1)}" fill="${fill}" opacity="${op}"/>`
        );
      } else {
        // triangle
        const p = `${cx.toFixed(1)},${(cy + cell).toFixed(1)} ${(cx + cell / 2).toFixed(1)},${cy.toFixed(1)} ${(cx + cell).toFixed(1)},${(cy + cell).toFixed(1)}`;
        shapes.push(`<polygon points="${p}" fill="${fill}" opacity="${op}"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="g${nonce}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="${c3}"/>
    </linearGradient>
    <filter id="b${nonce}"><feGaussianBlur stdDeviation="0.4"/></filter>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g${nonce})"/>
  <g filter="url(#b${nonce})">
    ${shapes.join("\n    ")}
  </g>
</svg>`;
}
