import { useRef, type ReactNode } from "react";
import { motion } from "framer-motion";

const TAB_ORDER = ["/wallet", "/vouchers", "/discover", "/chats", "/profile"];

// Remembers the last visited tab across unmounts so the incoming screen can
// slide in from the correct side.
let lastIndex: number | null = null;

function indexFor(path: string) {
  const i = TAB_ORDER.findIndex((t) => path === t || path.startsWith(`${t}/`));
  return i;
}

/**
 * Slides a bottom-nav tab screen in from the side you navigated from, so
 * switching tabs feels continuous instead of snapping.
 */
export function TabTransition({ path, children }: { path: string; children: ReactNode }) {
  const direction = useRef<number>(0);
  const initialised = useRef(false);

  if (!initialised.current) {
    initialised.current = true;
    const current = indexFor(path);
    if (current === -1 || lastIndex === null) direction.current = 0;
    else direction.current = current > lastIndex ? 1 : current < lastIndex ? -1 : 0;
    if (current !== -1) lastIndex = current;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: direction.current * 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
      className="flex-1"
    >
      {children}
    </motion.div>
  );
}
