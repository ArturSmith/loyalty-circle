import { useState } from "react";
import { motion } from "framer-motion";
import { StampCard, type StampCardProps } from "./StampCard";

export function WalletStack({ cards }: { cards: StampCardProps[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const n = cards.length;

  // Reorder so active is on top; others fan below in a stack.
  const order = Array.from({ length: n }, (_, i) => (activeIdx + i) % n);

  return (
    <div
      className="relative mx-auto w-full max-w-sm select-none"
      style={{ height: 420 }}
    >
      {order.map((cardIdx, pos) => {
        const card = cards[cardIdx];
        const isActive = pos === 0;
        // Peek height per card behind
        const peek = 28;
        const y = isActive ? 0 : peek * pos + 40;
        const scale = 1 - pos * 0.04;
        const zIndex = n - pos;
        const opacity = pos > 3 ? 0 : 1;

        return (
          <motion.button
            key={cardIdx}
            type="button"
            onClick={() => setActiveIdx(cardIdx)}
            className="absolute left-0 right-0 top-0 focus:outline-none"
            initial={false}
            animate={{ y, scale, opacity }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            style={{ zIndex, transformOrigin: "top center" }}
            aria-label={`Show ${card.title}`}
          >
            <div className={isActive ? "" : "pointer-events-none"}>
              <StampCard {...card} />
            </div>
          </motion.button>
        );
      })}

      <div className="pointer-events-none absolute inset-x-0 -bottom-6 text-center text-xs text-muted-foreground">
        Tap a card to bring it to the front
      </div>
    </div>
  );
}
