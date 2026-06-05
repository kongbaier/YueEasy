import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { TrackRow } from "@/components/track/TrackRow";
import type { SongRef } from "@/core/playlist/types";
import { ncm, toSongRef } from "@/services/ncm";
import { useAuthStore, usePlayerStore, useUiStore } from "@/stores";

export default function LikedSongs() {
  const userId = useAuthStore((s) => s.userId);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setLoginDialogOpen = useUiStore((s) => s.setLoginDialogOpen);
  const play = usePlayerStore((s) => s.play);

  const [tracks, setTracks] = useState<SongRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playError, setPlayError] = useState("");

  useEffect(() => {
    if (!isLoggedIn || !userId) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    ncm
      .likeList(userId)
      .then((res) => {
        if (cancelled || !res.ids.length) {
          if (!cancelled) {
            setTracks([]);
            setLoading(false);
          }
          return;
        }

        ncm
          .songDetail(res.ids)
          .then((detail) => {
            if (!cancelled) {
              setTracks(detail.songs.map(toSongRef));
              setLoading(false);
            }
          })
          .catch((e) => {
            if (!cancelled) {
              setError(e instanceof Error ? e.message : "加载歌曲详情失败");
              setLoading(false);
            }
          });
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
  }, [userId, isLoggedIn]);

  const handlePlay = async (track: SongRef) => {
    setPlayError("");
    try {
      await play(track);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : "播放失败");
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Heart className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看我喜欢</p>
        <button
          className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          onClick={() => setLoginDialogOpen(true)}
          type="button"
        >
          立即登录
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">加载中...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">我喜欢</h1>
      {playError && (
        <p className="mb-2 text-xs text-red-500">{playError}</p>
      )}
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Heart className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">还没有喜欢的歌曲</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {tracks.map((track, index) => (
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
