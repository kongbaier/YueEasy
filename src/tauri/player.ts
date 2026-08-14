// 播放器 IPC 命令唯一入口（infra 层，对齐 AGENTS.md：ui/hooks/store 不直接 invoke）。
// 封装 `cmd/player.rs` / `cmd/query.rs` 全部播放器命令；Tauri v2 顶层参数 camelCase。

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { QueueItem } from '@/shared/types/entities';
import type {
  FullPlayerState,
  PlayUrlInfo,
  PlayerEventPayload,
  PlayerSnapshot,
  RepeatMode,
  RustContentSource,
} from '@/shared/types/player';

// ── 播放控制 ──

export function playTrack(track: QueueItem): Promise<void> {
  return invoke('play_track', { track });
}

export function replaceAndPlay(
  tracks: QueueItem[],
  startIndex?: number,
): Promise<void> {
  return invoke('replace_and_play', { tracks, startIndex });
}

export function playQueueAt(index: number): Promise<void> {
  return invoke('play_queue_at', { index });
}

export function playNext(): Promise<void> {
  return invoke('play_next');
}

export function playPrev(): Promise<void> {
  return invoke('play_prev');
}

/** FM 垃圾桶上报 + 推进下一首。 */
export function fmTrash(): Promise<void> {
  return invoke('fm_trash');
}

export function play(): Promise<void> {
  return invoke('play');
}

export function pause(): Promise<void> {
  return invoke('pause');
}

/** 跳转到指定位置（前端松手提交；Rust 音频引擎为 seek 权威）。 */
export function seek(positionSecs: number): Promise<void> {
  return invoke('seek', { positionSecs });
}

/** 设置音量（0.0..=1.0）。 */
export function setVolume(volume: number): Promise<void> {
  return invoke('set_volume', { volume });
}

/** 设置终止策略（"off" / "all" / "one"）。 */
export function setRepeat(repeat: RepeatMode): Promise<void> {
  return invoke('set_repeat', { repeat });
}

/** 设置遍历顺序（随机播放开关）。 */
export function setShuffle(shuffle: boolean): Promise<void> {
  return invoke('set_shuffle', { shuffle });
}

/** 切换内容来源（"queue" / "personal_fm"）。 */
export function setContentSource(source: RustContentSource): Promise<void> {
  return invoke('set_content_source', { source });
}

// ── 队列操作 ──

export function appendToQueue(tracks: QueueItem[]): Promise<void> {
  return invoke('append_to_queue', { tracks });
}

export function insertNext(track: QueueItem): Promise<void> {
  return invoke('insert_next', { track });
}

export function removeFromQueue(index: number): Promise<void> {
  return invoke('remove_from_queue', { index });
}

export function clearQueue(): Promise<void> {
  return invoke('clear_queue');
}

// ── 查询 / 恢复 ──

/** 查询当前播放位置/状态（前端进度条周期校准用；返回 (position_secs, playing)）。 */
export function getPosition(): Promise<[number, boolean]> {
  return invoke('get_position');
}

/** 启动恢复：Rust 端恢复上次快照对应的音频播放（resolve URL + seek）。 */
export function restorePlayback(): Promise<void> {
  return invoke('restore_playback');
}

/** 全量播放器状态（快照 + 当前曲目，启动恢复用）。 */
export function getFullPlayerState(): Promise<FullPlayerState> {
  return invoke('get_full_player_state');
}

/** 全量快照（WebView 重载恢复用）。 */
export function getPlayerSnapshot(): Promise<PlayerSnapshot> {
  return invoke('get_player_snapshot');
}

/** 获取完整队列（可选，通常用 queue-changed 事件）。 */
export function getQueue(): Promise<QueueItem[]> {
  return invoke('get_queue');
}

/** 解析播放 URL（预加载用）。 */
export function resolvePlayUrl(
  trackId: number,
  quality?: string | null,
): Promise<PlayUrlInfo> {
  return invoke('resolve_play_url', { trackId, quality: quality ?? null });
}

// ── 事件（Rust `player:event` 单通道推送，serde tag 即事件名） ──

/** 订阅播放器状态事件（track/queue/strategy/source/status/queue-ended）。返回取消订阅函数。 */
export function onPlayerEvent(
  cb: (payload: PlayerEventPayload) => void,
): Promise<UnlistenFn> {
  return listen<PlayerEventPayload>('player:event', (event) => {
    cb(event.payload);
  });
}
