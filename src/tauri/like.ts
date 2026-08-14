// 点赞 IPC 命令 + 事件唯一入口（infra 层）。封装 `cmd/like.rs` 与 `liked-ids-changed` / `liked-toggled` 事件。

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ── 命令 ──

/** 登录后初始化：Rust 端拉取喜欢列表填充权威集合，返回全部 id。 */
export function likeInit(uid: number): Promise<number[]> {
  return invoke('like_init', { uid });
}

/** 点赞/取消点赞（Rust 权威；失败 throw，由调用方回滚乐观状态）。 */
export function likeToggle(id: number, like: boolean): Promise<void> {
  return invoke('like_toggle', { id, like });
}

/** 查询点赞集合（启动恢复/调试用）。 */
export function likeGetIds(): Promise<number[]> {
  return invoke('like_get_ids');
}

// ── 事件（Rust 权威集合变更推送） ──

/** 全量喜欢列表变更（`like_init` 推送）。返回取消订阅函数。 */
export function onLikedIdsChanged(
  cb: (ids: number[]) => void,
): Promise<UnlistenFn> {
  return listen<{ ids: number[] }>('liked-ids-changed', (event) => {
    cb(event.payload.ids);
  });
}

/** 单曲点赞状态切换（`like_toggle` 推送）。返回取消订阅函数。 */
export function onLikedToggled(
  cb: (trackId: number, liked: boolean) => void,
): Promise<UnlistenFn> {
  return listen<{ track_id: number; liked: boolean }>(
    'liked-toggled',
    (event) => {
      cb(event.payload.track_id, event.payload.liked);
    },
  );
}
