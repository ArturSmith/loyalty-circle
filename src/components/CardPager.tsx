import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StampCard, type StampCardProps } from "./StampCard";

export function CardPager({
  cards,
  intervalMs = 3500,
}: {
  cards: StampCardProps[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const n = cards.length;

  useEffect(() => {
    if (n <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % n), intervalMs);
    return () => clearInterval(id);
  }, [n, intervalMs]);

  // Each slide takes 70% of the viewport width so the neighbours peek in.
  const slidePct = 70;
  const gapPct = 4;
  const stepPct = slidePct + gapPct;
  // Center the active slide: leading padding = (100 - slidePct) / 2
  const padPct = (100 - slidePct) / 2;

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="overflow-hidden">
        <motion.div
          className="flex items-center"
          style={{ paddingLeft: `${padPct}%`, paddingRight: `${padPct}%`, gap: `${gapPct}%` }}
          animate={{ x: `-${index * stepPct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        >
          {cards.map((card, i) => {
            const isActive = i === index;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className="shrink-0 focus:outline-none"
                style={{ width: `${slidePct}%` }}
                aria-label={`Show ${card.title}`}
              >
                <motion.div
                  animate={{ scale: isActive ? 1 : 0.9, opacity: isActive ? 1 : 0.55 }}
                  transition={{ type: "spring", stiffness: 200, damping: 24 }}
                  className="drop-shadow-xl"
                >
                  <StampCard {...card} />
                </motion.div>
              </button>
            );
          })}
        </motion.div>
      </div>

      <div className="mt-4 flex justify-center gap-1.5">
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to card ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-foreground/70" : "w-1.5 bg-foreground/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
