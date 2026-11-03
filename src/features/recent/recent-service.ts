import type { Song } from '@/shared/types/uiModels';
import { ncm } from '@/tauri/ncm';

/**
 * 最近播放：直接取云端「最近听过」（`play-record/song/list`）。
 *
 * 本机不再另存播放历史 —— 播放时由 `PlayerService` 通过 clientlog eapi 的
 * `startplay` 日志把记录写到云端，因此「最近播放」只有一个真相来源。
 * 未登录时页面在 viewmodel 层用 `enabled` 门禁，不会走到这里。
 */
export async function getRecentSongs(userId: number): Promise<Song[]> {
  const { list } = await ncm.recentSong(userId);
  return list.map((item) => item.song);
}
