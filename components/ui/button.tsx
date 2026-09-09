"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "button-motion inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-medium disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background hover:bg-foreground-dim",
        // Camel-yellow paint with Williams-navy lettering — the hero CTA in both modes.
        signal:
          "signal-sheen relative overflow-hidden bg-wm-yellow text-wm-navy hover:bg-[#f2c200] active:bg-[#e6b800]",
        outline:
          "border-border bg-transparent text-foreground hover:border-border-strong hover:bg-surface-2",
        ghost:
          "bg-transparent text-muted-strong hover:bg-surface-2 hover:text-foreground",
        danger:
          "bg-bad text-white hover:bg-bad/85",
        subtle:
          "bg-surface-2 text-foreground hover:bg-surface-3",
      },
      size: {
        sm: "h-8 px-3 text-xs",
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
