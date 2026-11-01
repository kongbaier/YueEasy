import { ncm } from '@/tauri/ncm';
import type { KeywordSuggest } from '@/shared/types/uiModels';
import { SearchType, type SearchResults } from './constants';

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

export const suggest = async (keyword: string): Promise<KeywordSuggest[]> =>
  ncm.searchSuggestKeyword(keyword);

export const hot = async (): Promise<string[]> => {
  const resp = await ncm.searchHot();
  return resp.map((hot) => hot.keyword);
};
