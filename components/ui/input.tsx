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
      "flex h-11 w-full rounded-md border-0 bg-background-tint px-3.5 py-2 text-sm font-medium text-foreground shadow-[var(--clay-inset)] placeholder:font-normal placeholder:text-muted transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
