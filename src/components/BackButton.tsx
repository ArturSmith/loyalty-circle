import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type BackButtonProps = {
  onClick: () => void;
  label?: string;
};

/** Shared navigation control for app screens that return to a parent view. */
export function BackButton({ onClick, label = "Back" }: BackButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-full glass-panel"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
}
