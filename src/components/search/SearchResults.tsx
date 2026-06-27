import { Search as SearchIcon, SearchX } from "lucide-react";
import type { SongRef } from "@/core/playlist/types";
import type {
  NcmSearchAlbum,
  NcmSearchArtist,
  NcmSearchUser,
} from "@/services/ncm";
import { TrackRow, TrackRowSkeleton } from "@/components/track";
import {
  SearchAlbumCard,
  SearchAlbumCardSkeleton,
} from "@/components/search/SearchAlbumCard";
import {
  SearchArtistCard,
  SearchArtistCardSkeleton,
} from "@/components/search/SearchArtistCard";
import {
  SearchUserCard,
  SearchUserCardSkeleton,
} from "@/components/search/SearchUserCard";
import {
  GRID_SKELETON_COUNT,
  SKELETON_COUNT,
  TYPE_LABEL,
  type SearchTabType,
} from "./constants";

// ---- internal sub-components ----

function LoadingState({ type }: { type: SearchTabType }) {
  if (type === "1") {
    return (
      <div className="space-y-0.5">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, order never changes
          <TrackRowSkeleton index={i} key={i} />
        ))}
      </div>
    );
  }

  const SkeletonComponent =
    type === "10"
      ? SearchAlbumCardSkeleton
      : type === "100"
        ? SearchArtistCardSkeleton
        : SearchUserCardSkeleton;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: GRID_SKELETON_COUNT }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, order never changes
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
}

function NoResults({
  keyword,
  type,
}: {
  keyword: string;
  type: SearchTabType;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <SearchX className="size-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">
        没有找到与 "<span className="text-foreground font-medium">{keyword}</span>
        " 相关的{TYPE_LABEL[type]}
      </p>
    </div>
  );
}

// ---- public component ----

interface SearchResultsProps {
  loading: boolean;
  error: string;
  results: unknown[];
  searchType: SearchTabType;
  visibleCount: number;
  hasSearched: boolean;
  keyword: string;
  showDropdown: boolean;
  onPlay: (track: SongRef) => void;
}

export function SearchResults({
  loading,
  error,
  results,
  searchType,
  visibleCount,
  hasSearched,
  keyword,
  showDropdown,
  onPlay,
}: SearchResultsProps) {
  const showInitialPrompt = !hasSearched && !loading && !showDropdown;

  return (
    <>
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && <LoadingState type={searchType} />}

      {!loading && !error && results.length > 0 && (
        <>
          {/* Song results */}
          {searchType === "1" && (
            <div className="space-y-0.5">
              {(results as SongRef[])
                .slice(0, visibleCount)
                .map((track, index) => (
                  <TrackRow
                    index={index}
                    key={track.id}
                    onPlay={onPlay}
                    track={track}
                  />
                ))}
            </div>
          )}

          {/* Album results */}
          {searchType === "10" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {(results as NcmSearchAlbum[])
                .slice(0, visibleCount)
                .map((item) => (
                  <SearchAlbumCard item={item} key={item.id} />
                ))}
            </div>
          )}

          {/* Artist results */}
          {searchType === "100" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {(results as NcmSearchArtist[])
                .slice(0, visibleCount)
                .map((item) => (
                  <SearchArtistCard item={item} key={item.id} />
                ))}
            </div>
          )}

          {/* User results */}
          {searchType === "1002" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {(results as NcmSearchUser[])
                .slice(0, visibleCount)
                .map((item) => (
                  <SearchUserCard item={item} key={item.userId} />
                ))}
            </div>
          )}
        </>
      )}

      {!loading && !error && hasSearched && results.length === 0 && (
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
