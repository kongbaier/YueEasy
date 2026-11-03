import { ncm } from '@/tauri/ncm';
import type { Playlist, Song } from '@/shared/types/uiModels';
import { getPlaylistDetail } from '@/features/playlist/playlist-service';
import { useLikeStore } from '../stores/like';

/**
 * 喜欢页数据：歌单元信息（不含 tracks）+ 歌曲列表。
 * `songs` 顺序沿用歌单详情（喜欢时间倒序），末尾是 likedIds 补齐的截断部分。
 */
export interface LikedSongs {
  playlist: Playlist;
  songs: Song[];
}

/** `song/detail` 单次 ids 上限的保守切块。 */
const DETAIL_CHUNK = 200;

/** 批量取歌曲元数据（补齐详情快照没覆盖到的 id）。 */
async function fetchSongsByIds(ids: number[]): Promise<Song[]> {
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += DETAIL_CHUNK) {
    chunks.push(ids.slice(i, i + DETAIL_CHUNK));
  }
  const pages = await Promise.all(chunks.map((chunk) => ncm.songDetail(chunk)));
  return pages.flat();
}

/**
 * 「我喜欢」取数：歌单详情提供 **顺序与元信息**（名称 / 封面 / 评论数 / 播放数）+ 歌曲快照，
 * likeStore 的权威集合 `likedIds`（Rust `like_init` 拉取 + `liked-toggled` 校正）只用来**补齐**：
 * 详情 tracks 可能被截断，在 `likedIds` 里但快照没覆盖到的 id 用 `song/detail` 补拉。
 *
 * 不按 likedIds 反向过滤快照：集合只反映本客户端的点赞事件，
 * 其它端新喜欢的歌已在服务端快照里但不在集合里，过滤会把它们误杀。
 * 「延迟清除」也不在这里：页内取消喜欢不动列表，进页时才由 viewmodel 剔除一次。
 */
export async function getLikedSongs(userId: number): Promise<LikedSongs> {
  await useLikeStore.getState().ensureInit(userId);

  const { likedIds, likedPlaylistId } = useLikeStore.getState();
  if (likedPlaylistId == null) throw new Error('未能获取「我喜欢」歌单');

  const detail = await getPlaylistDetail(likedPlaylistId);

  const songs: Song[] = [];
  const seen = new Set<number>();
  for (const song of detail.tracks ?? []) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    songs.push(song);
  }

  // 排除顺序不稳定：likedIds 来自 Rust HashSet，迭代顺序不固定；
  // 按 id 排序保证同样的数据每次得到同样的数组（structuralSharing 才能命中，不白重渲染）
  const missing = [...likedIds]
    .filter((id) => !seen.has(id))
    .toSorted((a, b) => a - b);
  if (missing.length > 0) songs.push(...(await fetchSongsByIds(missing)));

  return {
    playlist: { ...detail, tracks: undefined, trackCount: songs.length },
    songs,
  };
}
