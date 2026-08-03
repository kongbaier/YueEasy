import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { usePlayerStore } from '../stores/player';
import { useQueueStore } from '../stores/queue';
import { useSettingsStore } from '@/stores/settings';
import { useAuthStore } from '@/stores/auth';
import { useLikeStore } from '@/stores/like';

/**
 * Player 域门面 hook（粗粒度）：组合 player/queue/settings/auth/like 5 个 store
 * 为统一响应式输出，供播放器所有 UI 组件消费。组件只 import 本 hook，不直接触碰 store。
 *
 * 注意：这是粗粒度门面，订阅全部 player+queue+settings 状态。
 * 若后续出现高频重渲染问题，可按需拆分为 usePlayerTransport / usePlayerSettings / usePlayerQueue。
 */
export function usePlayer() {
  const transport = usePlayerStore(
    useShallow((s) => ({
      playing: s.playing,
      loading: s.loading,
      currentTime: s.currentTime,
      duration: s.duration,
      pause: s.pause,
      resume: s.resume,
      seek: s.seek,
    })),
  );
  const queue = useQueueStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      queue: s.queue,
      queueLength: s.queueLength,
      isFm: s.isFm,
      fmExitWillEmpty: s.fmExitWillEmpty,
      canPrev: s.canPrev,
      play: s.play,
      replaceAndPlay: s.replaceAndPlay,
      next: s.next,
      prev: s.prev,
      addToQueue: s.addToQueue,
      playNext: s.playNext,
      playFromIndex: s.playFromIndex,
      removeFromQueue: s.removeFromQueue,
      clearQueue: s.clearQueue,
      enterFm: s.enterFm,
      exitFm: s.exitFm,
      fmTrash: s.fmTrash,
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

  const togglePlay = useCallback(() => {
    const state = usePlayerStore.getState();
    if (state.loading) return;
    if (state.playing) state.pause();
    else void state.resume();
  }, []);

  const setVolume = useCallback((volume: number) => {
    useSettingsStore.getState().updatePlayer({ volume });
  }, []);
  const setMuted = useCallback((muted: boolean) => {
    useSettingsStore.getState().updatePlayer({ isMuted: muted });
  }, []);
  const cyclePlayMode = useCallback(() => {
    useSettingsStore.getState().cyclePlayMode();
  }, []);

  return useMemo(
    () => ({
      ...transport,
      ...queue,
      volume: playerSettings.volume,
      isMuted: playerSettings.isMuted,
      playMode: playerSettings.playMode,
      togglePlay,
      setVolume,
      setMuted,
      cyclePlayMode,
      isLoggedIn,
      isLiked: like.isLiked,
      likedIds: like.likedIds,
    }),
    [
      transport,
      queue,
      playerSettings,
      togglePlay,
      setVolume,
      setMuted,
      cyclePlayMode,
      isLoggedIn,
      like.isLiked,
      like.likedIds,
    ],
  );
}
