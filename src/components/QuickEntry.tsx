import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface QuickEntryProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  to?: string;
  bgImage?: string;
  onClick?: () => void;
  className?: string;
}

export function QuickEntry({
  icon: _Icon,
  title: _title,
  subtitle: _subtitle,
  bgImage,
  to,
  onClick,
  className,
}: QuickEntryProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    }
  };

  return (
    <button
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl text-card-foreground",
        "transition-colors",
        "min-h-0",
        `bg-[url(${bgImage})]`,
        className,
      )}
      onClick={handleClick}
      type="button"
    >
      {/*<Icon className="h-6 w-6 text-primary" />
      <span className="text-sm font-medium">{title}</span>
      {subtitle && (
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      )}*/}
    </button>
  );
}
