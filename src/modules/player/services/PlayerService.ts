// 播放器查询/恢复/事件订阅服务（模块就近）：封装启动恢复、进度校准与 `player:event` 订阅。
// 薄转发 `@/tauri/player`；service 层禁止 import React Query（查询命令无状态，不涉及）。

import type { UnlistenFn } from '@tauri-apps/api/event';
import * as playerApi from '@/tauri/player';
import type { FullPlayerState, PlayerEventPayload } from '@/shared/types/player';

/** 查询当前播放位置/状态（前端进度条周期校准用；返回 (position_secs, playing)）。 */
export function getPosition(): Promise<[number, boolean]> {
  return playerApi.getPosition();
}

/** 全量播放器状态（快照 + 当前曲目，启动恢复用）。 */
export function getFullPlayerState(): Promise<FullPlayerState> {
  return playerApi.getFullPlayerState();
}

/** 启动恢复：Rust 端恢复上次快照对应的音频播放（resolve URL + seek）。 */
export function restorePlayback(): Promise<void> {
  return playerApi.restorePlayback();
}

/** 订阅播放器状态事件（track/queue/strategy/source/status/queue-ended）。返回取消订阅函数。 */
export function subscribePlayerEvents(
  cb: (payload: PlayerEventPayload) => void,
): Promise<UnlistenFn> {
  return playerApi.onPlayerEvent(cb);
}
