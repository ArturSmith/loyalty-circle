import { cn } from "@/lib/utils";

export function OrnamentDivider({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 20" className={cn("h-4", className)} aria-hidden preserveAspectRatio="none">
      <line x1="0" y1="10" x2="80" y2="10" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="120" y1="10" x2="200" y2="10" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <g transform="translate(100 10)">
        <path d="M -14 0 C -10 -6, -4 -6, 0 0 C 4 -6, 10 -6, 14 0 C 10 6, 4 6, 0 0 C -4 6, -10 6, -14 0 Z"
              fill="none" stroke="currentColor" strokeWidth="1" opacity="0.7" />
        <circle cx="0" cy="0" r="1.5" fill="currentColor" opacity="0.7" />
      </g>
    </svg>
  );
}
