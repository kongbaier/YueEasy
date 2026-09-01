import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { usePlayerStore } from '@/modules/player/stores/playerStore';
import { useQueueStore } from '@/modules/player/stores/queueStore';
import { playerService } from '@/modules/player/services/PlayerService';
import { usePlayerSettingsStore } from '@/modules/player/stores/playerSettingsStore';
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
  const actions = useMemo(
    () => ({
      play: playerService.play,
      replaceAndPlay: playerService.replaceAndPlay,
      next: playerService.next,
      prev: playerService.prev,
      addToQueue: playerService.addToQueue,
      playNext: playerService.playNext,
      playFromIndex: playerService.playFromIndex,
      removeFromQueue: playerService.removeFromQueue,
      clearQueue: playerService.clearQueue,
      setContentSource: playerService.setContentSource,
      fmTrash: playerService.fmTrash,
    }),
    [],
  );
  const playerSettings = usePlayerSettingsStore((s) => s.player);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const like = useLikeStore(
    useShallow((s) => ({
      isLiked: s.isLiked,
      likedIds: s.likedIds,
    })),
  );

  const togglePlay = useCallback(() => {
    playerService.toggle();
  }, []);

  const seek = useCallback((time: number) => {
    playerService.seek(time);
  }, []);

  const setVolume = useCallback((volume: number) => {
    playerService.setVolume(volume);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    playerService.setMuted(muted);
  }, []);

  const cycleRepeat = useCallback(() => {
    playerService.cycleRepeat();
  }, []);

  const toggleShuffle = useCallback(() => {
    playerService.toggleShuffle();
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
