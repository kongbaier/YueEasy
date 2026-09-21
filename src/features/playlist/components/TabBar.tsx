import { Button } from '@/shared/ui/button';
import { formatCount } from '@/shared/utils/format';
import { cn } from '@/shared/utils/cn';

export type TabKey = 'songs' | 'comments';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'songs', label: '歌曲' },
  { key: 'comments', label: '评论' },
];

interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  songCount?: number;
  commentCount?: number;
}

export const TabBar = ({
  active,
  onChange,
  songCount,
  commentCount,
}: TabBarProps) => (
  <div className="flex border-b border-border/40 space-x-4">
    {TABS.map((tab) => {
      const count = tab.key === 'songs' ? songCount : commentCount;
      const showCount =
        tab.key === 'songs' ? count != null : count != null && count > 0;
      return (
        <Button
          className={cn(
            'px-0 text-[17px] font-medium transition-colors',
            active === tab.key
              ? 'text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground/80',
          )}
          key={tab.key}
          onClick={() => onChange(tab.key)}
          variant="ghost"
        >
          <span className="flex items-start gap-1">
            <span className="relative leading-none">
              {tab.label}
              {active === tab.key && (
                <span className="absolute left-1/2 -translate-x-1/2 -bottom-1.75 w-5 h-0.5 bg-primary rounded-full" />
              )}
            </span>
            {showCount && count != null && (
              <span className="text-[9px] leading-none tabular-nums text-muted-foreground/70">
                {formatCount(count)}
              </span>
            )}
          </span>
        </Button>
      );
    })}
  </div>
);
