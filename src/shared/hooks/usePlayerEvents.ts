// Phase E：注册 `player:event` 单通道监听，把 Rust 推送的状态增量写入 MirrorStore（设计 §5.2）。
// 挂载点：PlayerBar（应用常驻）。仅在 Rust 引擎启用（VITE_USE_RUST_PLAYER=true）时有意义，
// 但监听本身无副作用，常驻注册成本可忽略。

import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { usePlayerMirrorStore } from '@/stores/playerMirror';
import type { PlayerEventPayload } from '@/shared/types/player';

export function usePlayerEvents(): void {
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    listen<PlayerEventPayload>('player:event', (event) => {
      const payload = event.payload;
      switch (payload.event) {
        case 'player:track-changed':
          usePlayerMirrorStore.setState({ currentTrack: payload.data.track });
          break;
        case 'player:queue-changed':
          usePlayerMirrorStore.setState({
            queue: payload.data.items,
            currentIndex: payload.data.current_index,
            queueEnded: false, // 队列变化时清 ended 标志
          });
          break;
        case 'player:iteration-strategy-changed':
          usePlayerMirrorStore.setState({
            iterationStrategy: payload.data.iteration_strategy,
          });
          break;
        case 'player:content-source-changed':
          usePlayerMirrorStore.setState({ contentSource: payload.data.source });
          break;
        case 'player:seek-to':
          // 可选事件：SMTC seek 回传，暂不映射到 MirrorStore（Phase F 再评估）。
          break;
        case 'player:queue-ended':
          usePlayerMirrorStore.setState({ queueEnded: true });
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
