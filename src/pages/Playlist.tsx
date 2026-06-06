import { useSuspenseQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { Suspense } from "react";
import { useParams } from "react-router-dom";
import { TrackRow, TrackRowSkeleton } from "@/components/track/TrackRow";
import { ImageWithFade } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import type { SongRef } from "@/core/playlist/types";
import { toast } from "@/lib/toast";
import { getNcmImageUrl } from "@/lib/utils";
import { getPlaylistDetail } from "@/services/playlist";
import { usePlayerStore } from "@/stores";

function PlaylistSkeleton() {
  return (
    <div className="p-6">
      <div className="flex gap-6">
        <Skeleton className="h-40 w-40 shrink-0 rounded-lg" shimmer />
        <div className="flex-1 min-w-0 space-y-3">
          <Skeleton className="h-7 w-48 rounded" shimmer />
          <Skeleton className="h-4 w-24 rounded" shimmer />
          <Skeleton className="h-3 w-72 rounded" shimmer />
          <div className="flex items-center gap-3 pt-0.5">
            <Skeleton className="h-8 w-24 rounded" shimmer />
            <Skeleton className="h-4 w-16 rounded" shimmer />
          </div>
        </div>
      </div>
      <div className="mt-6 space-y-0.5">
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton array
          <TrackRowSkeleton index={i} key={i} />
        ))}
      </div>
    </div>
  );
}

function PlaylistContent() {
  const { id } = useParams<{ id: string }>();
  const play = usePlayerStore((s) => s.play);

  if (!id) throw new Error("无效的歌单 ID");

  const { data } = useSuspenseQuery({
    queryKey: ["playlist", id],
    queryFn: () => getPlaylistDetail(Number(id)),
  });

  const playlist = data.playlist;

  const handlePlay = async (track: SongRef) => {
    try {
      await play(track);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "播放失败");
    }
  };

  const handlePlayAll = async () => {
    const tracks = playlist.tracks;
    if (!tracks?.length) return;
    for (const track of tracks) {
      try {
        await play(track);
        return;
      } catch {
        /* try next */
      }
    }
    toast.error("没有可播放的歌曲");
  };

  return (
    <div className="p-6">
      <div className="flex gap-6">
        {playlist.coverUrl && (
          <ImageWithFade
            alt={playlist.name}
            className="h-40 w-40 shrink-0 rounded-lg object-cover"
            src={getNcmImageUrl(playlist.coverUrl, 200)}
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{playlist.name}</h1>
          {playlist.creator && (
            <p className="mt-1 text-sm text-muted-foreground">
              {playlist.creator.nickname}
            </p>
          )}
          {playlist.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {playlist.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              className="inline-flex items-center gap-1 rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={handlePlayAll}
              type="button"
            >
              <Play className="h-4 w-4" />
              播放全部
            </button>
            <span className="text-xs text-muted-foreground">
              {playlist.trackCount} 首
            </span>
          </div>
        </div>
      </div>

      {playlist.tracks && playlist.tracks.length > 0 && (
        <div className="mt-6 space-y-0.5">
          {playlist.tracks.map((track, index) => (
            <TrackRow
              index={index}
              key={track.id}
              onPlay={handlePlay}
              track={track}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Playlist() {
  return (
    <Suspense fallback={<PlaylistSkeleton />}>
      <PlaylistContent />
    </Suspense>
  );
}
