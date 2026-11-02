import { useState } from 'react';
import { Cloud, Play } from 'lucide-react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Button } from '@/shared/ui/button';
import { useScrollMemory } from '@/shared/hooks/useScrollMemory';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { formatBytes } from '@/shared/utils/format';
import { useAuthViewModel } from '@/features/auth/hooks/useAuthViewModel';
import {
  CloudFileRow,
  CloudFileRowHeader,
  CloudFileRowSkeletonList,
} from './components/CloudFileRow';
import { CLOUD_PAGE_SIZE } from './constants';
import { useCloudViewModel } from './hooks/useCloudViewModel';

/**
 * 音乐云盘（一级页 `/my/cloud`）：云盘里上传的歌曲列表 + 容量概览。
 *
 * 版式与「每日推荐」保持一致：顶部一条固定信息栏（左侧统计、右侧圆形「播放全部」），
 * 列表在下方 `ScrollArea` 内滚动；滚动所有权在本页（见 AGENTS.md §8）。
 * 列表是表格式布局：`# / 封面 / 标题(歌手) / 专辑 / 格式 / 上传时间 ↓ / 大小`，
 * 行组件在同功能 `components/CloudFileRow`（比共享 `TrackRow` 多三列，故不复用）。
 *
 * 取数走非 Suspense 的 `useQuery`（见 `useCloudViewModel`），所以本页是单一组件：
 * 登录门禁 / 加载骨架 / 空态全部由 early return 承载。所有 hook（含 useScrollMemory /
 * viewmodel / 分页 limit）都在 early return 之前调用，保证登录态翻转时 hook 数量不变。
 */
export default function CloudPage() {
  usePageTitle('音乐云盘', { root: true });
  const scrollRef = useScrollMemory();
  const { userId, openLogin } = useAuthViewModel();
  const [limit, setLimit] = useState(CLOUD_PAGE_SIZE);
  const {
    tracks,
    unmatched,
    count,
    usedBytes,
    maxBytes,
    more,
    isLoading,
    isLoadingMore,
    handlePlay,
    handlePlayAll,
  } = useCloudViewModel(userId, limit);

  if (userId == null) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        data-focus-zone
      >
        <Cloud className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看音乐云盘</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  if (isLoading)
    return (
      <div className="p-6">
        <div className="mt-3">
          <CloudFileRowSkeletonList />
        </div>
      </div>
    );

  return (
    <div className="py-2 h-full flex flex-col">
      <div
        className="px-6 flex items-center justify-between gap-4"
        data-focus-zone
      >
        <p className="text-sm text-muted-foreground tabular-nums">
          共 <span className="text-primary px-2">{count}</span>
          个文件
          {maxBytes != null && (
            <span className="pl-2">
              · 已用 {formatBytes(usedBytes ?? 0)} / {formatBytes(maxBytes)}
            </span>
          )}
        </p>
        <Button
          aria-label="播放全部"
          className="rounded-full"
          disabled={tracks.length === 0}
          onClick={handlePlayAll}
          size="icon"
          title="播放全部"
        >
          <Play className="size-3" />
        </Button>
      </div>

      <ScrollArea className="mt-3 flex-1 px-6" ref={scrollRef}>
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Cloud className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">云盘还是空的</p>
            <p className="text-xs text-muted-foreground/60">
              可在网易云音乐客户端「我的音乐 → 云盘」上传歌曲
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            <CloudFileRowHeader />
            <div className="space-y-0.5" data-focus-zone>
              {tracks.map((track, index) => (
                <CloudFileRow
                  index={index}
                  key={track.song.id}
                  onPlay={handlePlay}
                  track={track}
                />
              ))}
            </div>

            {unmatched > 0 && (
              <p className="text-center text-xs text-muted-foreground/60">
                另有 {unmatched} 个文件尚未匹配到曲库，暂不可播放
              </p>
            )}

            {more && (
              <div className="flex justify-center" data-focus-zone>
                <Button
                  disabled={isLoadingMore}
                  onClick={() => setLimit((n) => n + CLOUD_PAGE_SIZE)}
                  variant="outline"
                >
                  {isLoadingMore ? '加载中…' : '加载更多'}
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
