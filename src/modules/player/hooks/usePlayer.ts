import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { useLikeStore } from '@/modules/like/stores/like';
import { queueItemToSong } from '@/shared/utils/mappers';

/**
 * Player 域门面 hook：组合单一 player store + settings/auth/like 为统一输出。
 * 组件只 import 本 hook，不直接触碰 store。
 */
export function usePlayer() {
  const p = usePlayerStore(
    useShallow((s) => ({
      playing: s.playing,
      loading: s.loading,
      currentTime: s.currentTime,
      duration: s.duration,
      currentTrack: s.currentTrack,
      queue: s.queue,
      currentIndex: s.currentIndex,
      order: s.order,
      repeat: s.repeat,
      contentSource: s.contentSource,
    })),
  );
  const actions = usePlayerStore(
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
  const playerSettings = useSettingsStore((s) => s.player);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const like = useLikeStore(
    useShallow((s) => ({
      isLiked: s.isLiked,
      likedIds: s.likedIds,
    })),
  );

  const togglePlay = useCallback(() => {
    usePlayerStore.getState().toggle();
  }, []);

  const seek = useCallback((time: number) => {
    usePlayerStore.getState().seek(time);
  }, []);

  const setVolume = useCallback((volume: number) => {
    usePlayerStore.getState().setVolume(volume);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    usePlayerStore.getState().setMuted(muted);
  }, []);

  const cycleRepeat = useCallback(() => {
    usePlayerStore.getState().cycleRepeat();
  }, []);

  const toggleShuffle = useCallback(() => {
    usePlayerStore.getState().toggleShuffle();
  }, []);

  return useMemo(
    () => ({
      playing: p.playing,
      loading: p.loading,
      currentTime: p.currentTime,
      duration: p.duration,
      currentTrack: p.currentTrack ? queueItemToSong(p.currentTrack) : null,
      queue: p.queue.map(queueItemToSong),
      queueLength: p.queue.length,
      currentIndex: p.currentIndex,
      isFm: p.contentSource === 'personal_fm',
      fmExitWillEmpty: p.contentSource !== 'personal_fm',
      canPrev:
        p.currentIndex !== null &&
        (p.contentSource !== 'personal_fm' || p.currentIndex > 0),
      order: p.order,
      repeat: p.repeat,
      isShuffle: p.order === 'shuffle',
      ...actions,
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
      p,
      actions,
      playerSettings,
      isLoggedIn,
      like,
      togglePlay,
      seek,
      setVolume,
      setMuted,
      cycleRepeat,
      toggleShuffle,
    ],
  );
}
