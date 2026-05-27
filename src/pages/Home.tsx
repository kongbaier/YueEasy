import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/cn";
import { ncm } from "@/services/ncm";
import { useUiStore } from "@/stores";
import type { Playlist } from "@/types/music";

interface Banner {
  imageUrl: string;
  targetId: number;
  titleColor: string;
  typeTitle: string;
}

export function Home() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [topPlaylists, setTopPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ncmReady = useUiStore((s) => s.ncmReady);
  const navigate = useNavigate();

  useEffect(() => {
    if (!ncmReady) return;
    let cancelled = false;

    Promise.all([
      ncm.banner().then((r) => r.banners),
      ncm.personalizedPlaylist(12).then((r) => r.result),
      ncm.topPlaylist("全部", 12).then((r) => r.playlists),
    ])
      .then(([b, pl, tp]) => {
        if (!cancelled) {
          setBanners(b);
          setPlaylists(pl);
          setTopPlaylists(tp);
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
  }, [ncmReady]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">加载中...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">发现音乐</h1>
        <p className="mt-4 text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {banners.length > 0 && (
        <div className="relative overflow-hidden rounded-xl">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${bannerIdx * 100}%)` }}
          >
            {banners.map((b, _i) => (
              <button
                className="relative aspect-[3/1] w-full flex-shrink-0 cursor-pointer"
                key={b.imageUrl}
                onClick={() =>
                  b.targetId && navigate(`/playlist/${b.targetId}`)
                }
                type="button"
              >
                <img
                  alt={b.typeTitle}
                  className="h-full w-full object-cover"
                  src={b.imageUrl}
                />
                <span
                  className="absolute right-2 bottom-2 rounded bg-black/50 px-2 py-0.5 text-xs"
                  style={{ color: b.titleColor }}
                >
                  {b.typeTitle}
                </span>
              </button>
            ))}
          </div>
          {banners.length > 1 && (
            <>
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
                onClick={() =>
                  setBannerIdx((i) => (i - 1 + banners.length) % banners.length)
                }
                type="button"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
                onClick={() => setBannerIdx((i) => (i + 1) % banners.length)}
                type="button"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute right-4 bottom-4 flex gap-1.5">
                {banners.map((b, i) => (
                  <button
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      i === bannerIdx ? "bg-white" : "bg-white/50",
                    )}
                    key={b.imageUrl}
                    onClick={() => setBannerIdx(i)}
                    type="button"
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <section>
        <h2 className="mb-4 text-lg font-bold">推荐歌单</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {playlists.map((pl) => (
            <button
              className="group cursor-pointer overflow-hidden rounded-lg bg-card text-left transition-colors hover:bg-accent"
              key={pl.id}
              onClick={() => navigate(`/playlist/${pl.id}`)}
              type="button"
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  alt={pl.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  src={pl.coverImgUrl || pl.picUrl}
                />
                <div className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                  {pl.playCount > 10000
                    ? `${(pl.playCount / 10000).toFixed(0)}万`
                    : pl.playCount}
                </div>
              </div>
              <div className="p-2">
                <p className="truncate text-sm">{pl.name}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {topPlaylists.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold">热门歌单</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {topPlaylists.map((pl) => (
              <button
                className="group cursor-pointer overflow-hidden rounded-lg bg-card text-left transition-colors hover:bg-accent"
                key={pl.id}
                onClick={() => navigate(`/playlist/${pl.id}`)}
                type="button"
              >
                <div className="relative aspect-square overflow-hidden">
                  <img
                    alt={pl.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    src={pl.coverImgUrl || pl.picUrl}
                  />
                </div>
                <div className="p-2">
                  <p className="truncate text-sm">{pl.name}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
