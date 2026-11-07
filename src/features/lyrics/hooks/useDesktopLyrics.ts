import { useCallback } from 'react';
import { usePlayerSettingsStore } from '@/features/player/stores/playerSettingsStore';
import { desktopLyricsService } from '../desktop-lyrics-service';

/**
 * 桌面歌词门面（主窗口）：开关 / 锁定状态 + 命令。
 * PlayerBar 的 `LyricsToggle` 只认这个 hook，不直接碰 service / 设置 store。
 *
 * 排版设置（字号 / 上下句亮度 / 翻译）在桌面歌词窗口自己的设置面板里改，
 * 经 request 回到主窗口落 settings —— 这里不展开。
 */
export function useDesktopLyrics() {
  const enabled = usePlayerSettingsStore((s) => s.player.desktopLyrics.enabled);
  const locked = usePlayerSettingsStore((s) => s.player.desktopLyrics.locked);

  const enable = useCallback(() => {
    void desktopLyricsService.setEnabled(true);
  }, []);

  const disable = useCallback(() => {
    void desktopLyricsService.setEnabled(false);
  }, []);

  const toggle = useCallback(() => {
    void desktopLyricsService.setEnabled(
      !usePlayerSettingsStore.getState().player.desktopLyrics.enabled,
    );
  }, []);

  const setLocked = useCallback((value: boolean) => {
    void desktopLyricsService.setLocked(value);
  }, []);

  return { enabled, locked, enable, disable, toggle, setLocked };
}
