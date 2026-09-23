import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { usePlayerStore } from '@/features/player/stores/playerStore';
import { useQueueStore } from '@/features/player/stores/queueStore';
import { playerService } from '@/features/player/services/PlayerService';
import { usePlayerSettingsStore } from '@/features/player/stores/playerSettingsStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useLikeStore } from '@/features/like/stores/like';
import { queueItemToSong } from '@/shared/utils/mappers';

/**
 * Player 域门面 hook：组合 queue store（低频队列/模式）+ player store（transport/编排）
 * + settings/auth/like 为统一输出。组件只 import 本 hook，不直接触碰 store。
 *
 * 高频字段（currentTime，约 4Hz 的 timeupdate）刻意**不**订阅：进度展示走
 * `useProgress()` 的细粒度 selector。否则本门面的返回对象会按 timeupdate 频率变形，
 * 把所有消费方（含队列列表/虚拟滚动）都按 4Hz 重渲染。
 */
export function usePlayer() {
  const transport = usePlayerStore(
    useShallow((s) => ({
      playing: s.playing,
      loading: s.loading,
      buffering: s.buffering,
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

  // 派生值按来源身份 memo：只有队列增删 / 切歌才重建。
  // 否则每次 transport 变化（loading/buffering 翻转）都会重映射整条队列、
  // 重造 currentTrack 对象，把新 identity 透传给所有下游组件。
  const queue = useMemo(
    () => queueView.queue.map(queueItemToSong),
    [queueView.queue],
  );
  const currentTrack = useMemo(
    () =>
      transport.currentTrack ? queueItemToSong(transport.currentTrack) : null,
    [transport.currentTrack],
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

  return {
    playing: transport.playing,
    loading: transport.loading,
    buffering: transport.buffering,
    duration: transport.duration,
    currentTrack,
    queue,
    queueLength: queue.length,
    currentIndex: queueView.currentIndex,
    isFm: queueView.contentSource === 'personal_fm',
    fmExitWillEmpty: queueView.contentSource !== 'personal_fm',
    canPrev:
      queueView.currentIndex !== null &&
      (queueView.contentSource !== 'personal_fm' || queueView.currentIndex > 0),
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
  };
}
