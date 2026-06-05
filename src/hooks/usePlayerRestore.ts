import { useEffect, useRef } from "react";
import { createPlayModeStrategy } from "@/core/player";
import type { PlayMode, Track } from "@/core/player/types";
import { getSetting, setSetting } from "@/services/tauri";
import { usePlayerStore } from "@/stores/playerStore";

interface PersistedTrack {
  id: number;
  name: string;
  artists: { id: number; name: string }[];
  album: { id: number; name: string; picUrl?: string };
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

      const player = usePlayerStore.getState().core;
      const tracks: Track[] = data.queue as Track[];

      const index = Math.min(Math.max(data.index, 0), tracks.length - 1);

      player.initialize({
        volume: data.volume ?? 1,
        muted: data.muted ?? false,
        mode: createPlayModeStrategy(data.playMode ?? "sequential"),
      });

      player.setQueue(tracks, index);

      usePlayerStore.setState({
        queue: player.queue,
        currentTrack: player.currentTrack ?? null,
        playMode: data.playMode ?? "sequential",
        volume: player.volume,
        muted: player.muted,
        currentTime: data.currentTime ?? 0,
        duration: player.duration,
      });
    })();
  }, []);
}
