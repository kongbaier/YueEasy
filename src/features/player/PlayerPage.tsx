import { ChevronDown, Maximize, Minimize } from 'lucide-react';
import React, { Activity, useEffect, useLayoutEffect, useState } from 'react';
import { WindowControls } from '@/shared/components/WindowControls';
import { useWindowState } from '@/shared/hooks/useWindowState';
import { Cover } from '@/shared/ui/image';
import type { Track } from '@/shared/types/player';
import { cn } from '@/shared/utils/cn';
import { decodeImage, getNcmImageUrl } from '@/shared/utils/image';
import { usePlayerPage } from '@/features/player/hooks/usePlayerPage';
import { Lyrics } from '@/features/lyrics/components/Lyrics';
import { PlayerPageComments } from './components/PlayerPageComments';
import { PlayerPageControls } from './components/PlayerPageControls';
import { PlayerPageProgress } from './components/PlayerPageProgress';
import { PlayerPageQueue } from './components/PlayerPageQueue';
import { PlayerPageVolume } from './components/PlayerPageVolume';
import { AnimatePresence, motion } from 'motion/react';
import { AspectFit } from '@/shared/ui/aspect-fit';
import { usePlayer } from '@/features/player/hooks/usePlayer';
import { PlayerMenu } from './components/PlayerMenu';

const tabs = [
  { key: 'queue', label: '队列', component: PlayerPageQueue },
  { key: 'comments', label: '评论', component: PlayerPageComments },
  { key: 'lyrics', label: '歌词', component: Lyrics },
] as const;

export type TabKeys = (typeof tabs)[number]['key'];

export default function PlayerPage() {
  const { currentTrack, queue } = usePlayer();
  const { close, isOpen, runAfterExit } = usePlayerPage();
  const [showTab, setShowTab] = useState<TabKeys>('lyrics');

  const changeShowTab = (tab: TabKeys) => {
    setShowTab(tab);
  };

  // 安全网：播放页打开时若无歌可播，自动关闭。
  // 用户触发的清空类操作（清空/移除最后一首/退出漫游且无队列可恢复）已在
  // 处理器里统一“先 close、退出动画结束再变更”处理（见 PlayerPageQueue）；
  // 本约束兜底领域驱动的空队列（如自然播完最后一首）及未来新增的路径。
  useLayoutEffect(() => {
    if (isOpen && !currentTrack) close();
  }, [isOpen, currentTrack, close]);

  useEffect(() => {
    if (!currentTrack) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const next = queue[idx + 1];
    if (next?.album?.picUrl) {
      // 预加载也限尺寸，避免解码原始大图；解码入口统一走 decodeImage
      void decodeImage(getNcmImageUrl(next.album.picUrl, 640));
    }
  }, [currentTrack, queue]);

  const handleBack = () => close();

  return (
    <AnimatePresence onExitComplete={runAfterExit}>
      {isOpen && (
        <motion.div
          animate={{ y: 0 }}
          className="fixed inset-0 z-50 bg-[#fafafa] dark:bg-[#0a0a0a]"
          exit={{ y: '100%' }}
          initial={{ y: '100%' }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <PlayerHeader handleBack={handleBack} />

          <div className="relative h-[calc(100vh-40px)] grid grid-cols-[1fr_1fr]">
            <div
              className={cn(
                'col-span-1 justify-self-center min-h-0',
                'pb-4 gap-2 px-4',
                'flex flex-col justify-around',
                'w-4/5 max-w-md',
                'overflow-x-visible',
              )}
            >
              {currentTrack && (
                <React.Fragment>
                  <PlayerTitle currentTrack={currentTrack} />
                  <PlayerCover currentTrack={currentTrack} />
                  <PlayerPageProgress />
                  <PlayerPageControls />
                  <PlayerPageVolume />
                  <PlayerMenu tabKey={showTab} changeShowTab={changeShowTab} />
                </React.Fragment>
              )}
            </div>

            <div className="col-span-1 min-h-0">
              {tabs.map((tab) => {
                return (
                  <Activity
                    key={tab.key}
                    mode={tab.key === showTab ? 'visible' : 'hidden'}
                  >
                    <tab.component />
                  </Activity>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const PlayerHeader = ({ handleBack }: { handleBack: () => void }) => {
  const { state, toggleFullscreen } = useWindowState();

  return (
    <header className="flex items-center h-10 shrink-0" data-drag-region>
      <button
        className="flex items-center justify-center size-8 rounded ml-1 hover:bg-accent"
        onClick={handleBack}
        type="button"
      >
        <ChevronDown className="size-5" />
      </button>
      <div className="ml-auto flex items-center mr-1">
        <button
          className="w-8 h-8 text-foreground flex items-center justify-center rounded hover:bg-gray-500/20"
          onClick={toggleFullscreen}
          type="button"
          title={state === 'fullscreen' ? '退出全屏' : '全屏'}
        >
          {state === 'fullscreen' ? (
            <Minimize className="size-4" />
          ) : (
            <Maximize className="size-4" />
          )}
        </button>
        {state !== 'fullscreen' && <WindowControls />}
      </div>
    </header>
  );
};

const PlayerTitle = ({ currentTrack }: { currentTrack: Track }) => {
  return (
    <div className="h-14">
      <h1 className="text-xl font-semibold text-foreground truncate">
        {currentTrack.name}
      </h1>
      <p className="text-sm text-muted-foreground mt-1 truncate">
        {currentTrack.artists?.map((a) => a.name).join(' / ')}
      </p>
    </div>
  );
};

const PlayerCover = ({ currentTrack }: { currentTrack: Track }) => {
  // 显示区约 448px（max-w-md），640 足够覆盖高 DPR，避免解码原始大图
  const picUrl = getNcmImageUrl(currentTrack?.album?.picUrl, 640);

  return (
    <AspectFit ratio={1}>
      <Cover
        alt={currentTrack.album.name}
        className="size-full"
        foregroundClassName="rounded-lg border-[0.5px]  border-border"
        src={picUrl}
      />
    </AspectFit>
  );
};
