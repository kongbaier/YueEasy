import type { Playlist } from '@/shared/types/uiModels';
import { ncm } from '@/tauri/ncm';

/**
 * 用户歌单（跨功能共享：我的歌单页、用户主页都消费）。
 * 过滤 `specialType === 5`（「我喜欢的音乐」这类系统歌单），它们由点赞域单独承载。
 *
 * 查询键统一为 `['userPlaylists', uid]`，两个页面共享同一份缓存。
 */
export async function getUserPlaylists(uid: number): Promise<Playlist[]> {
  const res = await ncm.userPlaylist(uid);
  return res.filter((p) => p.specialType !== 5);
}
