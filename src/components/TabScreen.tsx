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
    <div className="tab-screen flex min-h-screen flex-col pb-24 md:pb-10">
      <header className="tab-screen-header sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex min-h-[56px] w-full max-w-6xl flex-wrap items-center gap-3 px-5 py-3 md:min-h-24 md:px-8 md:py-5">
          {backAction}
          <div className="min-w-0 flex-1">
            <h1 className="break-words font-display text-2xl font-semibold md:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground md:text-sm">{subtitle}</p>}
          </div>
          <div className="ml-auto">{action}</div>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-6xl ${contentClassName ?? "flex-1"}`}>
        <TabTransition>{children}</TabTransition>
      </main>
    </div>
  );
}
