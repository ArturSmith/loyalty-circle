import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Scissors, Coffee, Sparkles, Star, Heart, Flame, Cookie, Wine } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Reward = { step: number; label: string };
export type StampIconName = "scissors" | "coffee" | "sparkles" | "star" | "heart" | "flame" | "cookie" | "wine";

export const STAMP_ICONS: Record<StampIconName, LucideIcon> = {
  scissors: Scissors, coffee: Coffee, sparkles: Sparkles, star: Star,
  heart: Heart, flame: Flame, cookie: Cookie, wine: Wine,
};

export interface LoyaltyCardProps {
  title: string;
  discountText: string; // e.g., "-50%"
  imageUrl?: string | null;
  totalSteps: number;
  stampsCount?: number;
  accentColor?: string;
  textColor?: string;
  stampIcon?: StampIconName | null;
  rewards?: Reward[];
  lastStamp?: number;
  onStepClick?: (step: number) => void;
  activeStep?: number;
  onTitleClick?: () => void;
  onDiscountClick?: () => void;
  onImageClick?: () => void;
}

export function LoyaltyCard({
  title,
  discountText,
  imageUrl,
  totalSteps,
  stampsCount = 0,
  accentColor = "#1a1a2e",
  textColor = "#1a1a2e",
  stampIcon = "star",
  rewards = [],
  lastStamp,
  onStepClick,
  activeStep,
  onTitleClick,
  onDiscountClick,
  onImageClick,
}: LoyaltyCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const normalizedSteps = Math.max(0, Math.min(20, totalSteps)); // Max 20 steps
  
  const Icon = stampIcon ? (STAMP_ICONS[stampIcon] ?? Star) : null;
  
  // Calculate grid layout: no row limit, fit all steps dynamically
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
  } else {
    cols = Math.ceil(normalizedSteps / 4);
    rows = 4;
  }
  
  // Step circle sizes
  const CIRCLE_SIZE_LARGE = 52;   // px - for 1-2 rows
  const CIRCLE_SIZE_MEDIUM = 40;  // px - for 3-4 rows
  const CIRCLE_SIZE_SMALL = 28;   // px - for 5+ rows
  
  // Determine circle size based on row count
  let circleSize: number;
  if (rows === 1) {
    circleSize = CIRCLE_SIZE_LARGE;
  } else if (rows === 2) {
    circleSize = CIRCLE_SIZE_LARGE;
  } else if (rows === 3) {
    circleSize = CIRCLE_SIZE_MEDIUM;
  } else if (rows === 4) {
    circleSize = CIRCLE_SIZE_MEDIUM;
  } else {
    circleSize = CIRCLE_SIZE_SMALL;
  }
  
  // Adaptive font size based on circle size
  const adaptiveTextSize = circleSize <= 28 ? "text-[9px]" : circleSize <= 40 ? "text-[11px]" : "text-[13px]";
  
  // Adaptive icon size
  const adaptiveIconSize = circleSize <= 28 ? "h-3 w-3" : circleSize <= 40 ? "h-3.5 w-3.5" : "h-4 w-4";
  
  const editableClass = "rounded-md transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 cursor-pointer px-1 -mx-1";

  return (
    <div
      ref={rootRef}
      className="relative w-full bg-amber-50 border-4 rounded-3xl paper-grain"
      style={{ borderColor: accentColor + "33", color: textColor }}
    >
      <div className="flex gap-6 p-6">
        {/* Left Section: Title, Image, Discount */}
        <div className="flex flex-col items-center gap-4 min-w-max">
          {/* Decorative line */}
          <div className="w-24 h-px bg-gray-800" style={{ backgroundColor: accentColor }} />
          
          {/* Title */}
          {onTitleClick ? (
            <button
              type="button"
              onClick={onTitleClick}
              className={`font-bold text-center max-w-xs ${editableClass}`}
              style={{ color: accentColor }}
            >
              <div className="text-xl leading-tight">{title}</div>
            </button>
          ) : (
            <div className="font-bold text-center max-w-xs text-xl leading-tight" style={{ color: accentColor }}>
              {title}
            </div>
          )}
          
          {/* Image */}
          <div
            onClick={onImageClick}
            className={`relative w-32 h-32 rounded-lg overflow-hidden ${onImageClick ? "cursor-pointer hover:ring-2 ring-black/20 transition" : ""}`}
          >
            {imageUrl ? (
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: accentColor + "11" }}
              >
                <span className="text-gray-400 text-sm">No image</span>
              </div>
            )}
          </div>
          
          {/* Decorative line */}
          <div className="w-24 h-px bg-gray-800" style={{ backgroundColor: accentColor }} />
          
          {/* Discount Text */}
          {onDiscountClick ? (
            <button
              type="button"
              onClick={onDiscountClick}
              className={`font-black text-center ${editableClass}`}
              style={{ color: accentColor, fontSize: "2.5rem", lineHeight: 1 }}
            >
              {discountText}
            </button>
          ) : (
            <div
              className="font-black text-center"
              style={{ color: accentColor, fontSize: "2.5rem", lineHeight: 1 }}
            >
              {discountText}
            </div>
          )}
          
          {/* Decorative scissors/cross symbol */}
          <div
            className="text-2xl font-bold"
            style={{ color: accentColor, opacity: 0.6 }}
          >
            ✂
          </div>
        </div>
        
        {/* Vertical Divider */}
        <div className="w-px bg-gray-800" style={{ backgroundColor: accentColor + "33" }} />
        
        {/* Right Section: Steps Grid and Business Name */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Steps Grid */}
          <div
            className="grid gap-3 justify-start"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${circleSize}px)`,
              rowGap: "12px",
              columnGap: "12px",
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
              
              const inner = reward ? (
                <span
                  className={`block text-center font-bold uppercase leading-none tracking-tight whitespace-nowrap overflow-hidden ${adaptiveTextSize}`}
                  title={rewardLabel}
                  style={{ color: "#4B3A12" }}
                >
                  {rewardLabel}
                </span>
              ) : filled && Icon ? (
                <Icon className={adaptiveIconSize} />
              ) : (
                <span style={{ opacity: 0.6 }}>{step}</span>
              );
              
              const commonStyle = {
                borderColor: isRewardStep ? "#D4AF37" : accentColor + (filled ? "" : isActive ? "" : "55"),
                backgroundColor: isRewardStep ? (filled ? "#E6C777" : "#E6C77722") : (filled ? accentColor : "transparent"),
                color: isRewardStep ? "#4B3A12" : (filled ? "#faf8f2" : accentColor),
              } as const;
              
              return (
                <div key={i} className="flex items-center justify-center">
                  {clickable ? (
                    <motion.button
                      type="button"
                      onClick={() => onStepClick!(step)}
                      animate={!filled ? { scale: [1, 1.12, 1] } : undefined}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative rounded-full border-3 flex items-center justify-center font-semibold cursor-pointer ${filled ? "stamp-emboss" : ""}`}
                      style={{
                        ...commonStyle,
                        width: `${circleSize}px`,
                        height: `${circleSize}px`,
                        boxShadow: isActive ? `0 0 0 2px ${isRewardStep ? "#D4AF37" : accentColor}` : undefined,
                      }}
                      aria-label={`Edit step ${step}`}
                    >
                      {inner}
                    </motion.button>
                  ) : (
                    <motion.div
                      key={isLast ? `stamp-${lastStamp}` : `slot-${i}`}
                      initial={isLast ? { scale: 3, rotate: -18, opacity: 0 } : false}
                      animate={isLast ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className={`relative rounded-full border-3 flex items-center justify-center font-semibold ${filled ? "stamp-emboss" : ""}`}
                      style={{
                        ...commonStyle,
                        width: `${circleSize}px`,
                        height: `${circleSize}px`,
                      }}
                    >
                      {inner}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Decorative line */}
          <div className="h-px bg-gray-800 mt-auto" style={{ backgroundColor: accentColor + "33" }} />
          
          {/* Business/Merchant Name Placeholder */}
          <div className="text-center">
            <div className="text-lg font-serif" style={{ color: accentColor, letterSpacing: "0.15em" }}>
              BUSINESS NAME
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
