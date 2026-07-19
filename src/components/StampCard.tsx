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
  bgColor = "#faf8f2", accentColor = "#4b3a35", textColor = "#4b3a35",
  stampIcon = null, logoUrl, rewards = [], businessName, lastStamp,
  hideSteps = false, onStepClick, activeStep,
  onTitleClick, onSubtitleClick, onIconClick,
  disableShadow = false,
}: StampCardProps) {
  const Icon = stampIcon ? (STAMP_ICONS[stampIcon] ?? Star) : null;
  const radius = shape === "square" ? "rounded-xl" : shape === "ticket" ? "rounded-none" : "rounded-2xl";

  const normalizedSteps = Math.max(0, totalSteps);

  // Max 8 steps per row; card grows vertically as needed
  const cols = Math.max(1, Math.min(8, normalizedSteps || 1));
  const rows = normalizedSteps > 0 ? Math.ceil(normalizedSteps / cols) : 0;


  const editable = "rounded-md transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 cursor-pointer";

  return (
    <div
      className={`relative w-full paper-grain ${disableShadow ? "" : "card-shadow"} ${radius} overflow-hidden min-h-[124px] sm:min-h-[172px]`}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* TOP — centered title above the steps */}
      <div className="w-full text-center pt-3 sm:pt-4 pb-1 px-4">
        {onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            className={`${editable} font-display font-bold tracking-widest text-sm sm:text-base leading-tight break-words`}
            style={{ color: accentColor }}
          >
            {title}
          </button>
        ) : (
          <div
            className="font-display font-bold tracking-widest text-sm sm:text-base leading-tight break-words"
            style={{ color: accentColor }}
          >
            {title}
          </div>
        )}
      </div>

      <div className="flex">
        {/* LEFT — compact info panel */}
        <div
          className="flex flex-col items-center justify-center gap-2 py-3 px-2 sm:py-4 sm:px-3 shrink-0"
          style={{ width: "22%", minWidth: 70, maxWidth: 120 }}
        >
          {subtitle ? (
            onSubtitleClick ? (
              <button
                type="button"
                onClick={onSubtitleClick}
                className={`${editable} text-center font-medium leading-tight break-words w-full px-1`}
                style={{ color: textColor, fontSize: "clamp(9px, 2.5vw, 12px)" }}
              >
                {subtitle}
              </button>
            ) : (
              <div
                className="text-center font-medium leading-tight break-words w-full px-1"
                style={{ color: textColor, fontSize: "clamp(9px, 2.5vw, 12px)" }}
              >
                {subtitle}
              </div>
            )
          ) : null}
          {(() => {
            const inner = logoUrl ? (
              <img src={logoUrl} alt="" className="h-6 w-6 sm:h-8 sm:w-8 object-contain" />
            ) : Icon ? (
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: accentColor }} />
            ) : (
              <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full border-2" style={{ borderColor: accentColor }} />
            );
            return onIconClick ? (
              <button type="button" onClick={onIconClick} className="rounded-full hover:ring-2 hover:ring-black/20 transition p-1" aria-label="Change logo or icon">
                {inner}
              </button>
            ) : (
              <div className="p-1">{inner}</div>
            );
          })()}
        </div>

        {/* RIGHT — stamps grid */}
        <div className="flex-1 flex flex-col justify-center items-center p-3 sm:p-4 min-w-0">
          {hideSteps ? (
            <div className="min-h-[60px]" />
          ) : (
            <div
              className="grid gap-2 sm:gap-2.5 content-center justify-items-center mx-auto"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, auto))`,
                gridTemplateRows: rows > 0 ? `repeat(${rows}, auto)` : undefined,
              }}
            >
              {Array.from({ length: normalizedSteps }).map((_, i) => {
                const step = i + 1;
                const filled = step <= stampsCount;
                const reward = rewards.find((r) => r.step === step);
                const isLast = filled && step === stampsCount && lastStamp !== undefined;
                const isActive = activeStep === step;
                const clickable = !!onStepClick;

                const stepBox = "h-7 w-7 sm:h-10 sm:w-10";
                const commonStyle = {
                  borderColor: accentColor,
                  backgroundColor: filled ? accentColor : "transparent",
                  color: filled ? bgColor : accentColor,
                  boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined,
                } as const;

                const rewardLabel = reward ? (
                  <span className="font-bold uppercase text-center px-0.5 leading-none" style={{ fontSize: "7px", lineHeight: 1 }}>
                    {reward.label}
                  </span>
                ) : null;

                const numberLabel = <span className="font-bold text-[10px] sm:text-xs">{step}</span>;

                if (reward) {
                  if (clickable) {
                    return (
                      <motion.button
                        key={i}
                        type="button"
                        onClick={() => onStepClick!(step)}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.95 }}
                        className={`${stepBox} flex items-center justify-center cursor-pointer bg-transparent border-0`}
                        style={{ color: accentColor }}
                        aria-label={`Edit reward on step ${step}`}
                      >
                        {rewardLabel}
                      </motion.button>
                    );
                  }
                  return (
                    <motion.div
                      key={isLast ? `stamp-${lastStamp}` : `slot-${i}`}
                      initial={isLast ? { scale: 3, rotate: -18, opacity: 0 } : false}
                      animate={isLast ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className={`${stepBox} flex items-center justify-center`}
                      style={{ color: accentColor }}
                    >
                      {rewardLabel}
                    </motion.div>
                  );
                }

                if (clickable) {
                  return (
                    <motion.button
                      key={i}
                      type="button"
                      onClick={() => onStepClick!(step)}
                      animate={!filled ? { boxShadow: [`0 0 0 0px ${accentColor}66`, `0 0 0 6px ${accentColor}00`, `0 0 0 0px ${accentColor}66`] } : undefined}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.95 }}
                      className={`${stepBox} rounded-full border-2 flex items-center justify-center cursor-pointer`}
                      style={commonStyle}
                      aria-label={`Edit step ${step}`}
                    >
                      {numberLabel}
                    </motion.button>
                  );
                }

                return (
                  <motion.div
                    key={isLast ? `stamp-${lastStamp}` : `slot-${i}`}
                    initial={isLast ? { scale: 3, rotate: -18, opacity: 0 } : false}
                    animate={isLast ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
                    transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    className={`${stepBox} rounded-full border-2 flex items-center justify-center ${filled ? "stamp-emboss" : ""}`}
                    style={commonStyle}
                  >
                    {numberLabel}
                  </motion.div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
