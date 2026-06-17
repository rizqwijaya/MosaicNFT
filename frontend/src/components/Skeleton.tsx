export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** A masonry-shaped grid of skeleton tiles while the subgraph resolves. */
export function CardSkeletonGrid({ count = 8 }: { count?: number }) {
  const heights = [240, 320, 200, 280, 360, 220, 300, 260];
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mb-4 break-inside-avoid">
          <Skeleton
            className="w-full rounded-[var(--radius-card)]"
            // eslint-disable-next-line react/no-unknown-property
          />
          <div
            className="skeleton w-full rounded-[var(--radius-card)]"
            style={{ height: heights[i % heights.length] }}
          />
          <div className="mt-2 space-y-2 px-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
