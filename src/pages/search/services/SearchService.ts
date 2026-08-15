import { CacheKeys, cachedFetch } from '@/tauri/cache';
import { ncm } from '@/tauri/ncm';
import type { SuggestResult } from '@/shared/types/entities';
import { SearchType } from '../constants';
import type { SuggestionItem } from '../constants';

function extractSuggestions(res: SuggestResult): SuggestionItem[] {
  const items: SuggestionItem[] = [];

  for (const song of res.songs.slice(0, 4)) {
    const artist = song.artists.join('/');
    items.push({
      label: artist ? `${song.name} — ${artist}` : song.name,
      keyword: song.name,
      kind: 'song',
    });
  }
  for (const album of res.albums.slice(0, 2)) {
    items.push({
      label: `${album.name} (专辑)`,
      keyword: album.name,
      kind: 'album',
    });
  }
  for (const artist of res.artists.slice(0, 2)) {
    items.push({
      label: `${artist.name} (歌手)`,
      keyword: artist.name,
      kind: 'artist',
    });
  }
  return items.slice(0, 8);
}

/** 搜索服务：L1 层，直接消费 Rust 归一后的 Entity。 */
export const searchService = {
  search: async (keyword: string, type: SearchType) => {
    switch (type) {
      case SearchType.SONG: {
        const res = await ncm.search(keyword, 30, 0);
        return { results: res.songs, total: res.songCount };
      }
      case SearchType.ALBUM: {
        const res = await ncm.searchAlbum(keyword, 30, 0);
        return { results: res.albums, total: res.albumCount };
      }
      case SearchType.ARTIST: {
        const res = await ncm.searchArtist(keyword, 30, 0);
        return { results: res.artists, total: res.artistCount };
      }
      case SearchType.USER: {
        const res = await ncm.searchUser(keyword, 30, 0);
        return { results: res.users, total: res.userCount };
      }
    }
  },

  suggest: async (keyword: string): Promise<SuggestionItem[]> =>
    extractSuggestions(await ncm.searchSuggest(keyword)),

  hot: async (): Promise<string[]> => {
    const r = await cachedFetch(CacheKeys.searchHot, () => ncm.searchHot());
    return r.data.map((h) => h.keyword);
  },
};
