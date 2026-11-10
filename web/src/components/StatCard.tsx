import type { ComponentType, SVGProps } from "react";
import { cn } from "../lib/cn";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: IconComponent;
  tone?: "default" | "accent" | "success" | "warning";
}

const TONES = {
  default: "bg-surface-hover text-ink-muted",
  accent: "bg-linear-to-br from-accent-soft to-accent-2-soft text-accent-text",
  success: "bg-status-applied-soft text-status-applied",
  warning: "bg-status-scored-low-soft text-status-scored-low",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-sm">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-accent/70 via-accent-2/70 to-accent-3/70"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-subtle">{label}</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-ink tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            TONES[tone],
          )}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {hint && <p className="mt-2 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
