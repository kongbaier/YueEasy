import { Disc, Music, Search, User } from "lucide-react";
import { useEffect, useRef } from "react";

export interface SuggestionItem {
  /** 展示文本（含副标题，如 "七里香 — 周杰伦"） */
  label: string;
  /** 点击后填入搜索框的关键词 */
  keyword: string;
  /** 类型：歌曲 / 专辑 / 歌手 */
  kind: "song" | "album" | "artist";
}

interface SuggestDropdownProps {
  /** 建议项列表 */
  items: SuggestionItem[];
  /** 选中某个建议 */
  onPick: (keyword: string) => void;
  /** 关闭下拉面板（点击外部） */
  onClose: () => void;
}

const ICON_MAP = {
  song: Music,
  album: Disc,
  artist: User,
};

export function SuggestDropdown({
  items,
  onPick,
  onClose,
}: SuggestDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;

      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (items.length === 0) return null;

  return (
    <div
      className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border/40 bg-popover p-1 shadow-lg"
      ref={ref}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <Search className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          搜索建议
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {items.map((item, i) => {
          const Icon = ICON_MAP[item.kind];
          return (
            <button
              className="flex items-center gap-3 w-full rounded-[3px] px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
              key={`${item.kind}-${i}`}
              onClick={() => onPick(item.keyword)}
              type="button"
            >
              <Icon className="size-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
