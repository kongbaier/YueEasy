// useQueueStore —— 队列权威 store（低频、持久化）。
//
// 持有两条独立内容源 policy：QueuePolicy（用户队列）+ FmPolicy（推荐流）+ 活动源标记。
// 与旧 QueueEngine（单引擎 + stash 存用户队列）不同：两条队列各自独立持状态，切换只换
// 当前引用，任一方的队列 / 模式都不丢。用库 policy 的 Track 承接，内做 QueueItem ↔ Track 适配。
//
// 路由规则（对齐旧行为）：
//   · 用户队列操作（playTrack/replacePlay/playQueueAt/append/insertNext/removeAt/clear/
//     setRepeat/setOrder）→ 作用于 queuePolicy；若当前在 FM 先切回 queue（旧 exitFm 语义）。
//   · 导航（manualNext/onTrackEnd/prev/restart）与只读（currentTrack/currentIndex/repeat）→ 活动源。
//   · FM 专属（enterFm/exitFm/appendFm/removeFmCurrent）→ fmPolicy。
//
// 持久化在低频本 store（plugin-store），与 60fps transport 解耦。

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { QueueItem } from '@/shared/types/entities';
import { QueuePolicy } from '@/modules/player/core/policy/queue';
import { FmPolicy } from '@/modules/player/core/policy/fm';
import type { Track } from '@/shared/lib/player-core/models/track';
import type { Order, Repeat } from '@/modules/player/core/types';
import { TauriStorage } from '@/tauri/storage';

/** 内容来源（适配层正交轴，沿用旧语义）。 */
export type ContentSource = 'queue' | 'personal_fm';

/** 导航决策结果（适配层语义，与旧引擎一致：上层据 contentSource 决定 End 后停或续歌）。 */
export type Step =
  | { type: 'play'; index: number }
  | { type: 'replayCurrent' }
  | { type: 'end' };

// ── 两条来源 policy（模块级单例，切换只换引用，各自持队列） ──
export const queuePolicy = new QueuePolicy();
export const fmPolicy = new FmPolicy();

function queueItemToTrack(item: QueueItem): Track {
  const { track_id, ...rest } = item;
  return { id: String(track_id), src: '', ...rest };
}

function trackToQueueItem(t: Track): QueueItem {
  return {
    track_id: Number(t.id),
    title: (t.title as string) ?? '',
    artist: (t.artist as string) ?? '',
    album: (t.album as string) ?? '',
    cover_url: (t.cover_url as string) ?? '',
    duration_secs: (t.duration_secs as number) ?? 0,
  };
}

// ── 持久化快照（两条队列分别保存，FM 期间用户队列不丢） ──
export interface QueueSnapshot {
  contentSource: ContentSource;
  queue: QueueItem[];
  currentIndex: number | null;
  order: Order;
  repeat: Repeat;
  fmQueue: QueueItem[];
  fmIndex: number | null;
  fmRepeat: Repeat;
  fmPlayedIds: number[];
}

/** 从两条 policy 组装快照（纯函数，不引用 store，避免循环初始化）。 */
function buildSnapshot(contentSource: ContentSource): QueueSnapshot {
  return {
    contentSource,
    queue: queuePolicy.tracks.map(trackToQueueItem),
    currentIndex: queuePolicy.currentIndex(),
    order: queuePolicy.order(),
    repeat: queuePolicy.repeatValue(),
    fmQueue: fmPolicy.tracks.map(trackToQueueItem),
    fmIndex: fmPolicy.currentIndex(),
    fmRepeat: fmPolicy.repeatValue(),
    fmPlayedIds: [],
  };
}

function restoreFrom(snap: QueueSnapshot): void {
  queuePolicy.replacePlay(
    snap.queue.map(queueItemToTrack),
    snap.currentIndex ?? 0,
  );
  queuePolicy.setOrder(snap.order);
  queuePolicy.setRepeat(snap.repeat);
  fmPolicy.seedFrom(snap.fmQueue.map(queueItemToTrack), snap.fmIndex ?? 0);
  fmPolicy.setRepeat(snap.fmRepeat);
}

export interface QueueState {
  // 引擎镜像（低频）
  queue: QueueItem[];
  currentIndex: number | null;
  order: Order;
  repeat: Repeat;
  contentSource: ContentSource;
  fmPlayedIds: number[];

  // ── 用户队列操作（作用于 queuePolicy，FM 时先切回 queue） ──
  playTrack: (track: QueueItem) => QueueItem | null;
  replacePlay: (
    tracks: QueueItem[],
    startIndex?: number | null,
  ) => QueueItem | null;
  playQueueAt: (index: number) => QueueItem | null;
  append: (tracks: QueueItem[]) => void;
  insertNext: (track: QueueItem) => void;
  removeAt: (index: number) => void;
  clear: () => void;
  setRepeat: (repeat: Repeat) => void;
  setOrder: (order: Order) => void;

  // ── 导航（返回 Step，供编排层取曲 + 播放；作用于活动源） ──
  manualNext: () => Step;
  onTrackEnd: () => Step;
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
  snapshot: () => QueueSnapshot;
  restore: (snapshot: QueueSnapshot) => void;
}

/** 活动源 policy（queue / fm）。 */
function activePolicyOf(source: ContentSource): QueuePolicy | FmPolicy {
  return source === 'personal_fm' ? fmPolicy : queuePolicy;
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => {
      // 把给定 policy 的低频字段镜像进 store（活动源变更 / 导航 / 队列变更后调用）。
      const mirror = (policy: QueuePolicy | FmPolicy) =>
        set({
          queue: policy.tracks.map(trackToQueueItem),
          currentIndex: policy.currentIndex(),
          order: policy instanceof FmPolicy ? 'sequential' : policy.order(),
          repeat: policy.repeatValue(),
        });

      // 用户队列操作前置：若在 FM 先切回 queue。
      const ensureQueue = () => {
        if (get().contentSource !== 'personal_fm') return;
        set({ contentSource: 'queue' });
        mirror(queuePolicy);
      };

      return {
        queue: [],
        currentIndex: null,
        order: 'sequential' as Order,
        repeat: 'off' as Repeat,
        contentSource: 'queue' as ContentSource,
        fmPlayedIds: [],

        playTrack: (track) => {
          ensureQueue();
          const t = queuePolicy.playTrack(queueItemToTrack(track));
          mirror(queuePolicy);
          return t ? trackToQueueItem(t) : null;
        },
        replacePlay: (tracks, startIndex) => {
          ensureQueue();
          const t = queuePolicy.replacePlay(
            tracks.map(queueItemToTrack),
            startIndex ?? 0,
          );
          mirror(queuePolicy);
          return t ? trackToQueueItem(t) : null;
        },
        playQueueAt: (index) => {
          ensureQueue();
          const t = queuePolicy.playQueueAt(index);
          mirror(queuePolicy);
          return t ? trackToQueueItem(t) : null;
        },
        append: (tracks) => {
          ensureQueue();
          queuePolicy.append(tracks.map(queueItemToTrack));
          mirror(queuePolicy);
        },
        insertNext: (track) => {
          ensureQueue();
          queuePolicy.insertNext(queueItemToTrack(track));
          mirror(queuePolicy);
        },
        removeAt: (index) => {
          ensureQueue();
          queuePolicy.removeAt(index);
          mirror(queuePolicy);
        },
        clear: () => {
          ensureQueue();
          queuePolicy.clear();
          mirror(queuePolicy);
        },
        setRepeat: (repeat) => {
          const p = activePolicyOf(get().contentSource);
          p.setRepeat(repeat);
          mirror(p);
        },
        setOrder: (order) => {
          const p = activePolicyOf(get().contentSource);
          if (p instanceof FmPolicy) return; // FM 强制顺序，禁用随机
          (p as QueuePolicy).setOrder(order);
          mirror(p);
        },

        manualNext: () => {
          const p = activePolicyOf(get().contentSource);
          const t = p.next();
          mirror(p);
          if (t == null) return { type: 'end' };
          return { type: 'play', index: p.currentIndex() ?? 0 };
        },
        onTrackEnd: () => {
          const p = activePolicyOf(get().contentSource);
          const before = p.currentIndex();
          const t = p.handleAutoNext();
          mirror(p);
          if (t == null) return { type: 'end' };
          if (p.currentIndex() === before) return { type: 'replayCurrent' };
          return { type: 'play', index: p.currentIndex() ?? 0 };
        },
        prev: () => {
          const p = activePolicyOf(get().contentSource);
          const t = p.previous();
          mirror(p);
          return t ? trackToQueueItem(t) : null;
        },
        restart: () => {
          const p = activePolicyOf(get().contentSource);
          const t = p.restart();
          mirror(p);
          return t ? trackToQueueItem(t) : null;
        },

        enterFm: (track) => {
          set({ contentSource: 'personal_fm' });
          fmPolicy.seed(queueItemToTrack(track));
          mirror(fmPolicy);
        },
        exitFm: () => {
          set({ contentSource: 'queue' });
          mirror(queuePolicy);
          const cur = queuePolicy.current();
          return cur ? trackToQueueItem(cur) : null;
        },
        appendFm: (tracks) => {
          if (get().contentSource !== 'personal_fm') return;
          fmPolicy.append(tracks.map(queueItemToTrack));
          mirror(fmPolicy);
        },
        removeFmCurrent: () => {
          if (get().contentSource !== 'personal_fm') return null;
          const t = fmPolicy.removeCurrent();
          mirror(fmPolicy);
          return t ? trackToQueueItem(t) : null;
        },

        currentTrack: () => {
          const p = activePolicyOf(get().contentSource);
          const t = p.current();
          return t ? trackToQueueItem(t) : null;
        },
        isFmActive: () => get().contentSource === 'personal_fm',
        isEnded: () => activePolicyOf(get().contentSource).isExhausted,
        snapshot: () => buildSnapshot(get().contentSource),
        restore: (snap) => {
          restoreFrom(snap);
          set({
            contentSource: snap.contentSource,
            queue: snap.queue,
            currentIndex: snap.currentIndex,
            order: snap.order,
            repeat: snap.repeat,
            fmPlayedIds: snap.fmPlayedIds,
          });
        },
      };
    },
    {
      name: 'player_queue',
      storage: createJSONStorage(() => TauriStorage),
      // 持久化两条队列（FM 期间用户队列不丢）。shape 即 QueueSnapshot。
      partialize: (state) => ({
        contentSource: state.contentSource,
        queue: queuePolicy.tracks.map(trackToQueueItem),
        currentIndex: queuePolicy.currentIndex(),
        order: queuePolicy.order(),
        repeat: queuePolicy.repeatValue(),
        fmQueue: fmPolicy.tracks.map(trackToQueueItem),
        fmIndex: fmPolicy.currentIndex(),
        fmRepeat: fmPolicy.repeatValue(),
        fmPlayedIds: [],
      }),
      skipHydration: true,
    },
  ),
);
