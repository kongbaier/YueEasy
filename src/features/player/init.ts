import { createPlayModeStrategy } from "@/features/player/core";
import type { PlayMode, Track } from "@/features/player/core/types";
import { usePlayerStore } from "@/features/player/store";
import { getStoreValue, setStoreValue } from "@/shared/services/store";
import { useAppSettings } from "@/stores/settings";

// ── restore saved player state ──

export async function initPlayer() {
  const raw = await getStoreValue("player_state");
  if (!raw) return;

  // ponytail: old SQLite stored player_state as JSON string, store plugin stores native objects
  const data = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
    queue: Track[];
    index: number;
    currentTime: number;
    playMode: PlayMode;
  };
  if (!data.queue?.length) return;

  const player = usePlayerStore.getState().core;
  const tracks: Track[] = data.queue as Track[];
  const index = Math.min(Math.max(data.index, 0), tracks.length - 1);

  // volume/muted from persisted settings
  const settings = useAppSettings.getState().settings;
  const savedVolume = settings.volume;
  const savedMuted = settings.muted;

  player.initialize({
    volume: savedVolume,
    muted: savedMuted,
    mode: createPlayModeStrategy(data.playMode ?? "sequential"),
  });
  player.setQueue(tracks, index);

  usePlayerStore.setState({
    queue: player.queue,
    currentTrack: player.currentTrack ?? null,
    playMode: data.playMode ?? "sequential",
    currentTime: data.currentTime ?? 0,
    duration: player.duration,
  });
}

// ── persist queue on change ──

let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function persistQueue() {
  const data = usePlayerStore.getState();
  if (data.queue.length === 0 && !data.currentTrack) return;

  const payload = {
    queue: data.queue.map((t: Track) => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
      album: { id: t.album.id, name: t.album.name, picUrl: t.album.picUrl },
      duration: t.duration,
    })),
    index: data.core.index,
    currentTime: data.currentTime,
    playMode: data.playMode,
  };

  await setStoreValue("player_state", payload);
}

export function initQueuePersistence() {
  usePlayerStore.subscribe((state, prevState) => {
    if (
      state.queue === prevState.queue &&
      state.core.index === prevState.core.index &&
      state.playMode === prevState.playMode
    )
      return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistQueue, 2000);
  });

  window.addEventListener("beforeunload", () => {
    clearTimeout(saveTimer);
    persistQueue();
  });
}
