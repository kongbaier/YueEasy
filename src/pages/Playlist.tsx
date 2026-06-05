import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TrackRow } from "@/components/track/TrackRow";
import type { Playlist as PlaylistType, SongRef } from "@/core/playlist/types";
import { getPlaylistDetail } from "@/services/playlist";
import { usePlayerStore } from "@/stores";

export default function Playlist() {
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<PlaylistType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playError, setPlayError] = useState("");
  const play = usePlayerStore((s) => s.play);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    getPlaylistDetail(Number(id))
      .then(({ playlist: p }) => {
        if (!cancelled) {
          setPlaylist(p);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePlay = async (track: SongRef) => {
    setPlayError("");
    try {
      await play(track);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : "播放失败");
    }
  };

  const handlePlayAll = async () => {
    const tracks = playlist?.tracks;
    if (!tracks?.length) return;
    setPlayError("");
    for (const track of tracks) {
      try {
        await play(track);
        return;
      } catch {
        /* try next */
      }
    }
    setPlayError("没有可播放的歌曲");
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">加载中...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-500">{error}</div>;
  }

  if (!playlist) return null;

  return (
    <div className="p-6">
      <div className="flex gap-6">
        {playlist.coverUrl && (
          <img
            alt={playlist.name}
            className="h-40 w-40 shrink-0 rounded-lg object-cover"
            src={playlist.coverUrl}
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
          {playError && (
            <p className="mt-2 text-xs text-red-500">{playError}</p>
          )}
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
