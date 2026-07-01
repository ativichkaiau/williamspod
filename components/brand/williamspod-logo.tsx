import { cn } from "@/lib/utils";

/**
 * Original WilliamsPod brand marks. Motorsport-flavored: bold, angular,
 * forward-leaning geometry. This is our own design — not a reproduction of any
 * existing team's trademarked logo — evoking the general race-livery aesthetic.
 */

/**
 * The "W" mark: an original angular double-chevron with a tall, sharp centre
 * peak and a slight forward rake, cut from clean geometry. Uses currentColor.
 */
export function WilliamsWMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g transform="skewX(-9)">
        {/* Left arm — tapered wedge sweeping down to the first valley */}
        <path d="M26 12 L48 12 L70 104 L52 104 Z" />
        {/* Rising stroke to the tall centre peak */}
        <path d="M52 104 L70 104 L86 40 L74 40 Z" />
        {/* Falling stroke from the centre peak */}
        <path d="M74 40 L86 40 L108 104 L90 104 Z" />
        {/* Right arm — tapered wedge back up to the top */}
        <path d="M90 104 L108 104 L130 12 L112 12 Z" />
      </g>
    </svg>
  );
}

type Size = "sm" | "md" | "lg" | "xl";

const TILE_SIZE: Record<Size, string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-xl",
  lg: "h-12 w-12 rounded-2xl",
  xl: "h-16 w-16 rounded-2xl",
};
const MARK_SIZE: Record<Size, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
};
const WORD_SIZE: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
  xl: "text-3xl",
};

/**
 * A Williams-blue clay tile carrying the white W mark. Reusable app icon.
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
        "relative flex shrink-0 items-center justify-center bg-[#1b3bd6] text-white shadow-[0_10px_20px_-8px_rgba(27,59,214,0.7),inset_0_2px_2px_-1px_rgba(255,255,255,0.5),inset_0_-5px_10px_-5px_rgba(0,0,0,0.35)]",
        TILE_SIZE[size],
        className,
      )}
    >
      <WilliamsWMark className={MARK_SIZE[size]} />
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
}: {
  size?: Size;
  subtitle?: string;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <WilliamsPodMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-black italic tracking-tight text-foreground",
            WORD_SIZE[size],
          )}
        >
          Williams<span className="text-signal">Pod</span>
        </span>
        {subtitle && (
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.28em] text-muted">
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
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-[11px] font-black leading-none text-white shadow-[0_6px_12px_-6px_var(--brand-soft),inset_0_1px_1px_0_rgba(255,255,255,0.4)]">
          V
        </span>
        <span className="text-sm font-black tracking-tight text-foreground">
          VESTRIPPN<span className="text-brand">3.0</span>
        </span>
      </div>
      <div className="h-px w-40 bg-border-strong" />
      <WilliamsPodLogo size="lg" subtitle="Exam Telemetry" />
    </div>
  );
}
