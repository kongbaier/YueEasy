import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { SearchSuggestResponse } from "@/services/ncm";
import { ncm, toSongRef } from "@/services/ncm";
import { SearchType } from "./constants";
import { useSearchStore } from "./store";
import type { SuggestionItem } from "./SuggestDropdown";

function extractSuggestions(res: SearchSuggestResponse): SuggestionItem[] {
  const items: SuggestionItem[] = [];
  const { songs, albums, artists } = res.result;

  if (songs) {
    for (const song of songs.slice(0, 4)) {
      const artist = song.artists?.map((a) => a.name).join("/") || "";
      items.push({
        label: artist ? `${song.name} — ${artist}` : song.name,
        keyword: song.name,
        kind: "song",
      });
    }
  }
  if (albums) {
    for (const album of albums.slice(0, 2)) {
      items.push({
        label: `${album.name} (专辑)`,
        keyword: album.name,
        kind: "album",
      });
    }
  }
  if (artists) {
    for (const artist of artists.slice(0, 2)) {
      items.push({
        label: `${artist.name} (歌手)`,
        keyword: artist.name,
        kind: "artist",
      });
    }
  }
  return items.slice(0, 8);
}

const SEARCH_FETCHERS: Record<
  SearchType,
  (keyword: string) => Promise<{ results: unknown[]; total: number }>
> = {
  [SearchType.SONG]: async (keyword) => {
    const res = await ncm.search(keyword, 30, 0);
    return {
      results: (res.result.songs || []).map(toSongRef),
      total: res.result.songCount,
    };
  },
  [SearchType.ALBUM]: async (keyword) => {
    const res = await ncm.searchAlbum(keyword, 30, 0);
    return {
      results: res.result.albums || [],
      total: res.result.albumCount,
    };
  },
  [SearchType.ARTIST]: async (keyword) => {
    const res = await ncm.searchArtist(keyword, 30, 0);
    return {
      results: res.result.artists || [],
      total: res.result.artistCount,
    };
  },
  [SearchType.USER]: async (keyword) => {
    const res = await ncm.searchUser(keyword, 30, 0);
    return {
      results: res.result.userprofiles || [],
      total: res.result.userprofileCount,
    };
  },
};

export function useSearchSuggest() {
  const mutation = useMutation({
    mutationFn: () => ncm.searchSuggest(useSearchStore.getState().input),
    onSuccess: (res) =>
      useSearchStore.setState({ suggestions: extractSuggestions(res) }),
    onError: () => useSearchStore.setState({ suggestions: [] }),
  });

  return { refetch: mutation.mutate };
}

export function useSearchHot() {
  const query = useQuery({
    queryKey: ["searchHot"],
    queryFn: () =>
      ncm.searchHot().then((res) => res.result.hots.map((h) => h.first)),
    staleTime: 5 * 60 * 1000,
    enabled: false,
  });

  useEffect(() => {
    if (query.data) useSearchStore.setState({ hots: query.data });
  }, [query.data]);

  return { refetch: query.refetch };
}

export function useSearchExecution(keyword: string, type: SearchType) {
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!keyword.trim()) return;

    cancelledRef.current = false;
    useSearchStore.setState({ loading: true, error: "" });

    SEARCH_FETCHERS[type](keyword)
      .then(({ results, total }) => {
        if (!cancelledRef.current)
          useSearchStore.setState({ results, total, loading: false });
      })
      .catch((e) => {
        if (!cancelledRef.current)
          useSearchStore.setState({
            error: e instanceof Error ? e.message : "搜索失败",
            loading: false,
          });
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [keyword, type]);
}
