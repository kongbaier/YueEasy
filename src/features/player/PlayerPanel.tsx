import { ChevronDown, Maximize, Minimize } from 'lucide-react';
import React, { Activity, Fragment, useEffect, useRef, useState } from 'react';
import { animate } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { PLAYER_PAGE_PATH, usePlayerPage } from './hooks/usePlayerPage';
import { usePlayerPanelStore } from './stores/playerPanelStore';
import { WindowControls } from '@/shared/components/WindowControls';
import { useWindowState } from '@/shared/hooks/useWindowState';
import { Cover } from '@/shared/ui/image';
import type { Track } from '@/shared/types/player';
import { cn } from '@/shared/utils/cn';
import { decodeImage, getNcmImageUrl } from '@/shared/utils/image';
import { Lyrics } from '@/features/lyrics/components/Lyrics';
import { PlayerPageComments } from './components/PlayerPageComments';
import { PlayerPageControls } from './components/PlayerPageControls';
import { PlayerPageProgress } from './components/PlayerPageProgress';
import { PlayerPageQueue } from './components/PlayerPageQueue';
import { PlayerPageVolume } from './components/PlayerPageVolume';
import { AspectFit } from '@/shared/ui/aspect-fit';
import { usePlayer } from '@/features/player/hooks/usePlayer';
import { PlayerMenu } from './components/PlayerMenu';
import { ArtistLink } from '@/features/artist/components/ArtistLink';

const tabs = [
  { key: 'queue', label: '队列', component: PlayerPageQueue },
  { key: 'comments', label: '评论', component: PlayerPageComments },
  { key: 'lyrics', label: '歌词', component: Lyrics },
] as const;

export type TabKeys = (typeof tabs)[number]['key'];

/** 进出场时长：与 `AppLayout` 里应用那块板子的 `transition` 用同一档 */
const FADE_MS = 0.3;
const FLY_EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

/** 播放栏封面上的标记：封面的 FLIP 起点/终点都按它实时量（它始终在文档里）。 */
export const PLAYER_BAR_COVER_ATTR = 'data-player-cover';

const measureBarCover = (): DOMRect | null =>
  document
    .querySelector<HTMLElement>(`[${PLAYER_BAR_COVER_ATTR}]`)
    ?.getBoundingClientRect() ?? null;

/**
 * 封面 FLIP：让 `el` 从播放栏那一小块「假装」长到自己的位置（或反过来）。
 * 用 live 元素做 transform —— 不走快照，所以不受面板透明度 / 窗口材质的影响。
 */
const flyCover = (
  el: HTMLElement | null,
  origin: DOMRect | null,
  direction: 'in' | 'out',
): Promise<unknown> => {
  if (!el || !origin) return Promise.resolve();
  const box = el.getBoundingClientRect();
  if (!box.width || !box.height || !origin.width) return Promise.resolve();

  const dx = origin.left + origin.width / 2 - (box.left + box.width / 2);
  const dy = origin.top + origin.height / 2 - (box.top + box.height / 2);
  const scale = origin.width / box.width;
  const flown = `translate(${dx}px, ${dy}px) scale(${scale})`;
  const home = 'translate(0px, 0px) scale(1)';

  return animate(
    el,
    { transform: direction === 'in' ? [flown, home] : [home, flown] },
    { duration: FADE_MS, ease: FLY_EASE },
  ).finished.catch(() => {});
};

/**
 * 播放页面板 —— 挂在布局层的**第二块板子**（不是路由页）。
 *
 * 两块板子同时活着，各自改透明度就是页面切换：应用那块由 `AppLayout` 按
 * `visible` 淡出，这块在这里淡入；同时封面用 live FLIP 从播放栏飞过来。
 */
export default function PlayerPanel() {
  const navigate = useNavigate();
  const { currentTrack, queue } = usePlayer();
  const { close, closing } = usePlayerPage();
  const [showTab, setShowTab] = useState<TabKeys>('lyrics');
  const panelRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  // 进场只跑一次：`useNavigate` 的 identity 每次导航都会变，直接放依赖里会让 effect 重跑，
  // 表现是面板进场后又被重新淡入一遍
  const didIntro = useRef(false);

  const changeShowTab = (tab: TabKeys) => {
    setShowTab(tab);
  };

  // 进场：这块板子淡入 + 封面从播放栏飞过来；跑完再把 URL 换成 /player
  // （那时应用那块板子已经不可见，卸掉它的页面没人看得出来）。
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || didIntro.current) return;
    didIntro.current = true;

    const origin = measureBarCover();
    const animations = [
      animate(
        panel,
        { opacity: [0, 1] },
        { duration: FADE_MS, ease: 'easeOut' },
      ).finished,
      flyCover(coverRef.current, origin, 'in'),
    ];

    let cancelled = false;
    void Promise.allSettled(animations).then(() => {
      if (!cancelled) navigate(PLAYER_PAGE_PATH);
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // 退场：面板淡出 + 封面飞回播放栏，跑完才把自己从文档里摘掉。
  // 应用那页在 `close()` 里**已经**导航回来了，所以底下那块板子是满的。
  useEffect(() => {
    if (!closing) return;
    const panel = panelRef.current;
    const origin = measureBarCover();
    const animations = [
      panel
        ? animate(
            panel,
            { opacity: [1, 0] },
            { duration: FADE_MS, ease: 'easeIn' },
          ).finished
        : Promise.resolve(),
      flyCover(coverRef.current, origin, 'out'),
    ];

    let cancelled = false;
    void Promise.allSettled(animations).then(() => {
      if (!cancelled) usePlayerPanelStore.getState().hide();
    });

    return () => {
      cancelled = true;
    };
  }, [closing]);

  // 安全网：面板开着但无歌可播（如自然播完最后一首）→ 自动退出去。
  // 用户触发的空队列类操作已在处理器里统一「先退页面、再变更」（见 PlayerPageQueue），
  // 这里只兜底领域驱动的路径。
  useEffect(() => {
    if (!currentTrack) close();
  }, [currentTrack, close]);

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
    /* 板子 B：两块 live 板子里的上面那块。
       - `fixed inset-0 z-40`：盖住整窗（队列抽屉 z-50 在它之上）；
       - 透明度由进出场动画改 —— 底下那块（应用）同时反向变化，就是页面切换；
       - 半透明底色只是为了透出窗口材质，与转场机制无关：这里是 live 交叉淡变，
         不经过任何快照，面板透明与否都成立。 */
    <div
      className="fixed inset-0 z-40 flex flex-col bg-background/85"
      data-focus-layer
      ref={panelRef}
      // 首帧就透明：动画是 live 的，等 effect 里再置 0 会先闪一帧完整面板。
      // React 的 style diff 只写变化过的键，之后的 imperative 动画不会被它重置。
      style={{ opacity: 0 }}
    >
      <PlayerHeader handleBack={handleBack} />

      <div className="relative flex-1 min-h-0 grid grid-cols-[1fr_1fr]">
        <div
          className={cn(
            'col-span-1 justify-self-center min-h-0',
            'pb-4 gap-2 px-4',
            'flex flex-col justify-around',
            'w-4/5 max-w-md',
            'overflow-x-visible',
          )}
          data-focus-zone
        >
          {currentTrack && (
            <React.Fragment>
              <PlayerTitle currentTrack={currentTrack} />
              <PlayerCover coverRef={coverRef} currentTrack={currentTrack} />
              <PlayerPageProgress />
              <PlayerPageControls />
              <PlayerPageVolume />
              <PlayerMenu tabKey={showTab} changeShowTab={changeShowTab} />
            </React.Fragment>
          )}
        </div>

        <div className="col-span-1 min-h-0 min-w-0" data-focus-zone>
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
    </div>
  );
}

const PlayerHeader = ({ handleBack }: { handleBack: () => void }) => {
  const { state, toggleFullscreen } = useWindowState();

  return (
    <header
      className="h-12 flex items-center shrink-0"
      data-drag-region
      data-focus-zone
    >
      {/*
        返回键始终存在：全屏下它一步完成「退出全屏 + 收起播放页」，
        策略在 `playerPageStore.close` 根部（不在 JSX 里按全屏态隐藏按钮）。
      */}
      <button
        className="flex items-center justify-center size-8 rounded-md ml-2 hover:bg-accent"
        onClick={handleBack}
        title="收起播放页"
        type="button"
      >
        <ChevronDown className="size-5" />
      </button>

      <div className="ml-auto flex items-center">
        <button
          className="size-12 text-foreground flex items-center justify-center rounded-none hover:bg-gray-500/20"
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
        {currentTrack.artists?.map((artist, i) => (
          <Fragment key={artist.id > 0 ? artist.id : artist.name}>
            {i > 0 && ' / '}
            {/* 播放页是路由：点歌手直接跳走，离开 /player 时布局层收全屏、外壳自动恢复 */}
            <ArtistLink artist={artist} />
          </Fragment>
        ))}
      </p>
    </div>
  );
};

const PlayerCover = ({
  currentTrack,
  coverRef,
}: {
  currentTrack: Track;
  coverRef: React.RefObject<HTMLDivElement | null>;
}) => {
  // 显示区约 448px（max-w-md），640 足够覆盖高 DPR，避免解码原始大图
  const picUrl = getNcmImageUrl(currentTrack?.album?.picUrl, 640);

  return (
    <AspectFit ratio={1}>
      <div className="size-full" ref={coverRef}>
        <Cover
          alt={currentTrack.album.name}
          className="size-full"
          foregroundClassName="rounded-lg border-[0.5px] border-border"
          src={picUrl}
        />
      </div>
    </AspectFit>
  );
};
