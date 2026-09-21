import { ncm } from '@/tauri/ncm';

/**
 * 获取「我喜欢」歌单的 id（specialType === 5，网易云内置「我喜欢的音乐」歌单）。
 *  心动模式（playmode/intelligence/list）需要它作为 pid。无则返回 null。
 */
export async function getLikedPlaylistId(uid: number): Promise<number | null> {
  const res = await ncm.userPlaylist(uid);
  return res.find((p) => p.specialType === 5)?.id ?? null;
}
