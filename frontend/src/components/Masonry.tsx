import type { ReactNode } from "react";

/** CSS-columns masonry: varied tile heights assemble into a cohesive wall. */
export function Masonry({ children }: { children: ReactNode }) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
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
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-stone-300 py-20 text-center dark:border-stone-700">
      <div className="mb-3 text-4xl text-stone-300 dark:text-stone-600">⬡</div>
      <div className="font-display text-lg font-medium">{title}</div>
      {hint && (
        <div className="mt-1 max-w-sm text-sm text-stone-500 dark:text-stone-400">
          {hint}
        </div>
      )}
    </div>
  );
}
