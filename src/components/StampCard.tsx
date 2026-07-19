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
      className={`relative w-full paper-grain ${disableShadow ? "" : "card-shadow"} ${radius} overflow-hidden`}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <div className="flex">
        {/* LEFT — compact info panel */}
        <div
          className="flex flex-col items-center justify-center gap-2 py-3 px-2 sm:py-4 sm:px-3 shrink-0"
          style={{ width: "22%", minWidth: 70, maxWidth: 120 }}
        >
          {onTitleClick ? (
            <button
              type="button"
              onClick={onTitleClick}
              className={`${editable} text-center font-display font-bold tracking-widest text-[11px] sm:text-sm leading-tight break-words w-full px-1`}
              style={{ color: accentColor }}
            >
              {title}
            </button>
          ) : (
            <div
              className="text-center font-display font-bold tracking-widest text-[11px] sm:text-sm leading-tight break-words w-full px-1"
              style={{ color: accentColor }}
            >
              {title}
            </div>
          )}
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

        {/* RIGHT — stamps + brand */}
        <div className="flex-1 flex flex-col justify-between p-3 sm:p-4 min-w-0">
          {hideSteps ? (
            <div className="min-h-[60px]" />
          ) : (
            <div
              className="grid gap-2 sm:gap-2.5 content-start justify-items-center mx-auto"
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

                const stepBox = "h-6 w-6 sm:h-9 sm:w-9";
                const commonStyle = {
                  borderColor: accentColor,
                  backgroundColor: filled ? accentColor : "transparent",
                  color: filled ? bgColor : accentColor,
                  boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined,
                } as const;

                const content = reward ? (
                  <span className="font-bold uppercase text-center px-0.5 leading-none" style={{ fontSize: "7px", lineHeight: 1 }}>
                    {reward.label}
                  </span>
                ) : (
                  <span className="font-bold text-[10px] sm:text-xs">{step}</span>
                );

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
                      className={`${stepBox} rounded-full border-2 flex items-center justify-center cursor-pointer ${reward ? "border-dashed" : ""}`}
                      style={commonStyle}
                      aria-label={reward ? `Edit reward on step ${step}` : `Edit step ${step}`}
                    >
                      {content}
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
                    {content}
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
