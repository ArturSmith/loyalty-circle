import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export type AppBarVariant = "branded" | "simple";

interface AppBarProps {
  /**
   * "branded" shows logo + title on left, action on right
   * "simple" shows back button + title in center
   */
  variant?: AppBarVariant;
  title?: string;
  subtitle?: string;
  onBackClick?: () => void;
  backHref?: string;
  rightAction?: React.ReactNode;
  showLogo?: boolean;
  className?: string;
}

export function AppBar({
  variant = "simple",
  title,
  subtitle,
  onBackClick,
  backHref,
  rightAction,
  showLogo = false,
  className = "",
}: AppBarProps) {
  const baseClass = "relative flex items-center justify-between px-5 py-4";

  if (variant === "branded") {
    return (
      <header className={`${baseClass} ${className}`}>
        <div className="flex items-center gap-2">
          {showLogo && <Logo className="h-8 w-8" />}
          <div>
            {title && <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>}
            {subtitle && <p className="text-xs uppercase tracking-widest text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {rightAction}
      </header>
    );
  }

  // simple variant
  return (
    <header className={`${baseClass} ${className}`}>
      <div className="flex items-center gap-3 flex-1">
        {backHref || onBackClick ? (
          backHref ? (
            <Link to={backHref as any}>
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" size="icon" onClick={onBackClick} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )
        ) : null}
        <div>
          {subtitle && <p className="text-xs uppercase tracking-widest text-muted-foreground">{subtitle}</p>}
          {title && <h1 className="font-display text-2xl font-semibold">{title}</h1>}
        </div>
      </div>
      {rightAction}
    </header>
  );
}
