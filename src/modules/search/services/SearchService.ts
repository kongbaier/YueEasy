import { CacheKeys, cachedFetch } from '@/tauri/cache';
import { ncm, toSongRef } from '@/tauri/ncm';
import type { SearchSuggestResponse } from '@/tauri/ncm';
import { SearchType } from '../constants';
import type { SuggestionItem } from '../constants';

function extractSuggestions(res: SearchSuggestResponse): SuggestionItem[] {
  const items: SuggestionItem[] = [];
  const { songs, albums, artists } = res.result;

  if (songs) {
    for (const song of songs.slice(0, 4)) {
      const artist = song.artists?.map((a) => a.name).join('/') || '';
      items.push({
        label: artist ? `${song.name} — ${artist}` : song.name,
        keyword: song.name,
        kind: 'song',
      });
    }
  }
  if (albums) {
    for (const album of albums.slice(0, 2)) {
      items.push({
        label: `${album.name} (专辑)`,
        keyword: album.name,
        kind: 'album',
      });
    }
  }
  if (artists) {
    for (const artist of artists.slice(0, 2)) {
      items.push({
        label: `${artist.name} (歌手)`,
        keyword: artist.name,
        kind: 'artist',
      });
    }
  }
  return items.slice(0, 8);
}

/** 搜索服务：L1 层，把取数 + 数据映射收敛在这里，页面只消费业务数据形状。 */
export const searchService = {
  search: async (keyword: string, type: SearchType) => {
    switch (type) {
      case SearchType.SONG: {
        const res = await ncm.search(keyword, 30, 0);
        return {
          results: (res.result.songs || []).map(toSongRef),
          total: res.result.songCount,
        };
      }
      case SearchType.ALBUM: {
        const res = await ncm.searchAlbum(keyword, 30, 0);
        return {
          results: res.result.albums || [],
          total: res.result.albumCount,
        };
      }
      case SearchType.ARTIST: {
        const res = await ncm.searchArtist(keyword, 30, 0);
        return {
          results: res.result.artists || [],
          total: res.result.artistCount,
        };
      }
      case SearchType.USER: {
        const res = await ncm.searchUser(keyword, 30, 0);
        return {
          results: res.result.userprofiles || [],
          total: res.result.userprofileCount,
        };
      }
    }
  },

  suggest: async (keyword: string): Promise<SuggestionItem[]> =>
    extractSuggestions(await ncm.searchSuggest(keyword)),

  hot: async (): Promise<string[]> => {
    const r = await cachedFetch(CacheKeys.searchHot, () => ncm.searchHot());
    return r.data.result.hots.map((h) => h.first);
  },
};
