import { useCallback } from 'react';
import { usePlayerStore } from '../stores/player';

/**
 * 媒体键 / 键盘 Space 播放控制门面（音频迁移 Rust 后）。
 *
 * 播放/暂停/切歌权威全在 Rust 音频引擎：本层只转发 player store 命令
 * （内部经 `@/tauri/player`）。播放状态由 `player:status-changed` 事件驱动
 * usePlayerStore，本层不翻转 `playing`。
 */

export function useMediaControls() {
  const handlePlay = useCallback(() => {
    return usePlayerStore.getState().play();
  }, []);

  const handlePause = useCallback(() => {
    usePlayerStore.getState().pause();
  }, []);

  const handleToggle = useCallback(() => {
    usePlayerStore.getState().toggle();
  }, []);

  return { handlePlay, handlePause, handleToggle };
}
