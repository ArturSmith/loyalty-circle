import { cn } from "@/lib/utils";

/**
 * The one loading indicator for the whole app: a circular blue arc that spins.
 *
 * Drawn as an SVG rather than a bordered div so the stroke stays perfectly
 * round at every size, and coloured with `currentColor` so callers can recolour
 * it (e.g. inside a filled button) without a second component.
 */
export function Spinner({
  className,
  size = 32,
  label = "Loading",
}: {
  className?: string;
  /** Diameter in px. */
  size?: number;
  /** Announced to screen readers. Pass null inside a control that already has a label. */
  label?: string | null;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={label ? "status" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      // motion-safe: users with "reduce motion" get a static ring instead of a
      // spinning one, which can trigger vestibular discomfort.
      className={cn("motion-safe:animate-spin text-primary", className)}
    >
      {/* Faint full circle so the arc reads as travelling around a track. */}
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
      {/* The moving arc: a quarter of the circumference (2πr ≈ 62.8). */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="47 63"
      />
    </svg>
  );
}

/**
 * Full-page loading state. Centres the spinner in the space the page occupies
 * so every route shows it in the same place.
 *
 * `min-h-[60vh]` (rather than `min-h-screen`) keeps it centred inside a
 * TabScreen, where a sticky header and bottom nav already consume the viewport
 * — using the full height there would push the spinner visually low.
 */
export function PageLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full flex-1 items-center justify-center px-6 py-16 min-h-[60vh]", className)}>
      <Spinner size={36} />
    </div>
  );
}

/**
 * Loading state for a route that renders on its own, outside the tab shell.
 * Centres against the whole viewport.
 */
export function ScreenLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-screen w-full items-center justify-center px-6", className)}>
      <Spinner size={36} />
    </div>
  );
}
