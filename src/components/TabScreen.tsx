import type { ReactNode } from "react";
import { TabTransition } from "@/components/TabTransition";

/**
 * Shared shell for the bottom-nav tabs: one consistent top app bar (title only,
 * never a back button) and a persistent bottom navigation.
 */
export function TabScreen({
  title,
  subtitle,
  backAction,
  action,
  children,
  contentClassName,
}: {
  title: string;
  subtitle?: string;
  backAction?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex min-h-[56px] w-full max-w-3xl items-center gap-3 px-5 py-3">
          {backAction}
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="ml-auto">{action}</div>
        </div>
      </header>

      <main className={contentClassName ?? "flex-1"}>
        <TabTransition>{children}</TabTransition>
      </main>
    </div>
  );
}
