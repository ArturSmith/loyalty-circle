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
}

export function StampCard({
  title, subtitle, totalSteps, stampsCount = 0, shape = "rounded",
  bgColor = "#faf8f2", accentColor = "#1a1a2e", textColor = "#1a1a2e",
  stampIcon = "star", logoUrl, rewards = [], businessName, lastStamp,
  hideSteps = false, onStepClick, activeStep,
  onTitleClick, onSubtitleClick, onIconClick,
  disableShadow = false,
}: StampCardProps) {
  const Icon = stampIcon ? (STAMP_ICONS[stampIcon] ?? Star) : null;
  const radius = shape === "square" ? "rounded-lg" : shape === "ticket" ? "rounded-none" : "rounded-3xl";
  const isDense = totalSteps >= 16;
  const isUltraDense = totalSteps >= 24;

  // adaptive grid to keep rows compact for larger cards
  const colsRaw = totalSteps <= 5 ? totalSteps : totalSteps <= 10 ? 5 : totalSteps <= 15 ? 6 : totalSteps <= 21 ? 7 : 8;
  const cols = Math.max(1, colsRaw);
  const rows = Math.max(1, Math.ceil(totalSteps / cols));
  const cardAspectRatio = "1.586 / 1";
  const cardPadding = isDense ? "p-3 sm:p-4" : "p-4 sm:p-5";
  const stepGapClass = isUltraDense ? "gap-1.5" : isDense ? "gap-1.5 sm:gap-2" : "gap-1.5 sm:gap-2";
  const stepItemPadClass = isUltraDense ? "p-0.5" : isDense ? "p-[3px]" : "p-0.5";
  const stepChipClass = rows >= 5
    ? "max-w-[24px] text-[8px]"
    : rows >= 4
    ? "max-w-[30px] text-[9px]"
    : isDense
    ? "max-w-[36px] text-[9px]"
    : "max-w-[42px] text-[10px]";
  const stampIconClass = isUltraDense ? "h-3 w-3" : "h-4 w-4";

  const editableClass = "rounded-md transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 cursor-pointer px-1 -mx-1";

  return (
    <div
      className={`relative w-full paper-grain border-2 ${disableShadow ? "" : "card-shadow"} ${radius}`}
      style={{ backgroundColor: bgColor, borderColor: accentColor + "22", color: textColor, aspectRatio: cardAspectRatio }}
    >
      <div className={`flex h-full flex-col ${cardPadding}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {onTitleClick ? (
              <button type="button" onClick={onTitleClick}
                className={`font-display ${isDense ? "text-base sm:text-lg" : "text-lg sm:text-xl"} leading-tight truncate block max-w-full text-left ${editableClass}`}
                style={{ color: accentColor }}>{title}</button>
            ) : (
              <div className={`font-display ${isDense ? "text-base sm:text-lg" : "text-lg sm:text-xl"} leading-tight truncate`} style={{ color: accentColor }}>{title}</div>
            )}
            {onSubtitleClick ? (
              <button type="button" onClick={onSubtitleClick}
                className={`${isDense ? "text-[10px]" : "text-[11px] sm:text-xs"} opacity-70 truncate block max-w-full text-left ${editableClass}`}>
                {subtitle || <span className="italic opacity-60">Add subtitle</span>}
              </button>
            ) : subtitle ? (
              <div className={`${isDense ? "text-[10px]" : "text-[11px] sm:text-xs"} opacity-70 truncate`}>{subtitle}</div>
            ) : null}
          </div>
          {(() => {
            const inner = logoUrl ? (
              <img src={logoUrl} alt="" className={`${isDense ? "h-8 w-8" : "h-9 w-9"} rounded-full object-cover ring-1 ring-black/10 bg-white`} />
            ) : (
              <div className={`${isDense ? "h-8 w-8" : "h-9 w-9"} rounded-full flex items-center justify-center`} style={{ backgroundColor: accentColor + "11", color: accentColor }}>
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
          <div className={`flex-1 grid ${stepGapClass} items-center mt-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: totalSteps }).map((_, i) => {
              const step = i + 1;
              const filled = step <= stampsCount;
              const reward = rewards.find((r) => r.step === step);
              const isLast = filled && step === stampsCount && lastStamp !== undefined;
              const isActive = activeStep === step;
              const clickable = !!onStepClick;
              const inner = filled && Icon ? <Icon className={stampIconClass} /> : reward ? <span className="leading-none">{reward.label}</span> : <span className="opacity-60">{step}</span>;
              const commonStyle = {
                borderColor: accentColor + (filled ? "" : isActive ? "" : "55"),
                backgroundColor: filled ? accentColor : "transparent",
                color: filled ? bgColor : accentColor,
                boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined,
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
                      className={`relative aspect-square w-full rounded-full border-2 flex items-center justify-center font-semibold cursor-pointer ${stepChipClass} ${filled ? "stamp-emboss" : ""}`}
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
                      className={`relative aspect-square w-full rounded-full border-2 flex items-center justify-center font-semibold ${stepChipClass} ${filled ? "stamp-emboss" : ""}`}
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
