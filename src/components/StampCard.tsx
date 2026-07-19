import { motion } from "framer-motion";
import { Scissors, Coffee, Sparkles, Star, Heart, Flame, Cookie, Wine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

const REF_WIDTH = 360; // reference card width in px used for scaling

export function StampCard({
  title, subtitle, totalSteps, stampsCount = 0, shape = "rounded",
  stampShape = "circle", bgColor = "#faf8f2", accentColor = "#1a1a2e", textColor = "#1a1a2e",
  stampIcon = "star", logoUrl, rewards = [], businessName, lastStamp,
  hideSteps = false, onStepClick, activeStep,
  onTitleClick, onSubtitleClick, onIconClick,
  disableShadow = false,
}: StampCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(REF_WIDTH);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = cardRef.current;
    if (!el) return;
    const update = () => setCardWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.max(0.62, Math.min(1.25, cardWidth / REF_WIDTH));

  const Icon = stampIcon ? (STAMP_ICONS[stampIcon] ?? Star) : null;
  const radius = shape === "square" ? "rounded-lg" : shape === "ticket" ? "rounded-none" : "rounded-3xl";

  // Limit max steps to 30
  const normalizedSteps = Math.min(30, totalSteps);

  // Row can contain max 8 steps
  const colsPerRow = Math.min(8, normalizedSteps);
  const cols = Math.max(1, colsPerRow);

  // Dynamic sizes based on actual card width
  const paddingX = Math.round(20 * scale);
  const paddingY = Math.round(16 * scale);
  const gap = Math.round(8 * scale);
  const titleSize = Math.round(20 * scale);
  const subtitleSize = Math.round(12 * scale);
  const iconBox = Math.round(40 * scale);
  const iconSize = Math.round(18 * scale);
  const stepIconSize = Math.round(16 * scale);
  const stepFont = Math.round(11 * scale);
  const rewardFont = Math.round(12 * scale);

  // Compute max step diameter so steps stay proportional to the card width
  const availableWidth = cardWidth - paddingX * 2;
  const cellWidth = (availableWidth - gap * (cols - 1)) / cols;
  const stepMax = Math.max(20, Math.min(cellWidth, 54 * scale));

  // Get shape class for stamp items
  const getStampShapeClass = () => {
    switch (stampShape) {
      case "square": return "rounded-lg";
      case "diamond": return "rounded-none" + " transform -rotate-45";
      case "heart": return "rounded-full";
      default: return "rounded-full";
    }
  };

  const stampShapeClass = getStampShapeClass();

  const editableClass = "rounded-md transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 cursor-pointer px-1 -mx-1";

  return (
    <div
      ref={cardRef}
      className={`relative w-full paper-grain border-2 ${disableShadow ? "" : "card-shadow"} ${radius}`}
      style={{ backgroundColor: bgColor, borderColor: accentColor + "22", color: textColor, aspectRatio: "1.586 / 1" }}
    >
      <div className="flex h-full flex-col" style={{ padding: `${paddingY}px ${paddingX}px` }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {onTitleClick ? (
              <button type="button" onClick={onTitleClick}
                className={`font-display leading-tight truncate block max-w-full text-left ${editableClass}`}
                style={{ color: accentColor, fontSize: titleSize }}>{title}</button>
            ) : (
              <div className="font-display leading-tight truncate" style={{ color: accentColor, fontSize: titleSize }}>{title}</div>
            )}
            {onSubtitleClick ? (
              <button type="button" onClick={onSubtitleClick}
                className={`opacity-70 truncate block max-w-full text-left ${editableClass}`}
                style={{ fontSize: subtitleSize }}>
                {subtitle || <span className="italic opacity-60">Add subtitle</span>}
              </button>
            ) : subtitle ? (
              <div className="opacity-70 truncate" style={{ fontSize: subtitleSize }}>{subtitle}</div>
            ) : null}
          </div>
          {(() => {
            const inner = logoUrl ? (
              <img src={logoUrl} alt="" className="rounded-full object-cover ring-1 ring-black/10 bg-white" style={{ width: iconBox, height: iconBox }} />
            ) : (
              <div className="rounded-full flex items-center justify-center" style={{ width: iconBox, height: iconBox, backgroundColor: accentColor + "11", color: accentColor }}>
                {Icon && <Icon style={{ width: iconSize, height: iconSize }} />}
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
          <div className="flex-1 grid items-center" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap, marginTop: Math.round(8 * scale) }}>
            {Array.from({ length: normalizedSteps }).map((_, i) => {
              const step = i + 1;
              const filled = step <= stampsCount;
              const reward = rewards.find((r) => r.step === step);
              const isLast = filled && step === stampsCount && lastStamp !== undefined;
              const isActive = activeStep === step;
              const clickable = !!onStepClick;
              const commonStyle = {
                borderColor: accentColor + (filled ? "" : isActive ? "" : "55"),
                backgroundColor: filled ? accentColor : "transparent",
                color: filled ? bgColor : accentColor,
                boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined,
                width: stepMax,
                height: stepMax,
                fontSize: reward ? rewardFont : stepFont,
              } as const;

              // Use circle shape for steps with rewards, use selected shape otherwise
              const shapeForStep = reward ? "circle" : stampShape;

              const inner = filled && Icon
                ? <Icon style={{ width: stepIconSize, height: stepIconSize }} />
                : reward
                  ? <span className="leading-none font-bold">{reward.label}</span>
                  : <span className="opacity-60 font-semibold">{step}</span>;

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
                        className={`relative aspect-square border-2 border-dashed flex items-center justify-center font-bold cursor-pointer rounded-full ${isActive ? "ring-2" : ""}`}
                        style={{ ...commonStyle, borderColor: accentColor + "88", color: accentColor, boxShadow: isActive ? `0 0 0 2px ${accentColor}` : undefined }}
                        aria-label={`Edit reward on step ${step}`}>
                        {inner}
                      </motion.button>
                    ) : (
                      <div className="relative aspect-square flex items-center justify-center font-bold" style={{ width: stepMax, height: stepMax, color: accentColor, fontSize: rewardFont }}>
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
                      className={`relative aspect-square border-2 flex items-center justify-center font-semibold cursor-pointer ${shapeForStep === "diamond" ? "transform -rotate-45" : shapeForStep === "square" ? "rounded-lg" : "rounded-full"} ${filled ? "stamp-emboss" : ""}`}
                      style={commonStyle}
                      aria-label={`Edit step ${step}`}>
                      {shapeForStep === "diamond" ? <span className="transform rotate-45">{inner}</span> : inner}
                    </motion.button>
                  ) : (
                    <motion.div
                      key={isLast ? `stamp-${lastStamp}` : `slot-${i}`}
                      initial={isLast ? { scale: 3, rotate: -18, opacity: 0 } : false}
                      animate={isLast ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className={`relative aspect-square border-2 flex items-center justify-center font-semibold ${shapeForStep === "diamond" ? "transform -rotate-45" : shapeForStep === "square" ? "rounded-lg" : "rounded-full"} ${filled ? "stamp-emboss" : ""}`}
                      style={commonStyle}
                    >
                      {shapeForStep === "diamond" ? <span className="transform rotate-45">{inner}</span> : inner}
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
