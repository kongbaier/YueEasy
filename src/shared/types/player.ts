// Phase E：Rust 播放器 IPC/事件 wire 类型（与 `src-tauri/src/state.rs` / `cmd/player.rs` 精确对齐）。
// 前端禁止再做字段级映射；字段名即 IPC wire 名。

import type { QueueItem, Song } from './entities';

// ── UI 概念（与 Rust wire 严格区分）──

/** UI 显示用迭代策略。故意与 RustPlayMode 不同：UI 用 camelCase 名，wire 用 snake_case。 */
export const PlayModes = ['sequential', 'shuffle', 'repeatOne', 'repeatAll'] as const;
export type PlayMode = (typeof PlayModes)[number];

/** Track = Song 实体的别名（兼容旧 import）。 */
export type Track = Song;

/** Rust wire → UI 映射。loop_one → repeatOne；loop_all → repeatAll；sequential/shuffle 直通。 */
export function rustPlayModeToUi(rust: RustPlayMode): PlayMode {
  if (rust === 'loop_one') return 'repeatOne';
  if (rust === 'loop_all') return 'repeatAll';
  return rust;
}

/** Rust `core::types::PlayMode` 的 snake_case wire 名（4 种迭代策略）。 */
export type RustPlayMode = 'sequential' | 'loop_all' | 'loop_one' | 'shuffle';

/** Rust `core::types::ContentSource` 的 snake_case wire 名（内容来源）。 */
export type RustContentSource = 'queue' | 'personal_fm';

/** 播放命令返回：当前曲目 + 已解析播放地址（设计 §4.4，切歌无间断优先）。 */
export interface PlayUrlInfo {
  track: QueueItem;
  url: string;
}

/** Rust `core::types::PlayerSnapshot` wire 镜像（get_player_snapshot / get_full_player_state）。
 *  硬切换：旧 `mode` / `fm_active` 字段删除，新字段 `iteration_strategy` + `content_source`。 */
export interface PlayerSnapshot {
  queue: QueueItem[];
  current_index: number | null;
  iteration_strategy: RustPlayMode;
  content_source: RustContentSource;
  /** FM 已播 id 列表（content_source == 'personal_fm' 时累计；其他源时为空）。 */
  fm_played_ids: number[];
  /** 前端上报的当前播放位置（秒）。仅供重启恢复。 */
  position_secs: number;
  /** 前端上报的播放/暂停状态（上次已知）。仅供重启恢复。 */
  playing: boolean;
}

/** `get_full_player_state` 返回：快照 + 当前曲目（启动恢复用，设计 §7）。 */
export interface FullPlayerState {
  snapshot: PlayerSnapshot;
  current_track: QueueItem | null;
}

/**
 * `player:event` 单通道推送（serde tag+content，`state.rs::PlayerEvent` 精确镜像）。
 * 枚举 tag（即 `player:*`）即事件名，前端按 tag 分发到 MirrorStore。
 */
export type PlayerEventPayload =
  | { event: 'player:track-changed'; data: { track: QueueItem } }
  | {
      event: 'player:queue-changed';
      data: { items: QueueItem[]; current_index: number | null };
    }
  | {
      event: 'player:iteration-strategy-changed';
      data: { iteration_strategy: RustPlayMode };
    }
  | {
      event: 'player:content-source-changed';
      data: { source: RustContentSource };
    }
  | { event: 'player:seek-to'; data: { position_secs: number } }
  | { event: 'player:queue-ended'; data?: never };
