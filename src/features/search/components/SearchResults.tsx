import { Search as SearchIcon, SearchX } from 'lucide-react';

import { TrackRow, TrackRowSkeletonList } from '@/shared/components/track';
import { AlbumCard, AlbumCardSkeleton } from '@/shared/components/album-card';
import { SearchArtistCard, SearchArtistCardSkeleton } from './SearchArtistCard';
import { SearchUserCard, SearchUserCardSkeleton } from './SearchUserCard';
import {
  GRID_SKELETON_COUNT,
  originCoverTag,
  SearchType,
  SKELETON_COUNT,
  TYPE_LABEL,
  type SearchResults,
} from '../constants';
import type { Song } from '@/shared/types/uiModels';

// ---- internal sub-components ----

function LoadingState({ type }: { type: SearchType }) {
  if (type === SearchType.SONG) {
    return <TrackRowSkeletonList count={SKELETON_COUNT} />;
  }

  const SkeletonComponent =
    type === SearchType.ALBUM
      ? AlbumCardSkeleton
      : type === SearchType.ARTIST
        ? SearchArtistCardSkeleton
        : SearchUserCardSkeleton;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: GRID_SKELETON_COUNT }).map((_, i) => (
        // oxlint-disable-next-line react/no-array-index-key
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
}

function NoResults({ keyword, type }: { keyword: string; type: SearchType }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <SearchX className="size-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">
        没有找到与 "
        <span className="text-foreground font-medium">{keyword}</span>" 相关的
        {TYPE_LABEL[type]}
      </p>
    </div>
  );
}

// ---- public component ----

interface SearchResultsProps {
  /** 是否正在搜索中 */
  loading: boolean;
  /** 搜索错误信息（空字符串表示无错误） */
  error: string;
  /** 搜索结果（按 type 判别）；未取到时为 null */
  results: SearchResults | null;
  /** 当前搜索分类 */
  searchType: SearchType;
  /** 是否已执行过搜索 */
  hasSearched: boolean;
  /** 当前搜索关键词 */
  keyword: string;
  /** 热门搜索下拉是否可见（影响初始引导提示） */
  showDropdown: boolean;
  /** 播放某首歌曲 */
  onPlay: (track: Song) => void;
}

export function SearchResults({
  loading,
  error,
  results,
  searchType,
  hasSearched,
  keyword,
  showDropdown,
  onPlay,
}: SearchResultsProps) {
  const showInitialPrompt = !hasSearched && !loading && !showDropdown;
  const items = results?.items ?? [];

  return (
    <>
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && <LoadingState type={searchType} />}

      {!loading && !error && results && items.length > 0 && (
        <>
          {/* Song results */}
          {results.type === SearchType.SONG && (
            <div className="space-y-0.5" data-focus-zone>
              {results.items.map((track, index) => (
                <TrackRow
                  artistTag={originCoverTag(track.originCoverType)}
                  index={index}
                  key={track.id}
                  onPlay={onPlay}
                  track={track}
                />
              ))}
            </div>
          )}

          {/* Album results */}
          {results.type === SearchType.ALBUM && (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
              data-focus-zone
            >
              {results.items.map((item) => (
                <AlbumCard album={item} key={item.id} />
              ))}
            </div>
          )}

          {/* Artist results */}
          {results.type === SearchType.ARTIST && (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
              data-focus-zone
            >
              {results.items.map((item) => (
                <SearchArtistCard item={item} key={item.id} />
              ))}
            </div>
          )}

          {/* User results */}
          {results.type === SearchType.USER && (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
              data-focus-zone
            >
              {results.items.map((item) => (
                <SearchUserCard item={item} key={item.id} />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !error && hasSearched && items.length === 0 && (
        <NoResults keyword={keyword} type={searchType} />
      )}

      {showInitialPrompt && (
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground pt-12">
          <SearchIcon className="size-10 opacity-20" />
          <p className="text-sm">点击搜索框发现热门音乐</p>
        </div>
      )}
    </>
  );
}
