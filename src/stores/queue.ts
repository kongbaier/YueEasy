// useQueueStore —— 队列权威 store（低频、持久化）。
// 持有 QueueEngine（队列/导航/FM 状态机），镜像低频谱队列状态，并经 plugin-store 持久化。
// 与 usePlayerStore（transport 60fps）分离：本 store 的字段只在真实队列/导航突变时变，
// 不会被子帧的 currentTime 更新波及 → persist 安全、不被意外触发。
//
// usePlayerStore（编排层）经本 store 的 action 驱动引擎并读取 currentTrack / Step。

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { QueueItem } from '@/shared/types/entities';
import type { Order, RepeatMode } from '@/shared/types/player';
import type {
  ContentSource,
  PlayerSnapshot,
} from '@/modules/player/core/types';
import { QueueEngine } from '@/modules/player/core/QueueEngine';
import { TauriStorage } from '@/tauri/storage';

// eslint-disable-next-line prefer-const
export let playerEngine = new QueueEngine();

function fromEnginePartial(): Pick<
  QueueState,
  | 'queue'
  | 'currentIndex'
  | 'order'
  | 'repeat'
  | 'contentSource'
  | 'fmPlayedIds'
> {
  const snap = playerEngine.snapshot();
  return {
    queue: snap.queue,
    currentIndex: snap.current_index,
    order: snap.order,
    repeat: snap.repeat,
    contentSource: snap.content_source,
    fmPlayedIds: snap.fm_played_ids,
  };
}

export interface QueueState {
  // 引擎镜像（低频）
  queue: QueueItem[];
  currentIndex: number | null;
  order: Order;
  repeat: RepeatMode;
  contentSource: ContentSource;
  fmPlayedIds: number[];

  // ── 队列操作（突变引擎 → 镜像 → persist） ──
  append: (tracks: QueueItem[]) => void;
  insertNext: (track: QueueItem) => void;
  removeAt: (index: number) => void;
  clear: () => void;
  setRepeat: (repeat: RepeatMode) => void;
  setOrder: (order: Order) => void;

  // ── 导航（返回「下一步播什么」，供编排层取曲 + 播放） ──
  playTrack: (track: QueueItem) => QueueItem | null;
  replacePlay: (
    tracks: QueueItem[],
    startIndex?: number | null,
  ) => QueueItem | null;
  playQueueAt: (index: number) => QueueItem | null;
  manualNext: () => ReturnType<QueueEngine['manualNext']>;
  onTrackEnd: () => ReturnType<QueueEngine['onTrackEnd']>;
  prev: () => QueueItem | null;
  restart: () => QueueItem | null;

  // ── FM ──
  enterFm: (track: QueueItem) => void;
  exitFm: () => QueueItem | null;
  appendFm: (tracks: QueueItem[]) => void;
  removeFmCurrent: () => QueueItem | null;

  // ── 只读 ──
  currentTrack: () => QueueItem | null;
  isFmActive: () => boolean;
  isEnded: () => boolean;
  snapshot: () => PlayerSnapshot;
  /** 引擎状态同步到 store + 持久化（变化后调用）。 */
  sync: () => void;
  /** 启动恢复：从快照重建引擎并回填（不自动播放）。 */
  restore: (snapshot: PlayerSnapshot) => void;
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      ...fromEnginePartial(),

      sync: () => set(fromEnginePartial()),

      append: (tracks) => {
        playerEngine.append(tracks);
        get().sync();
      },
      insertNext: (track) => {
        playerEngine.insertNext(track);
        get().sync();
      },
      removeAt: (index) => {
        playerEngine.removeAt(index);
        get().sync();
      },
      clear: () => {
        playerEngine.clear();
        get().sync();
      },
      setRepeat: (repeat) => {
        playerEngine.setRepeat(repeat);
        get().sync();
      },
      setOrder: (order) => {
        playerEngine.setOrder(order);
        get().sync();
      },

      playTrack: (track) => {
        const t = playerEngine.playTrack(track);
        get().sync();
        return t;
      },
      replacePlay: (tracks, startIndex) => {
        const t = playerEngine.replacePlay(tracks, startIndex ?? 0);
        get().sync();
        return t;
      },
      playQueueAt: (index) => {
        const t = playerEngine.playQueueAt(index);
        get().sync();
        return t;
      },
      manualNext: () => {
        const step = playerEngine.manualNext();
        get().sync();
        return step;
      },
      onTrackEnd: () => {
        const step = playerEngine.onTrackEnd();
        get().sync();
        return step;
      },
      prev: () => {
        const t = playerEngine.prev();
        get().sync();
        return t;
      },
      restart: () => {
        const t = playerEngine.restart();
        get().sync();
        return t;
      },

      enterFm: (track) => {
        playerEngine.enterFm(track);
        get().sync();
      },
      exitFm: () => {
        const t = playerEngine.exitFm();
        get().sync();
        return t;
      },
      appendFm: (tracks) => {
        playerEngine.appendFm(tracks);
        get().sync();
      },
      removeFmCurrent: () => {
        const t = playerEngine.removeFmCurrent();
        get().sync();
        return t;
      },

      currentTrack: () => playerEngine.currentTrack(),
      isFmActive: () => playerEngine.isFmActive(),
      isEnded: () => playerEngine.isEnded(),
      snapshot: () => playerEngine.snapshot(),

      restore: (snapshot) => {
        // 重建引擎并替换单例引用（各 action 经闭包引用同一 binding，替换后自动生效）
        playerEngine = QueueEngine.fromSnapshot(snapshot);
        useQueueStore.setState(fromEnginePartial());
      },
    }),
    {
      name: 'player_queue',
      storage: createJSONStorage(() => TauriStorage),
      partialize: (state) => ({
        queue: state.queue,
        currentIndex: state.currentIndex,
        order: state.order,
        repeat: state.repeat,
        contentSource: state.contentSource,
        fmPlayedIds: state.fmPlayedIds,
      }),
      skipHydration: true,
    },
  ),
);
