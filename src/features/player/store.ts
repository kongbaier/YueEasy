import { create } from "zustand";
import {
  createPlayModeStrategy,
  PlayerCore,
} from "@/features/player/core";
import type { PlayMode, PlayerState, Track } from "@/features/player/core/types";
import { resolveUrl } from "@/shared/services/track";
import { getStoreValue, setStoreValue } from "@/shared/services/store";

const player = new PlayerCore<Track>();

let urlFetchedAt = 0;

let isSkipping = false;

async function addOrPlayNext(track: Track, position: "append" | "afterCurrent") {
  const { currentTrack, queue } = usePlayerStore.getState();
  if (queue.some((item) => item.id === track.id)) return;

  if (!currentTrack) {
    player.setQueue([track], 0);
    usePlayerStore.setState({
      queue: player.queue,
      currentTrack: player.currentTrack ?? null,
    });
    await playCurrent();
    return;
  }

  if (position === "afterCurrent") {
    player.insert(track, player.index + 1);
  } else {
    player.add(track);
  }
  usePlayerStore.setState({ queue: player.queue });
}

async function playCurrent() {
  const track = player.currentTrack;
  if (!track) {
    return;
  }
  const url = await resolveUrl(track.id);
  urlFetchedAt = Date.now();
  await player.load(url);
  await player.play();
}

interface PlayerStore {
  currentTrack: Track | null;
  queue: Track[];
  playing: boolean;
  playerState: PlayerState;
  playMode: PlayMode;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;

  play: (track: Track) => Promise<void>;
  replaceAndPlay: (tracks: Track[], startIndex?: number) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (time: number) => void;
  setMode: (mode: PlayMode) => void;
  cycleMode: () => void;
  addToQueue: (track: Track) => Promise<void>;
  playNext: (track: Track) => Promise<void>;
  playFromIndex: (index: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => {
  player.on("stateChange", (state) => {
    const wasEnded = state === "ended";
    set({ playing: state === "playing", playerState: state });
    if (wasEnded) {
      playCurrent().catch(() => player.stop());
    }
  });

  player.on("trackChange", (track) => {
    set({ currentTrack: track ?? null, currentTime: 0, duration: 0 });
  });

  player.on("timeUpdate", (currentTime) => {
    set({ currentTime });
  });

  player.on("durationChange", (duration) => {
    set({ duration });
  });

  return {
    currentTrack: player.currentTrack ?? null,
    queue: player.queue,
    playing: false,
    playerState: player.state,
    playMode: "sequential",
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,

    play: async (track) => {
      const { currentTrack, queue } = get();
      if (!currentTrack || queue.length === 0) {
        player.setQueue([track], 0);
      } else if (queue.some((item) => item.id === track.id)) {
        player.index = queue.findIndex((t) => t.id === track.id);
      } else {
        player.insert(track, player.index + 1);
        player.index = player.index + 1;
      }
      set({
        queue: player.queue,
        currentTrack: player.currentTrack ?? null,
      });
      await playCurrent();
    },

    replaceAndPlay: async (tracks, startIndex = 0) => {
      player.setQueue(tracks, startIndex);
      set({
        queue: player.queue,
        currentTrack: player.currentTrack ?? null,
      });
      await playCurrent();
    },

    pause: () => player.pause(),

    resume: async () => {
      if (Date.now() - urlFetchedAt > 15 * 60 * 1000) {
        const track = player.currentTrack;
        if (!track) return;
        const savedTime = get().currentTime;
        const url = await resolveUrl(track.id);
        urlFetchedAt = Date.now();
        await player.load(url);
        player.seek(savedTime);
        await player.play();
      } else {
        await player.play();
      }
    },

    next: async () => {
      if (isSkipping) return;
      isSkipping = true;
      try {
        player.next();
        await playCurrent();
      } finally {
        isSkipping = false;
      }
    },

    prev: async () => {
      if (isSkipping) return;
      isSkipping = true;
      try {
        player.prev();
        await playCurrent();
      } finally {
        isSkipping = false;
      }
    },

    seek: (time) => {
      set({ currentTime: time });
      player.seek(time);
    },

    setMode: (mode) => {
      player.mode = createPlayModeStrategy(mode);
      set({ playMode: mode });
    },

    cycleMode: () => {
      const { playMode } = get();
      const next: PlayMode =
        playMode === "sequential"
          ? "shuffle"
          : playMode === "shuffle"
            ? "repeatOne"
            : "sequential";
      player.mode = createPlayModeStrategy(next);
      set({ playMode: next });
    },

    addToQueue: async (track) => {
      await addOrPlayNext(track, "append");
    },

    playNext: async (track) => {
      await addOrPlayNext(track, "afterCurrent");
    },

    playFromIndex: async (index) => {
      const queue = player.queue;
      if (index < 0 || index >= queue.length) return;
      player.index = index;
      await playCurrent();
    },

    removeFromQueue: async (index) => {
      const queue = player.queue;
      const track = queue[index];
      if (!track) return;

      const isCurrent = get().currentTrack?.id === track.id;
      player.remove(track.id);

      if (isCurrent) {
        const newQueue = player.queue;
        if (newQueue.length === 0) {
          player.stop();
          set({ queue: [], currentTrack: null });
          return;
        }
        set({
          queue: player.queue,
          currentTrack: player.currentTrack ?? null,
        });
        await playCurrent();
        return;
      }

      set({ queue: player.queue });
    },

    clearQueue: () => {
      player.replace([]);
      player.stop();
      set({ queue: [], currentTrack: null });
    },

    setVolume: (v: number) => {
      player.volume = v;
      set({ volume: v, muted: false });
      setStoreValue("volume", v);
    },

    setMuted: (m: boolean) => {
      player.muted = m;
      set({ muted: m });
      setStoreValue("muted", m);
    },
  };
});

// activate queue persistence listeners (must run after store is created)
initQueuePersistence();

// ── self-init: restore saved player state ──

let playerInitRan = false;

export async function initPlayerStore() {
  if (playerInitRan) return;
  playerInitRan = true;

  const raw = await getStoreValue("player_state");
  if (!raw) return;

  const data = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
    queue: Track[];
    index: number;
    currentTime: number;
    playMode: PlayMode;
  };
  if (!data.queue?.length) return;

  const tracks: Track[] = data.queue as Track[];
  const index = Math.min(Math.max(data.index, 0), tracks.length - 1);

  const savedVolume = (await getStoreValue<number>("volume")) ?? 1;
  const savedMuted = (await getStoreValue<boolean>("muted")) ?? false;
  usePlayerStore.setState({ volume: savedVolume, muted: savedMuted });

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

// ── queue persistence ──

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
    index: player.index,
    currentTime: data.currentTime,
    playMode: data.playMode,
  };

  await setStoreValue("player_state", payload);
}

let lastPersistedIndex = -1;

function initQueuePersistence() {
  usePlayerStore.subscribe((state, prevState) => {
    const currentIndex = player.index;
    if (
      state.queue === prevState.queue &&
      currentIndex === lastPersistedIndex &&
      state.playMode === prevState.playMode
    )
      return;
    lastPersistedIndex = currentIndex;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistQueue, 2000);
  });

  window.addEventListener("beforeunload", () => {
    clearTimeout(saveTimer);
    persistQueue();
  });
}

// fire module-level init — non-blocking, idempotent
initPlayerStore().catch(() => {});
