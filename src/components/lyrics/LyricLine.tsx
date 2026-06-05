import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
import type { LyricLine as LyricLineType } from "@/core/lyrics/parser";
import { useLineLayout } from "@/hooks/useLineLayout";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";

const FONT_SIZE = {
  small: { size: 16, lineHeight: 28 },
  medium: { size: 18, lineHeight: 32 },
  large: { size: 20, lineHeight: 36 },
} as const;

const FONT_FAMILY = ` system-ui,Segoe UI Symbol,ui-sans-serif, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji`;

interface LyricLineProps {
  activeScale: number;
  layoutWidth: number | undefined;
  line: LyricLineType;
  lineIndex: number;
  isActive: boolean;
  isPast: boolean;
  tline?: LyricLineType;
}

export function LyricLine({
  activeScale,
  layoutWidth,
  line,
  lineIndex,
  isActive,
  isPast,
  tline,
}: LyricLineProps) {
  const seek = usePlayerStore((s) => s.seek);

  const isLarge = useMediaQuery("(min-width: 1280px)", { noSsr: true });
  const isMedium = useMediaQuery("(min-width: 1024px)", { noSsr: true });
  const fontSize = isLarge
    ? FONT_SIZE.large
    : isMedium
      ? FONT_SIZE.medium
      : FONT_SIZE.small;
  const FONT = `500 ${fontSize.size}px ${FONT_FAMILY}`;

  const layout = useLineLayout(
    line.text,
    layoutWidth,
    FONT,
    fontSize.lineHeight,
  );

  const handleSeek = () => {
    seek(line.startMs / 1000);
  };

  return (
    <li
      className={cn(
        "transition-[color,scale] origin-left ease-in-out duration-300 cursor-pointer",
        isActive && "font-medium text-primary",
        isPast && "text-foreground",
        !isActive && !isPast && "text-foreground/70",
      )}
      data-line={lineIndex}
      onClick={handleSeek}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSeek();
        }
      }}
      style={{
        scale: isActive ? String(activeScale) : "1",
        font: FONT,
        lineHeight: `${fontSize.lineHeight}px`,
      }}
    >
      {(layout?.lines ?? [line.text]).map((l, i) => {
        const text = typeof l === "string" ? l : l.text;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: static sub-lines, order is stable
          <span key={i}>{text}</span>
        );
      })}
      {isActive && tline?.text && (
        <span className="block text-sm text-muted-foreground mt-0.5">
          {tline.text}
        </span>
      )}
    </li>
  );
}
