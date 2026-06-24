import type { ReactNode } from "react";

/** CSS-columns masonry: varied tile heights assemble into a cohesive wall. */
export function Masonry({ children }: { children: ReactNode }) {
  return (
    <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="glass flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-2xl glass-soft text-3xl text-brand-400">
        ⬡
      </div>
      <div className="font-display text-xl font-semibold text-stone-100">
        {title}
      </div>
      {hint && (
        <div className="mt-1.5 max-w-sm text-sm text-stone-400">{hint}</div>
      )}
    </div>
  );
}
