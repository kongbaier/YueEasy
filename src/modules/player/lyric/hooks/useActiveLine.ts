import { useEffect, useState } from 'react';
import type { LyricLine } from '@/modules/player/lyric/parser';
import { audioCore } from '@/shared/lib/audio/AudioCore';

/**
 * Per-frame word state for the ACTIVE lyric line only.
 *
 * 60fps 时间不走全局 store：本 hook 用 rAF 本地直读 audioCore.getPosition()，
 * 只在 active line 组件挂载期间采样（非 active 行不渲染此 hook，故不参与每帧渲染）。
 * wordIndex 与 progress 由同一时间源推导，避免「当前词」与「填充比例」边界错位。
 */
export function useActiveLine(line: LyricLine): {
  wordIndex: number;
  progress: number;
} {
  const [currentTime, setCurrentTime] = useState(() => audioCore.getPosition());

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      setCurrentTime(audioCore.getPosition());
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const words = line.words ?? [];
  const elapsed = currentTime * 1000 - line.startMs;

  let wordIndex = -1;
  let progress = 0;

  // Reverse scan for the last word whose start is reached.
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    if (elapsed < word.startMs) continue;
    wordIndex = i;
    progress = Math.min(
      Math.max((elapsed - word.startMs) / word.durationMs, 0),
      1,
    );
    break;
  }

  return { wordIndex, progress };
}
