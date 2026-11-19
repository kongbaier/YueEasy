import type { QueueItem } from '@/shared/types/uiModels';
import { create } from 'zustand';

// playerStore —— 播放 transport 状态（纯状态容器，无编排）。
//
// 编排（URL 解析 / FM 续歌 / ended / next 决策）在 PlayerService；
// 本 store 只承载 60fps 投影状态，由 PlayerService 订阅 audioCore 事件后 setState 写入。
// 组件经 usePlayer 门面读取；命令经 playerService 发起，store 不暴露任何 action。

export interface PlayerState {
  currentTrack: QueueItem | null;
  playing: boolean;
  loading: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  /**
   * 当前曲目**实际到手**的音质档位（本地缓存命中时 = 该文件的档位）。
   *
   * 与服务端返回一致，因此可能低于设置里请求的档位（非 VIP 请求无损 → `exhigh`）。
   * 解析前为 `null`（UI 此时退回展示请求档位）。
   */
  quality: string | null;
  /** 当前曲目的实际码率（bps）；未知为 `null`。 */
  bitrate: number | null;
}

export const usePlayerStore = create<PlayerState>()(() => ({
  currentTrack: null,
  playing: false,
  loading: false,
  buffering: false,
  currentTime: 0,
  duration: 0,
  quality: null,
  bitrate: null,
}));
