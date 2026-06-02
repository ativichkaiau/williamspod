import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "panel" | "panel-deep" | "flat";

function variantClass(v: CardVariant | undefined) {
  switch (v) {
    case "panel":
      return "panel";
    case "panel-deep":
      return "panel-deep";
    case "flat":
      return "panel-flat";
    case "default":
    default:
      return "rounded-lg border border-border bg-surface text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.025)]";
  }
}

export function Card({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div className={cn(variantClass(variant), "text-foreground", className)} {...props} />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border/80 px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-strong",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-border/80 px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}
