import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em]",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-2 text-muted-strong",
        signal: "border-signal/30 bg-signal-soft text-signal",
        good: "border-good/30 bg-good-soft text-good",
        warn: "border-warn/30 bg-warn-soft text-warn",
        bad: "border-bad/30 bg-bad-soft text-bad",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
