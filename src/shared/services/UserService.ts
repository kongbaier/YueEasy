import type { Playlist } from '@/shared/types/uiModels';
import { ncm } from '@/tauri/ncm';

/**
 * 用户歌单（跨功能共享：用户主页 `UserProfile` 消费）。
 * 过滤 `specialType === 5`（「我喜欢的音乐」这类系统歌单），它们由点赞域单独承载。
 *
 * 查询键统一为 `['userPlaylists', uid]`，用户主页与收藏切换共享同一份缓存。
 */
export async function getUserPlaylists(uid: number): Promise<Playlist[]> {
  const res = await ncm.userPlaylist(uid);
  return res.filter((p) => p.specialType !== 5);
}
