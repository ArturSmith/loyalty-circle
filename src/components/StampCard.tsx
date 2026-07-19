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
  const stepBox = "h-9 w-9 sm:h-11 sm:w-11";
  const stepTextSize = "text-[11px]";
  const rewardTextSize = "text-xs sm:text-sm";
  const iconSize = "h-4 w-4";

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

        {hideSteps && <div className="flex-1" />}
        {!hideSteps && (
          <div className="flex-1 grid gap-1.5 sm:gap-2 content-start items-center mt-2 min-w-0"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: rows > 0 ? `repeat(${rows}, auto)` : undefined,
            }}>
            {Array.from({ length: normalizedSteps }).map((_, i) => {
              const step = i + 1;
              const filled = step <= stampsCount;
              const reward = rewards.find((r) => r.step === step);
              const isLast = filled && step === stampsCount && lastStamp !== undefined;
              const isActive = activeStep === step;
              const clickable = !!onStepClick;
              const inner = filled && Icon ? <Icon className="h-4 w-4" /> : reward ? <span className="leading-none">{reward.label}</span> : <span className="opacity-60">{step}</span>;
              const slotInner = filled && Icon ? <Icon className={iconSize} /> : <span className={`opacity-60 ${stepTextSize}`}>{step}</span>;
              const commonStyle = {
                borderColor: accentColor + (filled ? "" : isActive ? "" : "55"),
                backgroundColor: filled ? accentColor : "transparent",
                color: filled ? bgColor : accentColor,
                boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined,
              } as const;
              
              // Use circle shape for steps with rewards, use selected shape otherwise
              const shapeForStep = reward ? "circle" : stampShape;
              
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
                        className={`relative aspect-square w-full min-w-0 ${stepSize} border-2 border-dashed flex items-center justify-center ${rewardTextSize} font-bold cursor-pointer rounded-full ${isActive ? "ring-2" : ""}`}
                        style={{ borderColor: accentColor + "88", color: accentColor, boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined }}
                        aria-label={`Edit reward on step ${step}`}>
                        {inner}
                      </motion.button>
                    ) : (
                      <div className={`relative aspect-square w-full min-w-0 flex items-center justify-center ${rewardTextSize} font-bold`} style={{ color: accentColor }}>
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
                      className={`relative aspect-square w-full min-w-0 ${stepSize} border-2 flex items-center justify-center ${stepTextSize} font-semibold cursor-pointer ${shapeForStep === "diamond" ? "transform -rotate-45" : shapeForStep === "square" ? "rounded-lg" : "rounded-full"} ${filled ? "stamp-emboss" : ""}`}
                      style={commonStyle}
                      aria-label={`Edit step ${step}`}>
                      {shapeForStep === "diamond" ? <span className="transform rotate-45">{slotInner}</span> : slotInner}
                    </motion.button>
                  ) : (
                    <motion.div
                      key={isLast ? `stamp-${lastStamp}` : `slot-${i}`}
                      initial={isLast ? { scale: 3, rotate: -18, opacity: 0 } : false}
                      animate={isLast ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className={`relative aspect-square w-full min-w-0 ${stepSize} border-2 flex items-center justify-center ${stepTextSize} font-semibold ${shapeForStep === "diamond" ? "transform -rotate-45" : shapeForStep === "square" ? "rounded-lg" : "rounded-full"} ${filled ? "stamp-emboss" : ""}`}
                      style={commonStyle}
                    >
                      {shapeForStep === "diamond" ? <span className="transform rotate-45">{slotInner}</span> : slotInner}
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
