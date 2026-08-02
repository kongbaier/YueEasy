import {
  ChevronDown,
  Download,
  Ellipsis,
  Heart,
  Maximize,
  MessageCircleMore,
  Minimize,
  Share2,
} from 'lucide-react';
import React, {
  Activity,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { WindowControls } from '@/shared/ui/system';
import { useWindowState } from '@/shared/hooks/useWindowState';
import { Button } from '@/shared/ui/button';
import { Cover } from '@/shared/ui/image';
import type { Track } from '@/core/types';
import { toast } from '@/shared/lib/toast';
import { cn } from '@/shared/lib/utils';
import { ncm } from '@/tauri/ncm';
import { useLoginDialog } from '@/modules/auth/loginDialogStore';
import { usePlayerPage } from '@/modules/player/contexts/PlayerPageContext';
import { Lyrics } from '@/modules/lyric/components/Lyrics';
import { PlayerPageComments } from './PlayerPageComments';
import { PlayerPageControls } from './PlayerPageControls';
import { PlayerPageProgress } from './PlayerPageProgress';
import { PlayerPageQueue } from './PlayerPageQueue';
import { PlayerPageVolume } from './PlayerPageVolume';
import { AnimatePresence, motion } from 'motion/react';
import { AspectFit } from '@/shared/ui/aspect-fit';
import { useQueueStore } from '../stores/queue';
import { useAuthStore } from '@/stores/auth';
import { useLikeStore } from '@/stores/like';

export default function PlayerPage() {
  const currentTrack = useQueueStore((s) => s.currentTrack);
  const { close, isOpen } = usePlayerPage();
  const [showQueue, setShowQueue] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (!currentTrack) return;
    const { queue } = useQueueStore.getState();
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const next = queue[idx + 1];
    if (next?.album?.picUrl) {
      const img = new Image();
      img.src = next.album.picUrl;
      img.decode().catch(() => {});
    }
  }, [currentTrack]);

  const handleBack = () => close();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          animate={{ y: 0 }}
          className="fixed inset-0 z-50 bg-[#fafafa] dark:bg-[#0a0a0a]"
          exit={{ y: '100%' }}
          initial={{ y: '100%' }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <PlayerHeader handleBack={handleBack} />

          <div className="relative h-[calc(100vh-40px)] grid grid-cols-[1fr_1fr] overflow-auto">
            <div
              className={cn(
                'col-span-1 justify-self-center min-h-0',
                'pb-4 gap-2 px-4',
                'flex flex-col justify-around',
                'w-4/5 max-w-md',
              )}
            >
              {currentTrack && (
                <React.Fragment>
                  <PlayerTitle currentTrack={currentTrack} />
                  <PlayerCover currentTrack={currentTrack} />
                  <PlayerPageProgress />
                  <PlayerPageControls
                    onToggleQueue={() => {
                      setShowQueue((v) => !v);
                      setShowComments(false);
                    }}
                    showQueue={showQueue}
                  />
                  <PlayerPageVolume />
                  <PlayerMenu
                    currentTrack={currentTrack}
                    onToggleComments={() => {
                      setShowComments((v) => !v);
                      setShowQueue(false);
                    }}
                    showComments={showComments}
                  />
                </React.Fragment>
              )}
            </div>

            <div className="col-span-1 min-h-0">
              <Activity mode={showComments ? 'visible' : 'hidden'}>
                {currentTrack && (
                  <PlayerPageComments key="comments" songId={currentTrack.id} />
                )}
              </Activity>
              <Activity
                mode={!showComments && showQueue ? 'visible' : 'hidden'}
              >
                <PlayerPageQueue key="queue" onBack={handleBack} />
              </Activity>
              <Activity
                mode={!showComments && !showQueue ? 'visible' : 'hidden'}
              >
                <Lyrics />
              </Activity>
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
  const picUrl = currentTrack?.album?.picUrl;

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

const PlayerMenu = ({
  currentTrack,
  showComments,
  onToggleComments,
}: {
  currentTrack: Track;
  showComments: boolean;
  onToggleComments: () => void;
}) => {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useLoginDialog((s) => s.setOpen);
  const isLiked = useLikeStore((s) => s.isLiked(currentTrack.id));
  const toggleLike = useLikeStore((s) => s.toggle);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const handleLike = useCallback(() => {
    if (!isLoggedIn) {
      toast.error('请先登录');
      setLoginDialogOpen(true);
      return;
    }
    const next = !isLiked;
    toggleLike(currentTrack.id);
    ncm
      .like(currentTrack.id, next)
      .then(() => {
        toast.success(
          next
            ? `已收藏 ${currentTrack.name}`
            : `已取消收藏 ${currentTrack.name}`,
        );
      })
      .catch(() => {
        toggleLike(currentTrack.id);
        toast.error('操作失败，请重试');
      });
  }, [
    isLoggedIn,
    isLiked,
    currentTrack.id,
    currentTrack.name,
    toggleLike,
    setLoginDialogOpen,
  ]);

  useEffect(() => {
    if (!moreOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  return (
    <div className="w-full shrink-0 h-1/10 flex justify-between items-center gap-1 text-foreground">
      <Button onClick={handleLike} size="icon-lg" variant="ghost">
        <Heart
          className={cn(
            'size-5',
            isLiked ? 'text-red-500 fill-red-500' : 'hover:text-primary',
          )}
          strokeWidth={1.5}
        />
      </Button>
      <Button
        className={cn(
          showComments
            ? 'text-primary hover:text-primary'
            : 'text-foreground hover:bg-transparent hover:text-primary',
        )}
        onClick={onToggleComments}
        size="icon-lg"
        variant={showComments ? 'secondary' : 'ghost'}
      >
        <MessageCircleMore className="size-5" strokeWidth={1.5} />
      </Button>
      <Button disabled size="icon-lg" variant="ghost">
        <Share2 className="size-5" strokeWidth={1.5} />
      </Button>
      <div className="relative" ref={moreRef}>
        <Button
          onClick={() => setMoreOpen((v) => !v)}
          size="icon-lg"
          variant={moreOpen ? 'secondary' : 'ghost'}
        >
          <Ellipsis className="size-5" strokeWidth={1.5} />
        </Button>
        {moreOpen && (
          <div className="absolute bottom-full right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-30 z-50">
            <Button
              className="w-full justify-start opacity-60"
              size="sm"
              variant="ghost"
            >
              <Download className="size-4" />
              下载
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
