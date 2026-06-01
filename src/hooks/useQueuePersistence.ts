import { useEffect, useRef } from "react";
import type { Track, TrackAlbum, TrackArtist } from "@/core/player/types";
import { setSetting } from "@/services/tauri";
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
  playMode: string;
  volume: number;
  muted: boolean;
}

function serializeState(): string | null {
  const s = usePlayerStore.getState();
  if (s.queue.length === 0 && !s.currentTrack) return null;

  const data: PersistedState = {
    queue: s.queue.map((t: Track) => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
      album: { id: t.album.id, name: t.album.name, picUrl: t.album.picUrl },
      duration: t.duration,
    })),
    index: s.core.index,
    currentTime: s.currentTime,
    playMode: s.playMode,
    volume: s.volume,
    muted: s.muted,
  };

  return JSON.stringify(data);
}

export function useQueuePersistence() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const scheduleSave = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const json = serializeState();
        if (!json) return;
        setSetting("player_state", json).catch(() => {});
      }, 2000);
    };

    const unsub = usePlayerStore.subscribe((state, prevState) => {
      if (
        state.queue === prevState.queue &&
        state.core.index === prevState.core.index &&
        state.playMode === prevState.playMode &&
        state.volume === prevState.volume &&
        state.muted === prevState.muted
      )
        return;
      scheduleSave();
    });

    const flush = () => {
      clearTimeout(timerRef.current);
      const json = serializeState();
      if (json) {
        setSetting("player_state", json).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", flush);

    return () => {
      unsub();
      clearTimeout(timerRef.current);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);
}
