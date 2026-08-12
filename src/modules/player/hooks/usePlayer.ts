import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { invoke } from '@tauri-apps/api/core';
import { usePlayerStore } from '../stores/player';
import { useQueueStore } from '../stores/queue';
import { useSettingsStore } from '@/stores/settings';
import { useAuthStore } from '@/stores/auth';
import { useLikeStore } from '@/stores/like';
import { usePlayerMirrorStore } from '@/stores/playerMirror';
import { playerService } from '../services/PlayerService';
import { queueItemToSong } from '@/shared/utils/mappers';
import { rustPlayModeToUi, type RustPlayMode } from '@/shared/types/player';

/**
 * Player 域门面 hook（粗粒度）：组合 player/queue/settings/auth/like 5 个 store
 * 为统一响应式输出，供播放器所有 UI 组件消费。组件只 import 本 hook，不直接触碰 store。
 *
 * 注意：这是粗粒度门面，订阅全部 player+mirror+settings 状态。
 * 若后续出现高频重渲染问题，可按需拆分为 usePlayerTransport / usePlayerSettings / usePlayerQueue。
 */

/** Rust 播放模式循环：sequential → loop_one → shuffle → sequential（设计 §4.1）。 */
const NEXT_RUST_MODE: Record<RustPlayMode, RustPlayMode> = {
  sequential: 'loop_one',
  loop_one: 'shuffle',
  shuffle: 'sequential',
};

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
  // 写命令统一收敛到 queue store（其 action 内含 Rust 分支：invoke 获取 URL → 本地 AudioCore load/play）。
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
      enterFm: s.enterFm,
      exitFm: s.exitFm,
      fmTrash: s.fmTrash,
    })),
  );
  // Rust 引擎只读镜像：队列/当前曲目/播放模式等状态一律读此镜像（不读 queue store 状态字段）。
  // 注意：playing 不在此订阅 —— 播放/暂停是真实 AudioCore 状态，由 usePlayerStore 驱动。
  const mirror = usePlayerMirrorStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      queue: s.queue,
      queueLength: s.queue.length,
      currentIndex: s.currentIndex,
      isFm: s.fmActive,
      fmExitWillEmpty: !s.fmActive,
      canPrev: s.currentIndex !== null && s.currentIndex > 0,
      mode: s.mode,
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

  // ── 播放/暂停：两模式统一走 player store（真实 AudioCore 状态）；Rust 模式本地 AudioCore 切换 ──

  const togglePlay = useCallback(() => {
    if (usePlayerStore.getState().loading) return;
    // 不 invoke toggle_play_pause、不做 mirror 乐观翻转：AudioCore 的 play/pause
    // 事件自然驱动 usePlayerStore.playing（真实音频状态）。
    void playerService.audioCore.toggle();
  }, []);

  // ── 进度/音量 ──

  /** 进度拖动/松手提交。额外 invoke seek 同步 SMTC（设计 §5.3）。 */
  const seek = useCallback((time: number) => {
    playerService.audioCore.seek(time);
    // Tauri v2：Rust 参数 position_secs → JS 侧 camelCase `positionSecs`
    void invoke<void>('seek', { positionSecs: time });
    // seek 后去抖落盘，重启恢复才能续到新位置
    playerService.reportPositionDebounced();
  }, []);

  const setVolume = useCallback((volume: number) => {
    useSettingsStore.getState().updatePlayer({ volume });
  }, []);
  const setMuted = useCallback((muted: boolean) => {
    useSettingsStore.getState().updatePlayer({ isMuted: muted });
  }, []);

  /** 播放模式循环：invoke set_play_mode（事件推送更新镜像）。 */
  const cyclePlayMode = useCallback(() => {
    const current = usePlayerMirrorStore.getState().mode;
    void invoke<void>('set_play_mode', { mode: NEXT_RUST_MODE[current] });
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
      playMode: rustPlayModeToUi(mirror.mode),
      ...queueActions,
      togglePlay,
      seek,
      setVolume,
      setMuted,
      cyclePlayMode,
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
      cyclePlayMode,
      isLoggedIn,
      like.isLiked,
      like.likedIds,
    ],
  );
}
