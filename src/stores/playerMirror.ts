// Phase E：Player MirrorStore —— 纯镜像 Rust PlayerEngine 状态（设计 §5.2）。
// 只读、不定义任何 action：事件同步全部由 `usePlayerEvents` hook 处理
// （监听 `player:event` → setState），其他组件只读订阅。
//
// 音频迁移 Rust 后：`playing` 权威移到 `usePlayerStore`（modules/player/stores/player），
// 由 `player:status-changed` 事件 + 周期校准驱动；本镜像不再持有播放状态。

import { create } from "zustand";
import type { QueueItem } from "@/shared/types/entities";
import type {
  Order,
  RepeatMode,
  RustContentSource,
} from "@/shared/types/player";

export interface PlayerMirrorState {
  /** 当前曲目（Rust wire 类型 QueueItem）。 */
  currentTrack: QueueItem | null;
  /** 完整队列（全量推送，前端不做合并）。 */
  queue: QueueItem[];
  /** 当前队列索引。 */
  currentIndex: number | null;
  /** 遍历顺序（Rust `order`：sequential / shuffle）。 */
  order: Order;
  /** 终止策略（Rust `repeat`：off / all / one）。 */
  repeat: RepeatMode;
  /** 内容来源（Rust `content_source`：queue / personal_fm）。 */
  contentSource: RustContentSource;
}

/** 初始值全部为空；仅在 `player:event` 推送时由 `usePlayerEvents` 写入。 */
export const usePlayerMirrorStore = create<PlayerMirrorState>(() => ({
  currentTrack: null,
  queue: [],
  currentIndex: null,
  order: "sequential",
  repeat: "off",
  contentSource: "queue",
}));
