import { useEffect } from 'react';
import { usePlayerStore } from '../stores/player';
import { getPosition } from '../services/PlayerService';

/**
 * 播放进度时钟：rAF 60fps 本地插值 currentTime/currentTimeHigh（歌词逐字高亮用），
 * 周期调 `getPosition`（PlayerService → @/tauri/player）校准（避免插值漂移）。
 * 播放状态权威在 Rust 音频引擎。
 */
export function usePlaybackClock(): void {
  useEffect(() => {
    let rafId = 0;
    let lastTs = 0;
    let calibrateId = 0;

    const calibrate = async () => {
      try {
        const [pos, playing] = await getPosition();
        usePlayerStore.setState({
          currentTime: pos,
          currentTimeHigh: pos,
          playing,
        });
      } catch {
        // 校准失败不阻断播放
      }
    };

    const tick = (ts: number) => {
      const state = usePlayerStore.getState();
      if (state.playing && lastTs > 0) {
        const next = state.currentTime + (ts - lastTs) / 1000;
        // 插值封顶到已知时长：真实解码位置在 ended 边界可能略越 duration（流式总时长
        // 与元数据不一致），若插值不封顶，两次校准间隙 currentTime 会短暂越过 duration，
        // 进度条「超出」。这是插值状态本身的上界，不是 UI 表现层 clamp。
        const capped =
          state.duration > 0 ? Math.min(next, state.duration) : next;
        usePlayerStore.setState({
          currentTime: capped,
          currentTimeHigh: capped,
        });
      }
      lastTs = ts;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    calibrateId = window.setInterval(calibrate, 500);
    void calibrate();

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(calibrateId);
    };
  }, []);
}
