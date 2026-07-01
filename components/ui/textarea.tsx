import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[88px] w-full rounded-lg border-0 bg-background-tint px-3.5 py-2.5 text-sm font-medium text-foreground shadow-[var(--clay-inset)] placeholder:font-normal placeholder:text-muted transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
