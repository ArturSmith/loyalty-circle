import { motion } from "framer-motion";
import { Scissors, Coffee, Sparkles, Star, Heart, Flame, Cookie, Wine } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Reward = { step: number; label: string };
export type CardShape = "rounded" | "square" | "ticket";
export type StampShape = "circle" | "square" | "diamond" | "heart";
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
  stampShape?: StampShape;
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
  stampShape = "circle", bgColor = "#faf8f2", accentColor = "#1a1a2e", textColor = "#1a1a2e",
  stampIcon = "star", logoUrl, rewards = [], businessName, lastStamp,
  hideSteps = false, onStepClick, activeStep,
  onTitleClick, onSubtitleClick, onIconClick,
  disableShadow = false,
}: StampCardProps) {
  const Icon = stampIcon ? (STAMP_ICONS[stampIcon] ?? Star) : null;
  const radius = shape === "square" ? "rounded-lg" : shape === "ticket" ? "rounded-none" : "rounded-3xl";
  
  const normalizedSteps = Math.max(0, totalSteps);

  // Row can contain max 8 steps
  const colsPerRow = Math.min(8, normalizedSteps || 1);
  const cols = Math.max(1, colsPerRow);
  const rows = normalizedSteps > 0 ? Math.ceil(normalizedSteps / cols) : 0;

  // Static square step size (does not shrink with more steps — card grows instead)
  const stepBox = "h-7 w-7 sm:h-9 sm:w-9";
  const stepTextSize = "text-[10px]";
  const rewardTextSize = "text-[11px] sm:text-xs";
  const iconSize = "h-3.5 w-3.5";

  const editableClass = "rounded-md transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 cursor-pointer px-1 -mx-1";

  return (
    <div
      className={`relative w-full paper-grain border-2 ${disableShadow ? "" : "card-shadow"} ${radius}`}
      style={{ backgroundColor: bgColor, borderColor: accentColor + "22", color: textColor }}
    >
      <div className="flex flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {onTitleClick ? (
              <button type="button" onClick={onTitleClick}
                className={`font-display text-lg sm:text-xl leading-tight truncate block max-w-full text-left ${editableClass}`}
                style={{ color: accentColor }}>{title}</button>
            ) : (
              <div className="font-display text-lg sm:text-xl leading-tight truncate" style={{ color: accentColor }}>{title}</div>
            )}
            {onSubtitleClick ? (
              <button type="button" onClick={onSubtitleClick}
                className={`text-[11px] sm:text-xs opacity-70 truncate block max-w-full text-left ${editableClass}`}>
                {subtitle || <span className="italic opacity-60">Add subtitle</span>}
              </button>
            ) : subtitle ? (
              <div className="text-[11px] sm:text-xs opacity-70 truncate">{subtitle}</div>
            ) : null}
          </div>
          {(() => {
            const inner = logoUrl ? (
              <img src={logoUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-black/10 bg-white" />
            ) : (
              <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor + "11", color: accentColor }}>
                {Icon && <Icon className="h-4 w-4" />}
              </div>
            );
            return onIconClick ? (
              <button type="button" onClick={onIconClick} className="rounded-full hover:ring-2 hover:ring-black/20 transition" aria-label="Change logo or icon">
                {inner}
              </button>
            ) : inner;
          })()}
        </div>

        {hideSteps && <div className="mt-2" />}
        {!hideSteps && (
          <div className="grid gap-1.5 sm:gap-2 content-start justify-items-center mt-4 min-w-0"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, auto))`,
              gridTemplateRows: rows > 0 ? `repeat(${rows}, auto)` : undefined,
              justifyContent: "center",
            }}>
            {Array.from({ length: normalizedSteps }).map((_, i) => {
              const step = i + 1;
              const filled = step <= stampsCount;
              const reward = rewards.find((r) => r.step === step);
              const isLast = filled && step === stampsCount && lastStamp !== undefined;
              const isActive = activeStep === step;
              const clickable = !!onStepClick;
              const inner = filled && Icon ? <Icon className={iconSize} /> : reward ? <span className="leading-none">{reward.label}</span> : <span className="opacity-60">{step}</span>;
              const slotInner = filled && Icon ? <Icon className={iconSize} /> : <span className={`opacity-60 ${stepTextSize}`}>{step}</span>;
              const commonStyle = {
                borderColor: accentColor + (filled ? "" : isActive ? "" : "55"),
                backgroundColor: filled ? accentColor : "transparent",
                color: filled ? bgColor : accentColor,
                boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined,
              } as const;

              // For reward steps, show label; make clickable during card creation
              if (reward) {
                return (
                  <div key={i} className="flex items-center justify-center">
                    {clickable ? (
                      <motion.button
                        type="button"
                        onClick={() => onStepClick!(step)}
                        whileHover={{ scale: 1.12 }}
                        whileTap={{ scale: 0.95 }}
                        className={`relative ${stepBox} border-2 border-dashed flex items-center justify-center ${rewardTextSize} font-bold cursor-pointer rounded-lg ${isActive ? "ring-2" : ""}`}
                        style={{ borderColor: accentColor + "88", color: accentColor, boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined }}
                        aria-label={`Edit reward on step ${step}`}>
                        {inner}
                      </motion.button>
                    ) : (
                      <div className={`relative ${stepBox} flex items-center justify-center ${rewardTextSize} font-bold`} style={{ color: accentColor }}>
                        {inner}
                      </div>
                    )}
                  </div>
                );
              }

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
                      className={`relative ${stepBox} border-2 flex items-center justify-center ${stepTextSize} font-semibold cursor-pointer rounded-lg ${filled ? "stamp-emboss" : ""}`}
                      style={commonStyle}
                      aria-label={`Edit step ${step}`}>
                      {slotInner}
                    </motion.button>
                  ) : (
                    <motion.div
                      key={isLast ? `stamp-${lastStamp}` : `slot-${i}`}
                      initial={isLast ? { scale: 3, rotate: -18, opacity: 0 } : false}
                      animate={isLast ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className={`relative ${stepBox} border-2 flex items-center justify-center ${stepTextSize} font-semibold rounded-lg ${filled ? "stamp-emboss" : ""}`}
                      style={commonStyle}
                    >
                      {slotInner}
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
