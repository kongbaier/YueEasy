// Phase E：Rust 播放器 IPC/事件 wire 类型（与 `src-tauri/src/state.rs` / `cmd/player.rs` 精确对齐）。
// 前端禁止再做字段级映射；字段名即 IPC wire 名。

import type { QueueItem, Song } from './entities';

/** Track = Song 实体的别名（兼容旧 import）。 */
export type Track = Song;

/** Rust `core::types::Order`：遍历顺序（正交轴 1）。 */
export type Order = 'sequential' | 'shuffle';

/** Rust `core::types::Repeat`：终止策略（正交轴 2）。 */
export type RepeatMode = 'off' | 'all' | 'one';

/** Rust `core::types::ContentSource` 的 snake_case wire 名（内容来源，正交轴 3）。 */
export type RustContentSource = 'queue' | 'personal_fm';

/** 播放查询命令返回：当前曲目 + 已解析播放地址（`resolve_play_url` 预加载用；播放命令已不返回此值）。 */
export interface PlayUrlInfo {
  track: QueueItem;
  url: string;
}

/** Rust `core::types::PlayerSnapshot` wire 镜像（get_player_snapshot / get_full_player_state）。
 *  正交化：`order`（遍历顺序）+ `repeat`（终止策略）+ `content_source`（内容来源）。 */
export interface PlayerSnapshot {
  queue: QueueItem[];
  current_index: number | null;
  order: Order;
  repeat: RepeatMode;
  content_source: RustContentSource;
  /** FM 已播 id 列表（content_source == 'personal_fm' 时累计；其他源时为空）。 */
  fm_played_ids: number[];
}

/** `get_full_player_state` 返回：快照 + 当前曲目（启动恢复用，设计 §7）。 */
export interface FullPlayerState {
  snapshot: PlayerSnapshot;
  current_track: QueueItem | null;
}

/**
 * `player:event` 单通道推送（serde tag+content，`state.rs::PlayerEvent` 精确镜像）。
 * 精简为 3 条核心：current（当前曲+索引+来源+顺序+策略）/ queue（队列全量）/ playing（播放状态）。
 */
export type PlayerEventPayload =
  | {
      event: 'player:current';
      data: {
        track: QueueItem | null;
        index: number | null;
        source: RustContentSource;
        order: Order;
        repeat: RepeatMode;
      };
    }
  | {
      event: 'player:queue';
      data: { items: QueueItem[]; current_index: number | null };
    }
  | { event: 'player:playing'; data: { playing: boolean } };
