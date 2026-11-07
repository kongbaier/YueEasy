import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Song } from '@/shared/types/uiModels';
import { cn } from '@/shared/utils/cn';
import { TrackRow } from './TrackRow';

/** 首屏一次挂载的行数；之后每次追加同样的量。 */
const CHUNK = 200;

interface TrackListProps {
  tracks: readonly Song[];
  onPlay: (track: Song) => void;
  /** 列表内部、最后一个行之后的附加内容（如「还有 N 首…」提示）。 */
  footer?: ReactNode;
  className?: string;
}

/**
 * 歌曲列表：`<TrackRow>` 序列 + 区域标注 + **渐进挂载**。
 *
 * 为什么渐进：歌单详情（`/playlist/detail`）一次给出整张歌单，上千首的列表全量挂载等于
 * 一次挂上千个 `TrackRow` —— 每行一个 base-ui `ContextMenu` 根、一个封面 `DecodedImage`、
 * 若干 store 订阅。开局只挂首屏 `CHUNK` 行，底部哨兵进入视口（提前 800px）再追加。
 *
 * 行仍然是**流内元素**（不是虚拟列表）：滚动容器 / `content-visibility` / 焦点导航 /
 * `useScrollMemory` 的语义都不变；滚动位置回填由 `useScrollMemory` 在内容长高后补写
 * （见该 hook 里「恢复目标可能大于当前内容高度」的注释）。
 *
 * 渐进挂载对视觉的影响：未挂载的行在末尾，因此列表总高度会随滚动增长 —— 这也是
 * 哨兵用 800px 提前量的原因（远早于用户滚到底）。
 */
export const TrackList = ({
  tracks,
  onPlay,
  footer,
  className,
}: TrackListProps) => {
  const total = tracks.length;
  const [count, setCount] = useState(() => Math.min(total, CHUNK));
  const sentinelRef = useRef<HTMLDivElement>(null);
  const visibleCount = Math.min(count, total);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= total) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setCount((prev) => Math.min(total, prev + CHUNK));
        }
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, total]);

  return (
    <div className={cn('space-y-0.5', className)} data-focus-zone>
      {tracks.slice(0, visibleCount).map((track, index) => (
        <TrackRow index={index} key={track.id} onPlay={onPlay} track={track} />
      ))}
      {/* 哨兵：不占布局、不可聚焦，只用来触发下一次追加 */}
      {visibleCount < total && (
        <div aria-hidden className="h-px" ref={sentinelRef} />
      )}
      {footer}
    </div>
  );
};
