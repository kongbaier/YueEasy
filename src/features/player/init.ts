import { createPlayModeStrategy } from "@/features/player/core";
import type { PlayMode, Track } from "@/features/player/core/types";
import { usePlayerStore } from "@/features/player/store";
import { getSetting, setSetting } from "@/shared/services/tauri";

// ── restore saved player state ──

export async function initPlayer() {
  let raw: string;
  try {
    raw = await getSetting("player_state");
  } catch {
    return;
  }
  if (!raw) return;

  let data: {
    queue: Track[];
    index: number;
    currentTime: number;
    playMode: PlayMode;
    volume: number;
    muted: boolean;
  };
  try {
    data = JSON.parse(raw);
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
}

// ── persist queue on change ──

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function persistQueue() {
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
    volume: data.volume,
    muted: data.muted,
  };

  setSetting("player_state", JSON.stringify(payload)).catch(() => {});
}

export function initQueuePersistence() {
  usePlayerStore.subscribe((state, prevState) => {
    if (
      state.queue === prevState.queue &&
      state.core.index === prevState.core.index &&
      state.playMode === prevState.playMode &&
      state.volume === prevState.volume &&
      state.muted === prevState.muted
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
