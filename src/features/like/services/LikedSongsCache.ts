// 「我喜欢」查询缓存的唯一写入口：key 形状与条目重建（歌曲数同步）只在这里，
// 调用方只描述「列表怎么变」（乐观插入 / 回滚 / 延迟清除），不重复拼缓存结构。

import { queryClient } from '@/shared/lib/queryClient';
import type { Song } from '@/shared/types/uiModels';
import type { LikedSongs } from './LikedSongsService';

/** 喜欢页查询键。`userId` 为空时不会取数（`enabled` 门控），键仅用于关停。 */
export const likedSongsQueryKey = (userId: number | null) =>
  ['likedSongs', userId] as const;

/**
 * 在已有缓存上改写歌曲列表，并保持 `playlist.trackCount` 与列表一致。
 * `update` 返回原引用表示「无变化」—— 不写缓存、不触发重渲染。
 * 缓存不存在时什么都不做：没取过数的用户不该被塞进半截数据（真值等首次取数）。
 */
export function patchLikedSongs(
  userId: number | null,
  update: (songs: Song[]) => Song[],
): void {
  if (userId == null) return;

  queryClient.setQueryData<LikedSongs>(likedSongsQueryKey(userId), (old) => {
    if (!old) return old;
    const songs = update(old.songs);
    if (songs === old.songs) return old;
    return {
      ...old,
      playlist: { ...old.playlist, trackCount: songs.length },
      songs,
    };
  });
}
