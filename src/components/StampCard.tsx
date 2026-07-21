import { motion } from "framer-motion";
import { Scissors, Coffee, Sparkles, Star, Heart, Flame, Cookie, Wine, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Reward = { step: number; label: string };
export type CardShape = "rounded" | "square" | "ticket";
export type StampIconName = "scissors" | "coffee" | "sparkles" | "star" | "heart" | "flame" | "cookie" | "wine";
export type StepSize = "small" | "medium" | "large";
export type CardFace = "info" | "stamps";

export const STAMP_ICONS: Record<StampIconName, LucideIcon> = {
  scissors: Scissors, coffee: Coffee, sparkles: Sparkles, star: Star,
  heart: Heart, flame: Flame, cookie: Cookie, wine: Wine,
};

const SIZE: Record<StepSize, { tile: string; text: string; gap: string }> = {
  small:  { tile: "h-6 w-6 sm:h-7 sm:w-7",   text: "text-[9px] sm:text-[10px]", gap: "gap-1 sm:gap-1.5" },
  medium: { tile: "h-7 w-7 sm:h-9 sm:w-9",   text: "text-[10px] sm:text-xs",    gap: "gap-1.5 sm:gap-2" },
  large:  { tile: "h-9 w-9 sm:h-11 sm:w-11", text: "text-xs sm:text-sm",        gap: "gap-2 sm:gap-2.5" },
};

export interface StampCardProps {
  title: string;
  subtitle?: string | null;
  description?: string | null;
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
  stepSize?: StepSize;
  face?: CardFace;
  onStepClick?: (step: number) => void;
  activeStep?: number;
  onTitleClick?: () => void;
  onSubtitleClick?: () => void;
  onDescriptionClick?: () => void;
  onIconClick?: () => void;
  disableShadow?: boolean;
  showFlipButton?: boolean;
  onFlip?: () => void;
}

export function StampCard({
  title, subtitle, description, totalSteps, stampsCount = 0, shape = "rounded",
  bgColor = "#faf8f2", accentColor = "#4b3a35", textColor = "#4b3a35",
  stampIcon = null, logoUrl, rewards = [], lastStamp,
  hideSteps = false, stepSize = "medium", face = "stamps",
  onStepClick, activeStep,
  onTitleClick, onSubtitleClick, onDescriptionClick, onIconClick,
  disableShadow = false,
  showFlipButton = false,
  onFlip,
}: StampCardProps) {
  const Icon = stampIcon ? (STAMP_ICONS[stampIcon] ?? Star) : null;
  const radius = shape === "square" ? "rounded-xl" : shape === "ticket" ? "rounded-none" : "rounded-2xl";
  const normalizedSteps = Math.max(0, totalSteps);
  const cols = Math.max(1, Math.min(8, normalizedSteps || 1));
  const rows = normalizedSteps > 0 ? Math.ceil(normalizedSteps / cols) : 0;
  void stepSize; void SIZE;

  const editable = "rounded-md transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 cursor-pointer";

  // Credit-card aspect ratio (1.586:1)
  const heightCls = "aspect-[1.586/1]";

  const InfoFace = (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center text-center px-5 py-4 gap-2"
      style={{ color: textColor }}
    >
      {(() => {
        const inner = logoUrl ? (
          <img src={logoUrl} alt="" className="h-14 w-14 sm:h-16 sm:w-16 object-contain" />
        ) : Icon ? (
          <Icon className="h-10 w-10 sm:h-12 sm:w-12" style={{ color: accentColor }} />
        ) : (
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2" style={{ borderColor: accentColor }} />
        );
        return onIconClick ? (
          <button type="button" onClick={onIconClick} className="rounded-full hover:ring-2 hover:ring-black/20 transition p-1" aria-label="Change logo or icon">
            {inner}
          </button>
        ) : (
          <div className="p-1">{inner}</div>
        );
      })()}
      {onTitleClick ? (
        <button
          type="button"
          onClick={onTitleClick}
          className={`${editable} font-display font-bold tracking-widest text-lg sm:text-xl leading-tight break-words max-w-full`}
          style={{ color: accentColor }}
        >
          {title}
        </button>
      ) : (
        <div className="font-display font-bold tracking-widest text-lg sm:text-xl leading-tight break-words" style={{ color: accentColor }}>
          {title}
        </div>
      )}
      {(subtitle || onSubtitleClick) && (
        onSubtitleClick ? (
          <button type="button" onClick={onSubtitleClick} className={`${editable} text-xs sm:text-sm font-medium opacity-80 break-words max-w-full px-1`}>
            {subtitle || "Add subtitle"}
          </button>
        ) : subtitle ? (
          <div className="text-xs sm:text-sm font-medium opacity-80 break-words">{subtitle}</div>
        ) : null
      )}
      {(description || onDescriptionClick) && (
        onDescriptionClick ? (
          <button type="button" onClick={onDescriptionClick} className={`${editable} text-[11px] sm:text-xs opacity-70 break-words max-w-full px-1 leading-snug`}>
            {description || "Add description"}
          </button>
        ) : description ? (
          <div className="text-[11px] sm:text-xs opacity-70 break-words leading-snug">{description}</div>
        ) : null
      )}
    </div>
  );

  const StampsFace = (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      {hideSteps ? (
        <div className="min-h-[80px]" />
      ) : normalizedSteps > 0 ? (
        <div
          className="grid gap-[3%]"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, calc((100% - 9%) / 4)))`,
            justifyContent: "center",
            aspectRatio: `${cols} / ${rows}`,
            width: "100%",
            maxHeight: "100%",
            maxWidth: "100%",
            containerType: "inline-size",
          }}
        >
          {Array.from({ length: normalizedSteps }).map((_, i) => {
            const step = i + 1;
            const filled = step <= stampsCount;
            const reward = rewards.find((r) => r.step === step);
            const isLast = filled && step === stampsCount && lastStamp !== undefined;
            const isActive = activeStep === step;
            const clickable = !!onStepClick;

            const commonStyle = {
              borderColor: accentColor,
              backgroundColor: filled ? accentColor : "transparent",
              color: filled ? bgColor : accentColor,
              boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined,
            } as const;

            const tileBase = "aspect-square w-full rounded-full border-2 flex items-center justify-center";
            const rewardTile = "aspect-square w-full flex items-center justify-center";

            const rewardLabel = (
              <span
                className="font-bold uppercase text-center leading-none px-0.5"
                style={{ color: accentColor, fontSize: "clamp(7px, 3.2cqi, 13px)", lineHeight: 1 }}
              >
                {reward?.label}
              </span>
            );
            const numberLabel = (
              <span className="font-bold" style={{ fontSize: "clamp(8px, 3.8cqi, 16px)" }}>
                {step}
              </span>
            );

            if (reward) {
              if (clickable) {
                return (
                  <motion.button key={i} type="button" onClick={() => onStepClick!(step)}
                    whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.95 }}
                    className={`${rewardTile} cursor-pointer bg-transparent border-0`}
                    aria-label={`Edit reward on step ${step}`}>
                    {rewardLabel}
                  </motion.button>
                );
              }
              return (
                <motion.div key={isLast ? `stamp-${lastStamp}` : `slot-${i}`}
                  initial={isLast ? { scale: 3, rotate: -18, opacity: 0 } : false}
                  animate={isLast ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
                  transition={{ type: "spring", stiffness: 260, damping: 14 }}
                  className={rewardTile}>
                  {rewardLabel}
                </motion.div>
              );
            }

            if (clickable) {
              return (
                <motion.button key={i} type="button" onClick={() => onStepClick!(step)}
                  animate={!filled ? { boxShadow: [`0 0 0 0px ${accentColor}66`, `0 0 0 6px ${accentColor}00`, `0 0 0 0px ${accentColor}66`] } : undefined}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.95 }}
                  className={`${tileBase} cursor-pointer`}
                  style={commonStyle} aria-label={`Edit step ${step}`}>
                  {numberLabel}
                </motion.button>
              );
            }

            return (
              <motion.div key={isLast ? `stamp-${lastStamp}` : `slot-${i}`}
                initial={isLast ? { scale: 3, rotate: -18, opacity: 0 } : false}
                animate={isLast ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
                transition={{ type: "spring", stiffness: 260, damping: 14 }}
                className={`${tileBase} ${filled ? "stamp-emboss" : ""}`}
                style={commonStyle}>
                {numberLabel}
              </motion.div>
            );
          })}
        </div>
      ) : null}
    </div>
  );


  return (
    <div
      className={`relative w-full ${heightCls}`}
      style={{ perspective: "1200px" }}
    >
      {showFlipButton && onFlip && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFlip();
          }}
          className="absolute top-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 backdrop-blur shadow-sm opacity-70 hover:opacity-100 hover:bg-background transition"
          aria-label="Flip card"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: face === "stamps" ? 180 : 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className={`absolute inset-0 paper-grain ${disableShadow ? "" : "card-shadow"} ${radius} overflow-hidden`}
          style={{ backgroundColor: bgColor, color: textColor, backfaceVisibility: "hidden" }}
        >
          {InfoFace}
        </div>
        <div
          className={`absolute inset-0 paper-grain ${disableShadow ? "" : "card-shadow"} ${radius} overflow-hidden`}
          style={{
            backgroundColor: bgColor,
            color: textColor,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {StampsFace}
        </div>
      </motion.div>
    </div>
  );
}
