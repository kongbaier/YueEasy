import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HorizontalScrollSection } from "@/components/HorizontalScrollSection";
import { PlaylistCard } from "@/components/PlaylistCard";
import { cn } from "@/lib/utils";
import { ncm } from "@/services/ncm";
import type { Playlist } from "@/types/music";

interface Banner {
  imageUrl: string;
  targetId: number;
  titleColor: string;
  typeTitle: string;
}

export function Home() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [topPlaylists, setTopPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      ncm.banner().then((r) => r.banners),
      ncm.personalizedPlaylist(20).then((r) => r.result),
      ncm.topPlaylist("全部", 20).then((r) => r.playlists),
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
  }, []);

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
    <div className="space-y-8 px-6 pb-3">
      <Banner banners={banners} />
      <HorizontalScrollSection
        title="推荐歌单"
        titleLink="/discover/personalized"
      >
        {playlists.map((pl) => (
          <PlaylistCard key={pl.id} playlist={pl} showPlayCount />
        ))}
      </HorizontalScrollSection>

      {topPlaylists.length > 0 && (
        <HorizontalScrollSection title="热门歌单" titleLink="/discover/toplist">
          {topPlaylists.map((pl) => (
            <PlaylistCard key={pl.id} playlist={pl} />
          ))}
        </HorizontalScrollSection>
      )}
    </div>
  );
}

const Banner = ({ banners }: { banners: Banner[] }) => {
  // Infinite carousel state

  const [jump, setJump] = useState(false);
  const [extIdx, setExtIdx] = useState(1);
  const extIdxRef = useRef(1);
  const trackRef = useRef<HTMLDivElement>(null);

  const extended = useMemo(() => {
    if (banners.length === 0) return [];
    return [banners[banners.length - 1], ...banners, banners[0]];
  }, [banners]);

  extIdxRef.current = extIdx;

  // Jump to real position after transitioning to a clone
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onEnd = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== "transform") return;
      if (extIdxRef.current === 0) {
        setJump(true);
        setExtIdx(banners.length);
      } else if (extIdxRef.current === extended.length - 1) {
        setJump(true);
        setExtIdx(1);
      }
    };

    el.addEventListener("transitionend", onEnd);
    return () => el.removeEventListener("transitionend", onEnd);
  }, [banners.length, extended.length]);

  // Reset jump flag after instant reposition
  useEffect(() => {
    if (!jump) return;
    const raf = requestAnimationFrame(() => setJump(false));
    return () => cancelAnimationFrame(raf);
  }, [jump]);

  const navigate = useNavigate();

  const realIdx = useMemo(() => {
    if (extIdx === 0) return banners.length - 1;
    if (extIdx === extended.length - 1) return 0;
    return extIdx - 1;
  }, [extIdx, banners.length, extended.length]);
  const goNext = useCallback(() => setExtIdx((i) => i + 1), []);
  const goPrev = useCallback(() => setExtIdx((i) => i - 1), []);

  const goToReal = useCallback(
    (targetReal: number) => {
      const n = banners.length;
      const cur = realIdx;
      const forward = (targetReal - cur + n) % n;
      const backward = (cur - targetReal + n) % n;
      if (forward <= backward) {
        setExtIdx((i) => i + forward);
      } else {
        setExtIdx((i) => i - backward);
      }
    },
    [banners.length, realIdx],
  );
  if (banners.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="flex"
        ref={trackRef}
        style={{
          transform: `translateX(-${extIdx * 100}%)`,
          transition: jump ? "none" : "transform 700ms ease-out",
        }}
      >
        {extended.map((b, i) => (
          <button
            className="relative aspect-video w-full shrink-0 cursor-pointer overflow-hidden"
            key={
              i === 0
                ? `${b.imageUrl}-clone-l`
                : i === extended.length - 1
                  ? `${b.imageUrl}-clone-r`
                  : b.imageUrl
            }
            onClick={() => b.targetId && navigate(`/playlist/${b.targetId}`)}
            type="button"
          >
            <img
              alt={b.typeTitle}
              className="absolute top-0 h-full max-w-none"
              src={b.imageUrl}
              style={{
                width: "155%",
                left: "50%",
                transform: `translateX(calc(-50% + ${(extIdx - i) * 25}%))`,
                transition: jump ? "none" : "transform 700ms ease-out",
              }}
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
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
            onClick={goPrev}
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
            onClick={goNext}
            type="button"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute right-4 bottom-4 z-10 flex gap-1.5">
            {banners.map((b, i) => (
              <button
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === realIdx ? "bg-white" : "bg-white/50",
                )}
                key={b.imageUrl}
                onClick={() => goToReal(i)}
                type="button"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
