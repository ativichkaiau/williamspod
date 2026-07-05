"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-tight transition-all duration-150 ease-out active:translate-y-0.5 active:scale-[0.98] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        // Puffy clay: soft top highlight + outer lift; press collapses it.
        default:
          "bg-foreground text-background shadow-[0_10px_20px_-10px_rgba(0,0,0,0.6),inset_0_2px_2px_-1px_rgba(255,255,255,0.25),inset_0_-4px_8px_-4px_rgba(0,0,0,0.35)] hover:brightness-110 active:shadow-[inset_0_2px_5px_0_rgba(0,0,0,0.4)]",
        // Camel-yellow paint with Williams-navy lettering — the hero CTA in both modes.
        signal:
          "bg-wm-yellow text-wm-navy shadow-[0_12px_22px_-10px_rgba(255,204,0,0.55),inset_0_2px_2px_-1px_rgba(255,255,255,0.55),inset_0_-5px_10px_-5px_rgba(0,0,0,0.25)] hover:bg-[#f2c200] hover:shadow-[0_16px_28px_-10px_rgba(255,204,0,0.7),inset_0_2px_3px_-1px_rgba(255,255,255,0.6),inset_0_-5px_10px_-5px_rgba(0,0,0,0.25)] active:shadow-[inset_0_2px_6px_0_rgba(0,0,0,0.3)]",
        outline:
          "bg-surface text-foreground shadow-[var(--clay-chip)] hover:text-foreground hover:brightness-105 active:shadow-[var(--clay-inset)]",
        ghost:
          "bg-transparent text-muted-strong hover:bg-surface-2 hover:text-foreground",
        danger:
          "bg-bad text-white shadow-[0_12px_22px_-10px_rgba(239,83,80,0.55),inset_0_2px_2px_-1px_rgba(255,255,255,0.3),inset_0_-5px_10px_-5px_rgba(0,0,0,0.3)] hover:brightness-110 active:shadow-[inset_0_2px_6px_0_rgba(0,0,0,0.35)]",
        subtle:
          "bg-surface-2 text-foreground shadow-[var(--clay-chip)] hover:brightness-105 active:shadow-[var(--clay-inset)]",
      },
      size: {
        sm: "h-8 rounded-lg px-3 text-[12px]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
