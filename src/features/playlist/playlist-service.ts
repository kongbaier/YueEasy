import type { Playlist } from '@/shared/types/uiModels';
import { ncm } from '@/tauri/ncm';

/**
 * 歌单详情取数：直连 ncm，不做磁盘缓存。
 * 缓存语义由 React Query 独占（queryKey `['playlist', id]`），
 * 避免 service 里再手搓一套失效逻辑（曾用 trackCount 比较，恒等即永不更新）。
 */
export function getPlaylistDetail(id: number): Promise<Playlist> {
  return ncm.playlistDetail(id);
}

/** 收藏 / 取消收藏歌单（远程权威；失败由调用方回滚乐观状态）。 */
export async function setPlaylistSubscribed(
  id: number,
  subscribe: boolean,
): Promise<void> {
  await ncm.playlistSubscribe(id, subscribe);
}
