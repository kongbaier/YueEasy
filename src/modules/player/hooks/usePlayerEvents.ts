// 注册 `player:event` 单通道监听（事件经 PlayerService → @/tauri/player），把 Rust 推送的
// 状态增量写入 MirrorStore + usePlayerStore。
// 挂载点：PlayerBar（应用常驻）。事件精简为 3 条核心：current / queue / playing。

import { useEffect } from 'react';
import { subscribePlayerEvents } from '../services/PlayerService';
import { usePlayerMirrorStore } from '@/stores/playerMirror';
import { usePlayerStore } from '../stores/player';
import type { PlayerEventPayload } from '@/shared/types/player';

export function usePlayerEvents(): void {
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    subscribePlayerEvents((payload: PlayerEventPayload) => {
      switch (payload.event) {
        case 'player:current': {
          // 当前曲 + 索引 + 来源 + 策略（合并原 track/strategy/source/index 四类变化）
          const prevTrackId = usePlayerMirrorStore.getState().currentTrack?.track_id;
          const nextTrack = payload.data.track;
          usePlayerMirrorStore.setState({
            currentTrack: nextTrack,
            currentIndex: payload.data.index,
            iterationStrategy: payload.data.strategy,
            contentSource: payload.data.source,
          });
          // 仅当曲目变化（含清空到 null）时才重置进度（来源/策略变化不重置）
          if (nextTrack?.track_id !== prevTrackId) {
            usePlayerStore.setState({
              duration: nextTrack ? nextTrack.duration_secs : 0,
              currentTime: 0,
              currentTimeHigh: 0,
            });
          }
          break;
        }
        case 'player:queue':
          usePlayerMirrorStore.setState({
            queue: payload.data.items,
            currentIndex: payload.data.current_index,
          });
          break;
        case 'player:playing':
          usePlayerStore.setState((state) => ({
            playing: payload.data.playing,
            // 播放时清除加载态；暂停/结束不清 loading（loading 由 queue store 命令层管理失败路径）
            loading: payload.data.playing ? false : state.loading,
          }));
          break;
      }
    }).then((fn) => {
      if (cancelled) {
        fn(); // 组件已卸载：立即释放泄漏的监听
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
