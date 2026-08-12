import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { PlayUrlInfo } from '@/shared/types/player';
import { usePlayerMirrorStore } from '@/stores/playerMirror';
import { playerService } from '../services/PlayerService';
import { usePlayerStore } from '../stores/player';

/**
 * 媒体键 / 键盘 Space 播放控制的 Rust 模式门面。
 *
 * 直连 audioCore——队列/进度都活在 Rust 引擎，TS 队列层已移除。
 * 播放状态一律由 audioCore 的 play/pause 事件驱动，本层不翻转 `playing`。
 */

export function useMediaControls() {
  /** 开始/恢复播放：直连 audioCore.play()；无可用源（idle/error）时按 rustLoadAndPlay 模式重新解析 URL。 */
  const handlePlay = useCallback(async () => {
    const audio = playerService.audioCore;
    if (usePlayerStore.getState().loading) return;
    if (audio.state === 'idle' || audio.state === 'error') {
      // 没有已加载的源：镜像 rustLoadAndPlay（invoke resolve_play_url → load → play）
      const trackId = usePlayerMirrorStore.getState().currentTrack?.track_id;
      if (trackId == null) return;
      try {
        // Tauri v2：Rust 参数 track_id → JS 侧必须 camelCase `trackId`
        const { url } = await invoke<PlayUrlInfo>('resolve_play_url', {
          trackId,
          quality: null,
        });
        await audio.load(url);
        await audio.play();
      } catch (err) {
        console.warn('[useMediaControls] 播放失败:', err);
      }
      return;
    }
    try {
      // audioCore 自己保留暂停位置，直接续播
      await audio.play();
    } catch (err) {
      // 无手势的媒体键 resume 可能被 AudioContext 手势策略拦截；不翻转状态
      console.warn('[useMediaControls] play() 被拒绝:', err);
    }
  }, []);

  const handlePause = useCallback(() => {
    playerService.audioCore.pause();
  }, []);

  /** 与 usePlayer.togglePlay 相同：loading 守卫 + audioCore.toggle。 */
  const handleToggle = useCallback(() => {
    if (usePlayerStore.getState().loading) return;
    void playerService.audioCore.toggle();
  }, []);

  return { handlePlay, handlePause, handleToggle };
}
