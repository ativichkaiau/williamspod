import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
  {
    variants: {
      tone: {
        neutral: "border-border-strong bg-surface-2 text-muted",
        signal: "border-signal/40 bg-signal/10 text-signal",
        good: "border-good/40 bg-good/10 text-good",
        warn: "border-warn/40 bg-warn/10 text-warn",
        bad: "border-bad/40 bg-bad/10 text-bad",
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
