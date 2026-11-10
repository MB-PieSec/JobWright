import type { SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { ChevronDownIcon } from "./icons";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-10 w-full appearance-none rounded-lg border border-line-strong bg-surface py-0 ps-3 pe-8 text-sm text-ink shadow-sm focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors motion-safe:duration-150 md:h-9 dark:[color-scheme:dark]"
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute inset-y-0 end-2.5 my-auto h-4 w-4 text-ink-subtle" />
    </div>
  );
}
