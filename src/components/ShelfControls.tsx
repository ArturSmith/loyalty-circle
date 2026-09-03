import { useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Mouse/keyboard alternative to swiping each horizontal shelf. */
export function ShelfControls({ target, itemCount }: { target: RefObject<HTMLDivElement | null>; itemCount: number }) {
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const update = () => setEdges({ start: element.scrollLeft <= 4, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 4 });
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { element.removeEventListener("scroll", update); observer.disconnect(); };
  }, [target, itemCount]);
  const scroll = (direction: number) => {
    const element = target.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <div className="hidden shrink-0 items-center gap-1 md:flex">
      <button type="button" aria-label="Scroll left" disabled={edges.start} onClick={() => scroll(-1)} className="shelf-arrow"><ChevronLeft className="h-4 w-4" /></button>
      <button type="button" aria-label="Scroll right" disabled={edges.end} onClick={() => scroll(1)} className="shelf-arrow"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}
