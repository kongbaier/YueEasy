import { ncm } from '@/tauri/ncm';
import type { SuggestResult } from '@/shared/types/uiModels';
import {
  SearchType,
  suggestionKey,
  type SearchResults,
  type SuggestionItem,
} from './constants';

function extractSuggestions(res: SuggestResult): SuggestionItem[] {
  const items: SuggestionItem[] = [];

  for (const song of res.songs.slice(0, 4)) {
    const artist = song.artists.join('/');
    items.push({
      id: song.id,
      label: artist ? `${song.name} — ${artist}` : song.name,
      keyword: song.name,
      kind: 'song',
    });
  }
  for (const album of res.albums.slice(0, 2)) {
    items.push({
      id: album.id,
      label: `${album.name} (专辑)`,
      keyword: album.name,
      kind: 'album',
    });
  }
  for (const artist of res.artists.slice(0, 2)) {
    items.push({
      id: artist.id,
      label: `${artist.name} (歌手)`,
      keyword: artist.name,
      kind: 'artist',
    });
  }

  // 接口会返回重复项，去重后再截断（否则 React 列表 key 冲突）
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const key = suggestionKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

export const search = async (
  keyword: string,
  type: SearchType,
): Promise<SearchResults> => {
  switch (type) {
    case SearchType.SONG: {
      const res = await ncm.search(keyword, 30, 0);
      return { type: SearchType.SONG, items: res.songs };
    }
    case SearchType.ALBUM: {
      const res = await ncm.searchAlbum(keyword, 30, 0);
      return { type: SearchType.ALBUM, items: res.albums };
    }
    case SearchType.ARTIST: {
      const res = await ncm.searchArtist(keyword, 30, 0);
      return { type: SearchType.ARTIST, items: res.artists };
    }
    case SearchType.USER: {
      const res = await ncm.searchUser(keyword, 30, 0);
      return { type: SearchType.USER, items: res.users };
    }
  }
};

export const suggest = async (keyword: string): Promise<SuggestionItem[]> => {
  const resp = await ncm.searchSuggest(keyword);
  return extractSuggestions(resp);
};

export const hot = async (): Promise<string[]> => {
  const resp = await ncm.searchHot();
  return resp.map((hot) => hot.keyword);
};
