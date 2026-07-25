import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StampCard, type StampCardProps } from "./StampCard";

/**
 * Wallet-style overlapping card stack (same visual as the /wallet page).
 * Auto-cycles: every `intervalMs` the front card moves to the back.
 */
export function WalletShowcase({
  cards,
  intervalMs = 3000,
}: {
  cards: StampCardProps[];
  intervalMs?: number;
}) {
  const [order, setOrder] = useState(cards);

  useEffect(() => {
    if (cards.length <= 1) return;
    const id = setInterval(() => {
      setOrder((prev) => {
        // Move front card (last in array, highest z) to the back (first in array)
        const next = [...prev];
        const front = next.pop();
        if (front) next.unshift(front);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [cards.length, intervalMs]);

  const CARD_H = 220;
  const PEEK = 56;
  const totalHeight = (order.length - 1) * PEEK + CARD_H + 20;

  return (
    <div className="mx-auto w-full max-w-md px-2">
      <div className="relative" style={{ height: totalHeight }}>
        {order.map((card, i) => (
          <motion.div
            key={card.title}
            layout
            className="absolute inset-x-0"
            initial={false}
            animate={{ y: i * PEEK }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            style={{ zIndex: i + 1 }}
          >
            <div className="drop-shadow-2xl">
              <StampCard {...card} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
