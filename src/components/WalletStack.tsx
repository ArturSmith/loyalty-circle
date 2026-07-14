import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StampCard, type StampCardProps } from "./StampCard";

export function WalletStack({ cards }: { cards: StampCardProps[] }) {
  const [emblaRef, embla] = useEmblaCarousel({ align: "center", loop: true, containScroll: false });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const onSel = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSel);
    onSel();
    return () => { embla.off("select", onSel); };
  }, [embla]);

  return (
    <div className="relative w-full">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y items-center py-4">
          {cards.map((card, i) => {
            const dist = Math.abs(i - selected);
            const isActive = i === selected;
            return (
              <div
                key={i}
                className="min-w-0 flex-[0_0_82%] px-3 sm:flex-[0_0_360px]"
              >
                <motion.div
                  animate={{
                    scale: isActive ? 1 : 0.88,
                    opacity: dist > 2 ? 0.3 : isActive ? 1 : 0.65,
                    y: isActive ? 0 : 8,
                  }}
                  transition={{ type: "spring", stiffness: 220, damping: 26 }}
                >
                  <StampCard {...card} />
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5">
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => embla?.scrollTo(i)}
            className={`h-1.5 rounded-full transition-all ${i === selected ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25"}`}
            aria-label={`Show card ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
