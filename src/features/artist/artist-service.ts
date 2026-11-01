import type { ArtistAlbumPage, ArtistDetail } from '@/shared/types/uiModels';
import { ncm } from '@/tauri/ncm';

/** 歌手详情：`/api/v1/artist/{id}` 一次返回歌手本体 + 热门歌曲。 */
export function getArtistDetail(id: number): Promise<ArtistDetail> {
  return ncm.artistDetail(id);
}

/** 歌手专辑分页（`offset` 从 0 开始，每页 30 张）。 */
export function getArtistAlbums(
  id: number,
  offset = 0,
  limit = 30,
): Promise<ArtistAlbumPage> {
  return ncm.artistAlbums(id, limit, offset);
}
