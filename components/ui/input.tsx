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
      "flex h-11 w-full rounded-md border border-border bg-background-tint px-3.5 py-2 text-sm font-medium text-foreground placeholder:font-normal placeholder:text-muted transition-colors focus-visible:border-border-bright disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
