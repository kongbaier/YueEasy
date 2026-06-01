import { useEffect, useRef } from "react";
import { createPlayModeStrategy } from "@/core/player";
import type {
  PlayMode,
  Track,
  TrackAlbum,
  TrackArtist,
} from "@/core/player/types";
import { ncm } from "@/services/ncm";
import { getSetting, setSetting } from "@/services/tauri";
import { usePlayerStore } from "@/stores/playerStore";

interface PersistedTrack {
  id: number;
  name: string;
  artists: TrackArtist[];
  album: TrackAlbum;
  duration: number;
}

interface PersistedState {
  queue: PersistedTrack[];
  index: number;
  currentTime: number;
  playMode: PlayMode;
  volume: number;
  muted: boolean;
}

export function usePlayerRestore() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      let raw: string;
      try {
        raw = await getSetting("player_state");
      } catch {
        return;
      }
      if (!raw) return;

      let data: PersistedState;
      try {
        data = JSON.parse(raw) as PersistedState;
      } catch {
        await setSetting("player_state", "").catch(() => {});
        return;
      }

      if (!data.queue?.length) return;

      const results = await Promise.allSettled(
        data.queue.map((t) => ncm.songUrl(t.id)),
      );

      const player = usePlayerStore.getState().core;
      const tracks: Track[] = [];

      for (let i = 0; i < data.queue.length; i++) {
        const r = results[i];
        if (r.status === "rejected") continue;
        const url = r.value.data?.[0]?.url;
        if (!url) continue;

        tracks.push({
          id: data.queue[i].id,
          name: data.queue[i].name,
          artists: data.queue[i].artists,
          album: data.queue[i].album,
          duration: data.queue[i].duration,
          url,
        });
      }

      if (tracks.length === 0) {
        await setSetting("player_state", "").catch(() => {});
        return;
      }

      const index = Math.min(Math.max(data.index, 0), tracks.length - 1);

      player.initialize({
        volume: data.volume ?? 1,
        muted: data.muted ?? false,
        mode: createPlayModeStrategy(data.playMode ?? "sequential"),
      });

      player.setQueue(tracks, index);

      if (data.currentTime > 0) {
        const off = player.on("loadedmetadata", (duration) => {
          off();
          if (data.currentTime < duration) {
            player.seek(data.currentTime);
            usePlayerStore.setState({
              currentTime: data.currentTime,
            });
          }
        });
      }

      usePlayerStore.setState({
        queue: player.queue,
        currentTrack: player.currentTrack ?? null,
        playerState: player.state,
        playMode: data.playMode ?? "sequential",
        volume: player.volume,
        muted: player.muted,
        currentTime: data.currentTime ?? 0,
        duration: player.duration,
      });
    })();
  }, []);
}
