import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SongRef } from "@/core/playlist/types";
import { useDebounce } from "@/hooks/useDebounce";
import { useLoadMore } from "@/hooks/useLoadMore";
import { toast } from "@/lib/toast";
import type { SearchSuggestResponse } from "@/services/ncm";
import { ncm, toSongRef } from "@/services/ncm";
import { usePlayerStore } from "@/stores";
import { SearchType } from "./constants";
import type { SuggestionItem } from "./SuggestDropdown";

/** 将请求返回的数据格式化为建议项 */
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

export function useSearchSuggest(keyword: string) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const mutation = useMutation({
    mutationFn: () => ncm.searchSuggest(keyword),
    onSuccess: (res) => {
      const items = extractSuggestions(res);
      setSuggestions(items);
    },
    onError: () => {
      setSuggestions([]);
    },
  });

  return {
    suggestions,
    refetch: mutation.mutate,
  };
}

export function useSearchHot() {
  const query = useQuery({
    queryKey: ["searchHot"],
    queryFn: () =>
      ncm.searchHot().then((res) => res.result.hots.map((h) => h.first)),
    staleTime: 5 * 60 * 1000,
    enabled: false,
  });

  return {
    hots: query.data ?? [],
    refetch: query.refetch,
  };
}

// export function useSearch() {
//   // ---- state ----
//   const [keyword, setKeyword] = useState("");
//   const [searchKeyword, setSearchKeyword] = useState("");
//   const [results, setResults] = useState<unknown[]>([]);
//   const [total, setTotal] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [showHot, setShowHot] = useState(false);
//   const [showSuggest, setShowSuggest] = useState(false);
//   const [searchType, setSearchType] = useState<SearchType>(SearchType.SONG);
//   const [focused, setFocused] = useState(false);

//   // ---- derived ----
//   const debouncedKeyword = useDebounce(keyword, 300);
//   const hasSearched = searchKeyword.trim().length > 0;

//   // ---- external stores ----
//   const play = usePlayerStore((s) => s.play);
//   const replaceAndPlay = usePlayerStore((s) => s.replaceAndPlay);
//   const visibleCount = useLoadMore(results.length);

//   // ---- refs ----
//   const inputRef = useRef<HTMLInputElement>(null);
//   const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
//   const scrollRef = useCallback((el: HTMLDivElement | null) => {
//     setScrollEl(el);
//   }, []);

//   const { refetch, suggestions } = useSearchSuggest(debouncedKeyword);
//   const hotQuery = useSearchHot(showHot);
//   // Clear results when search keyword becomes empty
//   useEffect(() => {
//     if (!hasSearched) {
//       setResults([]);
//       setTotal(0);
//     }
//   }, [hasSearched]);

//   // Search effect — fires on form submit or tab switch
//   useEffect(() => {
//     if (!hasSearched) return;

//     let cancelled = false;
//     setLoading(true);
//     setError("");

//     const doSearch = async () => {
//       switch (searchType) {
//         case SearchType.SONG: {
//           const res = await ncm.search(searchKeyword, 30, 0);
//           if (!cancelled) {
//             setResults((res.result.songs || []).map(toSongRef));
//             setTotal(res.result.songCount);
//           }
//           break;
//         }
//         case SearchType.ALBUM: {
//           const res = await ncm.searchAlbum(searchKeyword, 30, 0);
//           if (!cancelled) {
//             setResults(res.result.albums || []);
//             setTotal(res.result.albumCount);
//           }
//           break;
//         }
//         case SearchType.ARTIST: {
//           const res = await ncm.searchArtist(searchKeyword, 30, 0);
//           if (!cancelled) {
//             setResults(res.result.artists || []);
//             setTotal(res.result.artistCount);
//           }
//           break;
//         }
//         case SearchType.USER: {
//           const res = await ncm.searchUser(searchKeyword, 30, 0);
//           if (!cancelled) {
//             setResults(res.result.userprofiles || []);
//             setTotal(res.result.userprofileCount);
//           }
//           break;
//         }
//       }
//       if (!cancelled) setLoading(false);
//     };

//     doSearch().catch((e) => {
//       if (!cancelled) {
//         setError(e instanceof Error ? e.message : "搜索失败");
//         setLoading(false);
//       }
//     });

//     return () => {
//       cancelled = true;
//     };
//   }, [searchKeyword, hasSearched, searchType]);

//   // ---- handlers ----

//   const submit = useCallback(
//     (e: React.SubmitEvent) => {
//       e.preventDefault();
//       const trimmed = keyword.trim();
//       if (!trimmed) return;
//       setSearchKeyword(trimmed);
//       setShowSuggest(false);
//       setShowHot(false);
//     },
//     [keyword],
//   );

//   const pickHot = useCallback((word: string) => {
//     setKeyword(word);
//     setSearchKeyword(word);
//     setShowHot(false);
//     inputRef.current?.blur();
//   }, []);

//   const pickSuggest = useCallback((word: string) => {
//     setKeyword(word);
//     setSearchKeyword(word);
//     setShowSuggest(false);
//     setShowHot(false);
//   }, []);

//   const clearInput = useCallback(() => {
//     setKeyword("");
//     setSearchKeyword("");
//     setResults([]);
//     setTotal(0);
//     setError("");
//     setShowHot(false);
//     setShowSuggest(false);
//     inputRef.current?.focus();
//   }, []);

//   const focus = useCallback(() => {
//     setFocused(true);
//     if (!keyword.trim()) {
//       setShowHot(true);
//       hotQuery.refetch();
//     } else {
//       setShowSuggest(true);
//     }
//   }, [keyword, hotQuery]);

//   const blur = useCallback(() => {
//     // Small delay so dropdown item clicks fire before the dropdown is removed
//     setTimeout(() => setFocused(false), 150);
//   }, []);

//   const closeHot = useCallback(() => setShowHot(false), []);
//   const closeSuggest = useCallback(() => setShowSuggest(false), []);

//   const changeKeyword = useCallback(
//     (e: React.ChangeEvent<HTMLInputElement>) => {
//       setKeyword(e.target.value);
//       setShowHot(false);
//     },
//     [],
//   );

//   const changeType = useCallback((type: SearchType) => {
//     setSearchType(type);
//     setResults([]);
//     setTotal(0);
//   }, []);

//   const playTrack = useCallback(
//     async (track: SongRef) => {
//       try {
//         await play(track);
//       } catch (e) {
//         toast.error(e instanceof Error ? e.message : "播放失败");
//       }
//     },
//     [play],
//   );

//   const playAll = useCallback(async () => {
//     if (!results.length || searchType !== SearchType.SONG) return;
//     try {
//       await replaceAndPlay(results as SongRef[]);
//     } catch {
//       toast.error("没有可播放的歌曲");
//     }
//   }, [results, searchType, replaceAndPlay]);

//   return {
//     // state
//     keyword,
//     searchKeyword,
//     results,
//     total,
//     loading,
//     error,
//     searchType,
//     focused,
//     // ui flags
//     showHot,
//     showSuggest,
//     suggestions,
//     hotWords: hotQuery.hotWords ?? [],
//     // derived
//     hasSearched,
//     visibleCount,
//     // refs
//     inputRef,
//     scrollEl,
//     scrollRef,
//     // handlers
//     submit,
//     pickHot,
//     pickSuggest,
//     clearInput,
//     focus,
//     blur,
//     closeHot,
//     closeSuggest,
//     changeKeyword,
//     changeType,
//     playTrack,
//     playAll,
//   };
// }
