import { cn } from "../lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-surface-hover motion-safe:animate-pulse",
        className,
      )}
    />
  );
}

/** Rows sized to match the real table (`h-14`) so nothing shifts on load. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} className="h-14 border-b border-line">
          <td className="px-3">
            <Skeleton className="h-4 w-3/4" />
          </td>
          <td className="px-3">
            <Skeleton className="h-4 w-16" />
          </td>
          <td className="px-3">
            <Skeleton className="h-5 w-24 rounded-full" />
          </td>
          <td className="px-3">
            <div className="flex justify-end">
              <Skeleton className="h-1 w-20" />
            </div>
          </td>
          <td className="px-3">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="px-3">
            <Skeleton className="h-4 w-24" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/** Mobile equivalent of TableSkeleton. */
export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-line bg-surface p-4 shadow-sm"
        >
          <Skeleton className="h-4 w-3/4" />
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-1 w-20" />
          </div>
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
