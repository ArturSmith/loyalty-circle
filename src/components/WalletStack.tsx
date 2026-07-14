import { useState } from "react";
import { motion } from "framer-motion";
import { StampCard, type StampCardProps } from "./StampCard";

export function WalletStack({ cards }: { cards: StampCardProps[] }) {
  const [active, setActive] = useState(cards.length - 1);
  const n = cards.length;

  // Fan spread parameters
  const spreadX = 34; // horizontal offset in px between cards
  const spreadR = 6;  // rotation degrees between cards

  return (
    <div className="relative mx-auto w-full max-w-md" style={{ height: 340 }}>
      <div className="absolute inset-0 flex items-center justify-center">
        {cards.map((card, i) => {
          // Offset relative to active card
          const offset = i - active;
          const isActive = i === active;
          const x = offset * spreadX;
          const rotate = offset * spreadR;
          const y = Math.abs(offset) * 6;
          const scale = isActive ? 1.05 : 1 - Math.abs(offset) * 0.02;
          // Stacking: active on top, then by proximity
          const zIndex = 100 - Math.abs(offset);

          return (
            <motion.button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className="absolute w-[74%] max-w-[300px] focus:outline-none"
              initial={false}
              animate={{ x, y, rotate, scale }}
              transition={{ type: "spring", stiffness: 240, damping: 26 }}
              style={{ zIndex, transformOrigin: "bottom center" }}
              whileHover={{ y: y - 8 }}
              aria-label={`Show ${card.title}`}
            >
              <div className="drop-shadow-xl">
                <StampCard {...card} />
              </div>
            </motion.button>
          );
        })}
      </div>
      <div className="absolute inset-x-0 -bottom-2 text-center text-xs text-muted-foreground">
        Tap a card to bring it forward
      </div>
    </div>
  );
}
