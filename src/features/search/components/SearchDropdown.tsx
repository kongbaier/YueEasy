import { useSearchHot, useSearchSuggest } from '../hooks/useSearch';
import { useSearchController } from '../hooks/useSearchController';
import {
  Clock,
  Disc,
  Music,
  Search,
  User,
  TrendingUp,
  X,
} from 'lucide-react';
import { suggestionKey } from '../constants';
import type { SuggestionItem } from '../constants';
import { useEffect, useRef } from 'react';

interface HistorySectionProps {
  /** 搜索历史（最新在前） */
  history: string[];
  /** 点击气泡本体 → 直接搜索该词 */
  onPick: (word: string) => void;
  /** 点击气泡末尾 × → 删除该条历史 */
  onRemove: (word: string) => void;
}

function HistorySection({ history, onPick, onRemove }: HistorySectionProps) {
  if (history.length === 0) return null;

  return (
    <div className="border-b border-border/40 px-2.5 pt-2 pb-2">
      <div className="flex items-center gap-1.5 pb-2">
        <Clock className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          搜索历史
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {history.map((word) => (
          <span
            className="flex max-w-full items-center gap-0.5 rounded-full border border-border/50 bg-accent/60 pl-2.5 pr-1 py-1 text-xs text-foreground transition-colors hover:bg-accent"
            key={word}
          >
            <button
              className="truncate"
              onClick={() => onPick(word)}
              type="button"
            >
              {word}
            </button>
            <button
              aria-label={`删除搜索历史：${word}`}
              className="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              onClick={() => onRemove(word)}
              type="button"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

interface HotDropdownProps {
  /** 热门搜索词列表 */
  hots: string[];
  /** 搜索历史（最新在前） */
  history: string[];
  /** 选中某个热词 */
  onPick: (word: string) => void;
  /** 删除某条搜索历史 */
  onRemove: (word: string) => void;
  /** 关闭下拉面板（点击外部） */
  onClose: () => void;
}

function HotDropdown({
  hots,
  history,
  onPick,
  onRemove,
  onClose,
}: HotDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border/40 bg-popover p-1 shadow-lg"
      ref={ref}
    >
      <HistorySection history={history} onPick={onPick} onRemove={onRemove} />
      {hots.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 px-2.5 py-2">
            <TrendingUp className="size-4 text-orange-500" />
            <span className="text-xs font-medium text-muted-foreground">
              热门搜索
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {hots.map((word, i) => (
              <button
                className="flex items-center gap-3 w-full rounded-[3px] px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
                key={word}
                onClick={() => onPick(word)}
                type="button"
              >
                <span
                  className={`w-5 text-center text-xs font-bold tabular-nums shrink-0 ${
                    i < 3 ? 'text-orange-500' : 'text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate">{word}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
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

function SuggestDropdown({ items, onPick, onClose }: SuggestDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;

      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
        {items.map((item) => {
          const Icon = ICON_MAP[item.kind];
          return (
            <button
              className="flex items-center gap-3 w-full rounded-[3px] px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
              key={suggestionKey(item)}
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

export function SearchDropdown() {
  const { show, input, setInput, setShow, submit, history, removeHistory } =
    useSearchController();
  const hots = useSearchHot().data ?? [];
  const suggestions = useSearchSuggest().data ?? [];

  const handlePick = (keyword: string) => {
    setInput(keyword);
    submit();
  };

  return (
    <>
      {show === 'hot' && !input.trim() && (history.length > 0 || hots.length > 0) && (
        <HotDropdown
          hots={hots}
          history={history}
          onClose={() => setShow(null)}
          onPick={(keyword) => handlePick(keyword)}
          onRemove={(keyword) => removeHistory(keyword)}
        />
      )}
      {show === 'suggest' && suggestions.length > 0 && (
        <SuggestDropdown
          items={suggestions}
          onClose={() => setShow(null)}
          onPick={(keyword) => handlePick(keyword)}
        />
      )}
    </>
  );
}
