import type { LyricLine as LyricLineType } from "@/core/lyrics/parser";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";

interface LyricLineProps {
  line: LyricLineType;
  lineIndex: number;
  isActive: boolean;
  isPast: boolean;
  tline?: LyricLineType;
}

export function LyricLine({
  line,
  lineIndex,
  isActive,
  isPast,
  tline,
}: LyricLineProps) {
  const seek = usePlayerStore((s) => s.seek);

  const handleSeek = () => {
    seek(line.startMs / 1000);
  };

  return (
    <li
      className={cn(
        "block leading-7 transition-[color,scale] scale-100 origin-left ease-in-out duration-300 cursor-pointer",
        isActive && "font-medium scale-110 text-primary",
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
    >
      <span className="block">{line.text}</span>
      {isActive && tline?.text && (
        <span className="block text-sm text-muted-foreground mt-0.5">
          {tline.text}
        </span>
      )}
    </li>
  );
}
