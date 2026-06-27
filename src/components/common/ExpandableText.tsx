import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string;
  className?: string;
}

/**
 * Line-clamps text to 3 lines by default. If content overflows,
 * shows an expand/collapse toggle.
 */
export const ExpandableText = ({ text, className }: ExpandableTextProps) => {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      setOverflow(el.scrollHeight > el.clientHeight);
    }
  }, [text]);

  return (
    <div className="space-y-1.5">
      <p
        ref={ref}
        className={cn(
          "text-sm text-muted-foreground leading-relaxed",
          !expanded && "line-clamp-3",
          className,
        )}
      >
        {text}
      </p>
      {overflow && (
        <button
          className="inline-flex items-center gap-1 text-xs text-primary/80 hover:text-primary transition-colors"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          {expanded ? "收起" : "展开"}
        </button>
      )}
    </div>
  );
};
