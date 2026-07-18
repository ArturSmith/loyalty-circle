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
  const gridRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState<number>(420);
  const [gridHeight, setGridHeight] = useState<number>(0);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setCardWidth(next);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!gridRef.current) return;
    const node = gridRef.current;
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.height;
      if (next) setGridHeight(next);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Icon = stampIcon ? (STAMP_ICONS[stampIcon] ?? Star) : null;
  const radius = shape === "square" ? "rounded-lg" : shape === "ticket" ? "rounded-none" : "rounded-3xl";
  const normalizedSteps = Math.max(0, Math.min(30, totalSteps)); // Max 30 steps
  
  // Step placement: dynamic columns based on step count
  // Prefer to fit steps in fewer rows
  let cols: number;
  let rows: number;
  
  if (normalizedSteps <= 5) {
    cols = normalizedSteps;
    rows = 1;
  } else if (normalizedSteps <= 10) {
    cols = Math.ceil(normalizedSteps / 2);
    rows = 2;
  } else if (normalizedSteps <= 15) {
    cols = Math.ceil(normalizedSteps / 3);
    rows = 3;
  } else if (normalizedSteps <= 20) {
    cols = Math.ceil(normalizedSteps / 4);
    rows = 4;
  } else {
    cols = Math.ceil(normalizedSteps / 5);
    rows = 5;
  }
  
  // Size definitions for step items (square)
  const SIZE_LARGE = 48;   // px - large size
  const SIZE_MEDIUM = 32;  // px - medium size
  const SIZE_SMALL = 20;   // px - small size
  
  const HEADER_HEIGHT = 60; // px (title, subtitle, logo)
  const ROW_GAP = 8; // px between rows
  const COL_GAP = 8; // px between columns
  const GRID_PADDING = 12; // px total padding in grid area
  const BOTTOM_SPACE = 4; // px bottom spacing
  
  // Calculate min height: 2 rows of large items
  const minHeight = HEADER_HEIGHT + GRID_PADDING + 2 * SIZE_LARGE + 1 * ROW_GAP;
  
  // Calculate max height: 6 rows of small items + bottom space
  const maxHeight = HEADER_HEIGHT + GRID_PADDING + 6 * SIZE_SMALL + 5 * ROW_GAP + BOTTOM_SPACE;
  
  // Determine optimal step item size based on row count
  let stepItemSize: number;
  if (rows <= 2) {
    stepItemSize = SIZE_LARGE;
  } else if (rows <= 4) {
    // Linearly interpolate between large and medium
    stepItemSize = SIZE_LARGE - ((rows - 2) / 2) * (SIZE_LARGE - SIZE_MEDIUM);
  } else {
    // Use medium to small range for 5+ rows
    stepItemSize = SIZE_MEDIUM - ((rows - 4) / 2) * (SIZE_MEDIUM - SIZE_SMALL);
    // Ensure minimum size
    stepItemSize = Math.max(SIZE_SMALL, stepItemSize);
  }
  
  const circleSize = stepItemSize;
  
  const isDense = cols >= 7;
  const isUltraDense = cols >= 9;
  const isCompact = cardWidth < 340;
  const isUltraCompact = cardWidth < 300;

  const cardPadding = isUltraCompact
    ? "p-2.5"
    : isCompact
    ? "p-3"
    : isDense
    ? "p-3 sm:p-4"
    : "p-4 sm:p-5";
  
  // Adaptive font size based on step item size
  const adaptiveTextSize = stepItemSize <= 24 ? "text-[6px]" : stepItemSize <= 32 ? "text-[7px]" : stepItemSize <= 40 ? "text-[8px]" : "text-[9px]";
  
  // Adaptive icon size based on step item size
  const adaptiveIconSize = stepItemSize <= 24 ? "h-2.5 w-2.5" : stepItemSize <= 32 ? "h-3 w-3" : stepItemSize <= 40 ? "h-3.5 w-3.5" : "h-4 w-4";
  const stampIconClass = adaptiveIconSize;

  const editableClass = "rounded-md transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 cursor-pointer px-1 -mx-1";

  return (
    <div
      ref={rootRef}
      className={`relative w-full paper-grain border-2 ${disableShadow ? "" : "card-shadow"} ${radius}`}
      style={{ 
        backgroundColor: bgColor, 
        borderColor: accentColor + "22", 
        color: textColor, 
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
        display: 'flex',
        flexDirection: 'column'
      }}
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
          <div 
            ref={gridRef}
            className={`grid items-center justify-center mt-2 flex-1`}
            style={{ 
              gridTemplateColumns: `repeat(${cols}, ${stepItemSize}px)`,
              gap: `${COL_GAP}px`,
              rowGap: `${ROW_GAP}px`,
            }}
          >
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
                <div key={i} className="flex items-center justify-center">
                  {clickable ? (
                    <motion.button
                      type="button"
                      onClick={() => onStepClick!(step)}
                      animate={!filled ? { scale: [1, 1.12, 1], boxShadow: [`0 0 0 0px ${accentColor}66`, `0 0 0 8px ${accentColor}00`, `0 0 0 0px ${accentColor}66`] } : undefined}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative w-full h-full rounded-md border-2 flex items-center justify-center font-semibold cursor-pointer ${adaptiveTextSize} ${filled ? "stamp-emboss" : ""}`}
                      style={{ 
                        ...commonStyle,
                        width: `${stepItemSize}px`, 
                        height: `${stepItemSize}px`
                      }}
                      aria-label={`Edit step ${step}`}>
                      {inner}
                    </motion.button>
                  ) : (
                    <motion.div
                      key={isLast ? `stamp-${lastStamp}` : `slot-${i}`}
                      initial={isLast ? { scale: 3, rotate: -18, opacity: 0 } : false}
                      animate={isLast ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className={`relative w-full h-full rounded-md border-2 flex items-center justify-center font-semibold ${adaptiveTextSize} ${filled ? "stamp-emboss" : ""}`}
                      style={{ 
                        ...commonStyle,
                        width: `${stepItemSize}px`, 
                        height: `${stepItemSize}px`
                      }}
                    >
                      {inner}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
