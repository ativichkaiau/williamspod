import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-foreground placeholder:font-normal placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
