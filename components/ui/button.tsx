"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-tight transition-all duration-150 active:translate-y-px focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background hover:bg-foreground/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]",
        signal:
          "bg-signal text-black hover:bg-signal-strong shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_0_0_1px_rgba(45,212,241,0.4),0_0_18px_-6px_rgba(45,212,241,0.55)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_0_0_1px_rgba(45,212,241,0.55),0_0_28px_-4px_rgba(45,212,241,0.8)]",
        outline:
          "border border-border-strong bg-transparent text-foreground hover:border-border-bright hover:bg-surface-2",
        ghost:
          "bg-transparent text-muted-strong hover:bg-surface-2 hover:text-foreground",
        danger:
          "bg-bad text-white hover:bg-bad/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]",
        subtle:
          "bg-surface-2 text-foreground border border-border hover:bg-surface-3 hover:border-border-bright",
      },
      size: {
        sm: "h-8 px-3 text-[12px]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-9 w-9",
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
