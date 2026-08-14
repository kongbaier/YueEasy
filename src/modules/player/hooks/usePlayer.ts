import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { usePlayerStore } from '../stores/player';
import { useQueueStore } from '../stores/queue';
import { useSettingsStore } from '@/stores/settings';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { useLikeStore } from '@/modules/like/stores/like';
import { usePlayerMirrorStore } from '@/stores/playerMirror';
import { queueItemToSong } from '@/shared/utils/mappers';

/**
 * Player 域门面 hook（粗粒度）：组合 player/queue/settings/auth/like 5 个 store
 * 为统一响应式输出，供播放器所有 UI 组件消费。组件只 import 本 hook，不直接触碰 store。
 *
 * 音频迁移 Rust 后：播放/暂停/seek/音量/策略等命令收敛到 store action
 * （内部经 `@/tauri/player`），本 hook 不直接 invoke；播放状态经
 * `player:status-changed` 事件 → usePlayerStore 驱动。
 */

export function usePlayer() {
  const transport = usePlayerStore(
    useShallow((s) => ({
      playing: s.playing,
      loading: s.loading,
      currentTime: s.currentTime,
      duration: s.duration,
      seek: s.seek,
    })),
  );
  // 写命令统一收敛到 queue store（其 action 内含 invoke；Rust 内部完成取 URL + 音频播放）。
  // 轻量订阅仅取 12 个 action，不订阅队列状态字段（队列状态一律读 MirrorStore 镜像）。
  const queueActions = useQueueStore(
    useShallow((s) => ({
      play: s.play,
      replaceAndPlay: s.replaceAndPlay,
      next: s.next,
      prev: s.prev,
      addToQueue: s.addToQueue,
      playNext: s.playNext,
      playFromIndex: s.playFromIndex,
      removeFromQueue: s.removeFromQueue,
      clearQueue: s.clearQueue,
      setContentSource: s.setContentSource,
      fmTrash: s.fmTrash,
    })),
  );
  // Rust 引擎只读镜像：队列/当前曲目/遍历顺序/终止策略/内容来源等状态一律读此镜像（不读 queue store 状态字段）。
  const mirror = usePlayerMirrorStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      queue: s.queue,
      queueLength: s.queue.length,
      currentIndex: s.currentIndex,
      isFm: s.contentSource === 'personal_fm',
      fmExitWillEmpty: s.contentSource !== 'personal_fm',
      canPrev: s.currentIndex !== null && s.currentIndex > 0,
      order: s.order,
      repeat: s.repeat,
    })),
  );
  const playerSettings = useSettingsStore((s) => s.player);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const like = useLikeStore(
    useShallow((s) => ({
      isLiked: s.isLiked,
      likedIds: s.likedIds,
    })),
  );

  // ── 播放/暂停/音量/策略：全部经 player store action（内部调 @/tauri/player） ──

  const togglePlay = useCallback(() => {
    usePlayerStore.getState().toggle();
  }, []);

  /** 进度拖动/松手提交。seek 权威在 Rust（同时同步 SMTC 位置）。 */
  const seek = useCallback((time: number) => {
    usePlayerStore.getState().seek(time);
  }, []);

  const setVolume = useCallback((volume: number) => {
    usePlayerStore.getState().setVolume(volume);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    usePlayerStore.getState().setMuted(muted);
  }, []);

  /** 终止策略循环（FM 下 off ↔ one）。 */
  const cycleRepeat = useCallback(() => {
    usePlayerStore.getState().cycleRepeat();
  }, []);

  /** 随机播放开关（FM 下禁用）。 */
  const toggleShuffle = useCallback(() => {
    usePlayerStore.getState().toggleShuffle();
  }, []);

  return useMemo(
    () => ({
      ...transport,
      currentTrack: mirror.currentTrack ? queueItemToSong(mirror.currentTrack) : null,
      playing: transport.playing,
      queue: mirror.queue.map(queueItemToSong),
      queueLength: mirror.queue.length,
      isFm: mirror.isFm,
      fmExitWillEmpty: mirror.fmExitWillEmpty,
      canPrev: mirror.canPrev,
      order: mirror.order,
      repeat: mirror.repeat,
      isShuffle: mirror.order === 'shuffle',
      ...queueActions,
      togglePlay,
      seek,
      setVolume,
      setMuted,
      cycleRepeat,
      toggleShuffle,
      volume: playerSettings.volume,
      isMuted: playerSettings.isMuted,
      isLoggedIn,
      isLiked: like.isLiked,
      likedIds: like.likedIds,
    }),
    [
      transport,
      queueActions,
      mirror,
      playerSettings,
      togglePlay,
      seek,
      setVolume,
      setMuted,
      cycleRepeat,
      toggleShuffle,
      isLoggedIn,
      like.isLiked,
      like.likedIds,
    ],
  );
}
