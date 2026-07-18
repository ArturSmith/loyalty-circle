import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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
  stampIcon?: StampIconName | null;
  logoUrl?: string | null;
  rewards?: Reward[];
  businessName?: string;
  interactive?: boolean;
  lastStamp?: number;
  hideSteps?: boolean;
  onStepClick?: (step: number) => void;
  activeStep?: number;
  onTitleClick?: () => void;
  onSubtitleClick?: () => void;
  onIconClick?: () => void;
  disableShadow?: boolean;
  adaptiveContent?: boolean;
}

export function StampCard({
  title, subtitle, totalSteps, stampsCount = 0, shape = "rounded",
  bgColor = "#faf8f2", accentColor = "#1a1a2e", textColor = "#1a1a2e",
  stampIcon = "star", logoUrl, rewards = [], businessName, lastStamp,
  hideSteps = false, onStepClick, activeStep,
  onTitleClick, onSubtitleClick, onIconClick,
  disableShadow = false,
  adaptiveContent = false,
}: StampCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState<number>(420);

  useEffect(() => {
    if (!adaptiveContent) return;
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setCardWidth(next);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [adaptiveContent]);

  const Icon = stampIcon ? (STAMP_ICONS[stampIcon] ?? Star) : null;
  const radius = shape === "square" ? "rounded-lg" : shape === "ticket" ? "rounded-none" : "rounded-3xl";
  const maxRows = 3;
  const maxCols = 10;
  const normalizedSteps = Math.max(0, totalSteps);
  // Rule: max 3 rows, each row up to 10 circles
  const cols = Math.max(1, Math.min(maxCols, Math.ceil(normalizedSteps / maxRows)));
  const rows = Math.max(1, Math.ceil(normalizedSteps / cols));
  const isDense = cols >= 7;
  const isUltraDense = cols >= 9;
  const isCompact = adaptiveContent && cardWidth < 340;
  const isUltraCompact = adaptiveContent && cardWidth < 300;

  const cardAspectRatio = "1.586 / 1";
  const cardPadding = isUltraCompact
    ? "p-2.5"
    : isCompact
    ? "p-3"
    : isDense
    ? "p-3 sm:p-4"
    : "p-4 sm:p-5";
  const stepGapClass = isUltraDense ? "gap-1.5" : isDense ? "gap-1.5 sm:gap-2" : "gap-1.5 sm:gap-2";
  const stepItemPadClass = isUltraDense ? "p-0.5" : isDense ? "p-[3px]" : "p-0.5";
  const stepChipClass = cols >= 10
    ? "max-w-[22px] text-[8px]"
    : cols >= 9
    ? "max-w-[24px] text-[8px]"
    : cols >= 8
    ? "max-w-[28px] text-[9px]"
    : cols >= 7
    ? "max-w-[32px] text-[9px]"
    : "max-w-[42px] text-[10px]";
  const compactChipClass = isUltraCompact
    ? "max-w-[18px] text-[7px]"
    : isCompact
    ? "max-w-[22px] text-[8px]"
    : stepChipClass;
  const stampIconClass = isUltraCompact ? "h-2.5 w-2.5" : isCompact || isUltraDense ? "h-3 w-3" : "h-4 w-4";

  const editableClass = "rounded-md transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 cursor-pointer px-1 -mx-1";

  return (
    <div
      ref={rootRef}
      className={`relative w-full paper-grain border-2 ${disableShadow ? "" : "card-shadow"} ${radius}`}
      style={{ backgroundColor: bgColor, borderColor: accentColor + "22", color: textColor, aspectRatio: cardAspectRatio }}
    >
      <div className={`flex h-full flex-col ${cardPadding} overflow-hidden`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {onTitleClick ? (
              <button type="button" onClick={onTitleClick}
                className={`font-display ${isUltraCompact ? "text-sm" : isCompact ? "text-[15px]" : isDense ? "text-base sm:text-lg" : "text-lg sm:text-xl"} leading-tight truncate block max-w-full text-left ${editableClass}`}
                style={{ color: accentColor }}>{title}</button>
            ) : (
              <div className={`font-display ${isUltraCompact ? "text-sm" : isCompact ? "text-[15px]" : isDense ? "text-base sm:text-lg" : "text-lg sm:text-xl"} leading-tight truncate`} style={{ color: accentColor }}>{title}</div>
            )}
            {onSubtitleClick ? (
              <button type="button" onClick={onSubtitleClick}
                className={`${isUltraCompact ? "text-[9px]" : isDense || isCompact ? "text-[10px]" : "text-[11px] sm:text-xs"} opacity-70 truncate block max-w-full text-left ${editableClass}`}>
                {subtitle || <span className="italic opacity-60">Add subtitle</span>}
              </button>
            ) : subtitle ? (
              <div className={`${isUltraCompact ? "text-[9px]" : isDense || isCompact ? "text-[10px]" : "text-[11px] sm:text-xs"} opacity-70 truncate`}>{subtitle}</div>
            ) : null}
          </div>
          {(() => {
            const inner = logoUrl ? (
              <img src={logoUrl} alt="" className={`${isUltraCompact ? "h-6 w-6" : isCompact || isDense ? "h-8 w-8" : "h-9 w-9"} rounded-full object-cover ring-1 ring-black/10 bg-white`} />
            ) : (
              <div className={`${isUltraCompact ? "h-6 w-6" : isCompact || isDense ? "h-8 w-8" : "h-9 w-9"} rounded-full flex items-center justify-center`} style={{ backgroundColor: accentColor + "11", color: accentColor }}>
                {Icon && <Icon className={stampIconClass} />}
              </div>
            );
            return onIconClick ? (
              <button type="button" onClick={onIconClick} className="rounded-full hover:ring-2 hover:ring-black/20 transition" aria-label="Change logo or icon">
                {inner}
              </button>
            ) : inner;
          })()}
        </div>

        {hideSteps && <div className="flex-1" />}
        {!hideSteps && (
          <div className={`flex-1 grid ${stepGapClass} items-center mt-2 min-h-0`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: totalSteps }).map((_, i) => {
              const step = i + 1;
              const filled = step <= stampsCount;
              const reward = rewards.find((r) => r.step === step);
              const isRewardStep = !!reward;
              const isLast = filled && step === stampsCount && lastStamp !== undefined;
              const isActive = activeStep === step;
              const clickable = !!onStepClick;
              const rewardLabel = (reward?.label ?? "").trim();
              const rewardTextSizeClass = rewardLabel.length >= 6
                ? (isUltraCompact ? "text-[5px]" : "text-[6px]")
                : rewardLabel.length >= 4
                ? (isUltraCompact ? "text-[6px]" : "text-[7px]")
                : (isUltraCompact ? "text-[7px]" : "text-[8px]");
              const inner = reward
                ? (
                  <span
                    className={`block max-w-full px-[1px] text-center font-bold uppercase leading-none tracking-tight whitespace-nowrap overflow-hidden ${rewardTextSizeClass}`}
                    title={rewardLabel}
                  >
                    {rewardLabel}
                  </span>
                )
                : filled && Icon
                ? <Icon className={stampIconClass} />
                : <span className="opacity-60">{step}</span>;
              const commonStyle = {
                borderColor: isRewardStep ? "#D4AF37" : accentColor + (filled ? "" : isActive ? "" : "55"),
                backgroundColor: isRewardStep ? (filled ? "#E6C777" : "#E6C77722") : (filled ? accentColor : "transparent"),
                color: isRewardStep ? "#4B3A12" : (filled ? bgColor : accentColor),
                boxShadow: isActive
                  ? `0 0 0 2px ${isRewardStep ? "#D4AF37" : accentColor}`
                  : undefined,
              } as const;
              return (
                <div key={i} className={`flex items-center justify-center ${stepItemPadClass}`}>
                  {clickable ? (
                    <motion.button
                      type="button"
                      onClick={() => onStepClick!(step)}
                      animate={!filled ? { scale: [1, 1.12, 1], boxShadow: [`0 0 0 0px ${accentColor}66`, `0 0 0 8px ${accentColor}00`, `0 0 0 0px ${accentColor}66`] } : undefined}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative aspect-square w-full rounded-full border-2 flex items-center justify-center font-semibold cursor-pointer ${compactChipClass} ${filled ? "stamp-emboss" : ""}`}
                      style={commonStyle}
                      aria-label={`Edit step ${step}`}>
                      {inner}
                    </motion.button>
                  ) : (
                    <motion.div
                      key={isLast ? `stamp-${lastStamp}` : `slot-${i}`}
                      initial={isLast ? { scale: 3, rotate: -18, opacity: 0 } : false}
                      animate={isLast ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className={`relative aspect-square w-full rounded-full border-2 flex items-center justify-center font-semibold ${compactChipClass} ${filled ? "stamp-emboss" : ""}`}
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
          <div className={`${isUltraCompact ? "text-[8px]" : "text-[10px]"} opacity-60 uppercase tracking-widest`}>{businessName}</div>
          <div className={`${isUltraCompact ? "text-[9px]" : "text-[11px]"}`} style={{ color: accentColor }}>
            {hideSteps ? "" : `${stampsCount}/${totalSteps}`}
          </div>
        </div>
      </div>
    </div>
  );
}
