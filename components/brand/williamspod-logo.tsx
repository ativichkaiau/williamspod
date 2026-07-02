import { cn } from "@/lib/utils";

/** Shared Williams family mark used by WilliamsHub and WilliamsPod. */
export function WilliamsWMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 58"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 9 L19 49 L32 26 L45 49 L58 9"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
    </svg>
  );
}

type Size = "sm" | "md" | "lg" | "xl";

const TILE_SIZE: Record<Size, string> = {
  sm: "h-8 w-8 rounded-[8px]",
  md: "h-10 w-10 rounded-[10px]",
  lg: "h-12 w-12 rounded-[12px]",
  xl: "h-16 w-16 rounded-[16px]",
};
const MARK_SIZE: Record<Size, string> = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-7 w-7",
  xl: "h-10 w-10",
};
const WORD_SIZE: Record<Size, string> = {
  sm: "text-[15px]",
  md: "text-[19px]",
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
        "relative flex shrink-0 items-center justify-center bg-[linear-gradient(135deg,#2E5BFF_0%,#0A1A7A_100%)] text-white shadow-[0_8px_18px_-8px_rgba(46,91,255,0.8),inset_0_1px_1px_rgba(255,255,255,0.22)]",
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
            "font-black leading-none text-foreground",
            WORD_SIZE[size],
          )}
        >
          Williams
          <span className="text-[#2E5BFF] dark:text-[#7AA0FF]">Pod</span>
        </span>
        {subtitle && (
          <span className="mt-[5px] whitespace-nowrap text-[8.5px] font-bold uppercase leading-none tracking-[0.36em] text-muted">
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
