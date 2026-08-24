import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { usePlayerStore } from '@/stores/player';
import { useQueueStore } from '@/stores/queue';
import { useSettingsStore } from '@/stores/settings';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { useLikeStore } from '@/modules/like/stores/like';
import { queueItemToSong } from '@/shared/utils/mappers';

/**
 * Player 域门面 hook：组合 queue store（低频队列/模式）+ player store（transport/编排）
 * + settings/auth/like 为统一输出。组件只 import 本 hook，不直接触碰 store。
 */
export function usePlayer() {
  const transport = usePlayerStore(
    useShallow((s) => ({
      playing: s.playing,
      loading: s.loading,
      buffering: s.buffering,
      currentTime: s.currentTime,
      duration: s.duration,
      currentTrack: s.currentTrack,
    })),
  );
  const queueView = useQueueStore(
    useShallow((s) => ({
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
      playing: transport.playing,
      loading: transport.loading,
      buffering: transport.buffering,
      currentTime: transport.currentTime,
      duration: transport.duration,
      currentTrack: transport.currentTrack
        ? queueItemToSong(transport.currentTrack)
        : null,
      queue: queueView.queue.map(queueItemToSong),
      queueLength: queueView.queue.length,
      currentIndex: queueView.currentIndex,
      isFm: queueView.contentSource === 'personal_fm',
      fmExitWillEmpty: queueView.contentSource !== 'personal_fm',
      canPrev:
        queueView.currentIndex !== null &&
        (queueView.contentSource !== 'personal_fm' ||
          queueView.currentIndex > 0),
      order: queueView.order,
      repeat: queueView.repeat,
      isShuffle: queueView.order === 'shuffle',
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
      transport,
      queueView,
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
