// 系统媒体会话服务（模块就近）：SMTC 元数据/状态/位置更新 + 媒体键事件订阅。
// 薄转发 `@/tauri/mediaSession`（infra），事件类型在其定义。

import {
  onMediaSessionEvent as tauriOnMediaSessionEvent,
  updateMediaSessionMetadata as tauriUpdateMetadata,
  updateMediaSessionPosition as tauriUpdatePosition,
  updateMediaSessionStatus as tauriUpdateStatus,
  type MediaSessionEvent,
  type MediaSessionMetadata,
} from '@/tauri/mediaSession';
import type { UnlistenFn } from '@tauri-apps/api/event';

export type { MediaSessionEvent, MediaSessionMetadata };

export function updateMetadata(meta: MediaSessionMetadata): Promise<void> {
  return tauriUpdateMetadata(meta);
}

export function updateStatus(playing: boolean): Promise<void> {
  return tauriUpdateStatus(playing);
}

export function updatePosition(positionSecs: number): Promise<void> {
  return tauriUpdatePosition(positionSecs);
}

/** 订阅 OS 媒体键事件。返回取消订阅函数。 */
export function onMediaSessionEvent(
  cb: (event: MediaSessionEvent) => void,
): Promise<UnlistenFn> {
  return tauriOnMediaSessionEvent(cb);
}
