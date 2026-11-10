import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
}

export function Input({ className, leadingIcon, ...props }: InputProps) {
  const control = (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-sm placeholder:text-ink-subtle focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors motion-safe:duration-150 md:h-9 dark:[color-scheme:dark]",
        leadingIcon ? "ps-9" : undefined,
        className,
      )}
      {...props}
    />
  );

  if (!leadingIcon) return control;

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-subtle">
        {leadingIcon}
      </span>
      {control}
    </div>
  );
}
