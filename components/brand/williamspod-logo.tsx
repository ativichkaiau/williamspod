import Image from "next/image";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const TILE_SIZE: Record<Size, string> = {
  sm: "h-8 w-8 rounded-[8px]",
  md: "h-10 w-10 rounded-[10px]",
  lg: "h-12 w-12 rounded-[12px]",
  xl: "h-16 w-16 rounded-[16px]",
};
const WORD_SIZE: Record<Size, string> = {
  sm: "text-[15px]",
  md: "text-[19px]",
  lg: "text-2xl",
  xl: "text-3xl",
};

/**
 * The WilliamsPod mark: the Williams "W" on a white app-icon tile. White keeps
 * the navy strokes readable on the navy header. A hairline defines the tile
 * on light backgrounds.
 */
export function WilliamsPodMark({
  size = "md",
  className,
}: {
  size?: Size;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-black/10 bg-white",
        TILE_SIZE[size],
        className,
      )}
    >
      <Image
        src="/williams-logo.png"
        alt="WilliamsPod"
        width={64}
        height={64}
        priority
        className="h-full w-full object-contain p-[13%]"
      />
    </span>
  );
}

/**
 * Full WilliamsPod wordmark lockup: [W tile] WilliamsPod  (+ optional subtitle).
 * "Pod" carries the app signal colour.
 */
export function WilliamsPodLogo({
  size = "md",
  subtitle,
  className,
  wordmarkClassName,
}: {
  size?: Size;
  subtitle?: string;
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <WilliamsPodMark size={size} />
      <span className={cn("flex flex-col leading-none", wordmarkClassName)}>
        <span
          className={cn(
            "font-bold leading-none tracking-tight text-foreground",
            WORD_SIZE[size],
          )}
        >
          Williams
          <span className="race-lean text-signal">Pod</span>
        </span>
        {subtitle && (
          <span className="mt-1.5 whitespace-nowrap text-[10px] font-medium uppercase leading-none tracking-[0.2em] text-muted">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * Vertical co-brand lockup — VESTRIPPN parent over the WilliamsPod branch,
 * split by a hairline. Used on auth screens.
 */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-xs bg-brand text-[10px] font-bold leading-none text-white">
          V
        </span>
        <span className="text-xs font-semibold tracking-tight text-muted-strong">
          VESTRIPPN<span className="text-brand">3.0</span>
        </span>
      </div>
      <div aria-hidden="true" className="livery-stripe h-[2px] w-16" />
      <WilliamsPodLogo size="lg" subtitle="Exam Practice" />
    </div>
  );
}
