import { motion } from "framer-motion";
import { Scissors, Coffee, Sparkles, Star, Heart, Flame, Cookie, Wine } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Reward = { step: number; label: string };
export type CardShape = "rounded" | "square" | "ticket";
export type StampIconName = "scissors" | "coffee" | "sparkles" | "star" | "heart" | "flame" | "cookie" | "wine";

export const STAMP_ICONS: Record<StampIconName, LucideIcon> = {
  scissors: Scissors, coffee: Coffee, sparkles: Sparkles, star: Star,
  heart: Heart, flame: Flame, cookie: Cookie, wine: Wine,
};

export interface StampCardProps {
  title: string;
  subtitle?: string | null;
  totalSteps: number;
  stampsCount?: number;
  shape?: CardShape;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
  stampIcon?: StampIconName;
  logoUrl?: string | null;
  rewards?: Reward[];
  businessName?: string;
  interactive?: boolean;
  lastStamp?: number;
  hideSteps?: boolean;
  onStepClick?: (step: number) => void;
  activeStep?: number;
}

export function StampCard({
  title, subtitle, totalSteps, stampsCount = 0, shape = "rounded",
  bgColor = "#faf8f2", accentColor = "#1a1a2e", textColor = "#1a1a2e",
  stampIcon = "star", logoUrl, rewards = [], businessName, lastStamp,
  hideSteps = false, onStepClick, activeStep,
}: StampCardProps) {
  const Icon = STAMP_ICONS[stampIcon] ?? Star;
  const radius = shape === "square" ? "rounded-lg" : shape === "ticket" ? "rounded-none" : "rounded-3xl";

  // grid: 5 cols if 10, else adaptive
  const cols = totalSteps <= 5 ? totalSteps : totalSteps <= 10 ? 5 : totalSteps <= 12 ? 6 : 5;

  return (
    <div
      className={`relative w-full paper-grain card-shadow border-2 ${radius}`}
      style={{ backgroundColor: bgColor, borderColor: accentColor + "22", color: textColor, aspectRatio: "1.586 / 1" }}
    >
      {shape === "ticket" && (
        <>
          <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background" />
          <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background" />
        </>
      )}
      <div className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display text-lg sm:text-xl leading-tight truncate" style={{ color: accentColor }}>{title}</div>
            {subtitle && <div className="text-[11px] sm:text-xs opacity-70 truncate">{subtitle}</div>}
          </div>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-black/10" />
          ) : (
            <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor + "11", color: accentColor }}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        {!hideSteps && (
          <div className="flex-1 grid gap-1.5 sm:gap-2 items-center mt-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: totalSteps }).map((_, i) => {
              const step = i + 1;
              const filled = step <= stampsCount;
              const reward = rewards.find((r) => r.step === step);
              const isLast = filled && step === stampsCount && lastStamp !== undefined;
              const isActive = activeStep === step;
              const clickable = !!onStepClick;
              const inner = filled ? <Icon className="h-4 w-4" /> : reward ? <span className="leading-none">{reward.label}</span> : <span className="opacity-60">{step}</span>;
              const commonStyle = {
                borderColor: accentColor + (filled ? "" : isActive ? "" : "55"),
                backgroundColor: filled ? accentColor : "transparent",
                color: filled ? bgColor : accentColor,
                boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined,
              } as const;
              return (
                <div key={i} className="flex items-center justify-center">
                  {clickable ? (
                    <button type="button" onClick={() => onStepClick!(step)}
                      className={`relative aspect-square w-full max-w-[42px] rounded-full border-2 flex items-center justify-center text-[10px] font-semibold cursor-pointer transition-transform hover:scale-110 ${filled ? "stamp-emboss" : ""}`}
                      style={commonStyle} aria-label={`Edit step ${step}`}>
                      {inner}
                    </button>
                  ) : (
                    <motion.div
                      key={isLast ? `stamp-${lastStamp}` : `slot-${i}`}
                      initial={isLast ? { scale: 3, rotate: -18, opacity: 0 } : false}
                      animate={isLast ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className={`relative aspect-square w-full max-w-[42px] rounded-full border-2 flex items-center justify-center text-[10px] font-semibold ${filled ? "stamp-emboss" : ""}`}
                      style={commonStyle}
                    >
                      {inner}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-end justify-between mt-2">
          <div className="text-[10px] opacity-60 uppercase tracking-widest">{businessName}</div>
          <div className="text-[11px]" style={{ color: accentColor }}>
            {hideSteps ? "" : `${stampsCount}/${totalSteps}`}
          </div>
        </div>
      </div>
    </div>
  );
}
