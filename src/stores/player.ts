import { create } from 'zustand';
import * as playerApi from '@/tauri/player';
import { useSettingsStore } from '@/stores/settings';
import type { QueueItem } from '@/shared/types/entities';
import type {
  Order,
  PlayerEventPayload,
  RepeatMode,
  RustContentSource,
  Track,
} from '@/shared/types/player';
import { NEXT_REPEAT } from '@/shared/constants/player';
import { songToQueueItem } from '@/shared/utils/mappers';

export { formatQueueCount } from '@/shared/utils/format';

export function isQueueEnded(err: unknown): boolean {
  if (err instanceof Error) return err.message === 'queue ended';
  return String(err) === 'queue ended';
}

async function withLoading(op: () => Promise<unknown>): Promise<void> {
  usePlayerStore.setState({ loading: true });
  try {
    await op();
  } catch (err) {
    usePlayerStore.setState({ loading: false });
    if (isQueueEnded(err)) return;
    throw err;
  }
}

export interface PlayerStore {
  // 镜像状态（Rust 事件驱动）
  currentTrack: QueueItem | null;
  queue: QueueItem[];
  currentIndex: number | null;
  order: Order;
  repeat: RepeatMode;
  contentSource: RustContentSource;
  // transport 状态
  playing: boolean;
  loading: boolean;
  currentTime: number;
  currentTimeHigh: number;
  duration: number;
  // transport 命令
  seek: (time: number) => void;
  resume: () => Promise<void>;
  pause: () => void;
  toggle: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  // 队列命令
  play: (track: Track) => Promise<void>;
  replaceAndPlay: (tracks: Track[], startIndex?: number) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  addToQueue: (track: Track) => Promise<void>;
  playNext: (track: Track) => Promise<void>;
  playFromIndex: (index: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => void;
  setContentSource: (source: RustContentSource) => Promise<void>;
  fmTrash: () => Promise<void>;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  queue: [],
  currentIndex: null,
  order: 'sequential',
  repeat: 'off',
  contentSource: 'queue',
  playing: false,
  loading: false,
  currentTime: 0,
  currentTimeHigh: 0,
  duration: 0,

  seek: (time) => {
    set({ currentTime: time, currentTimeHigh: time });
    void playerApi.seek(time);
  },
  resume: async () => {
    if (get().loading) return;
    try {
      await playerApi.play();
    } catch (err) {
      console.warn('[player] 播放失败:', err);
    }
  },
  pause: () => {
    void playerApi.pause();
  },
  toggle: () => {
    if (get().loading) return;
    void (get().playing ? playerApi.pause() : playerApi.play());
  },
  setVolume: (volume) => {
    useSettingsStore.getState().updatePlayer({ volume, isMuted: false });
    void playerApi.setVolume(volume);
  },
  setMuted: (muted) => {
    const player = useSettingsStore.getState().player;
    if (player.isMuted === muted) return;
    useSettingsStore.getState().updatePlayer({ isMuted: muted });
    void playerApi.setVolume(muted ? 0 : player.volume);
  },
  cycleRepeat: () => {
    const { repeat, contentSource } = get();
    if (contentSource === 'personal_fm') {
      void playerApi.setRepeat(repeat === 'one' ? 'off' : 'one');
      return;
    }
    void playerApi.setRepeat(NEXT_REPEAT[repeat]);
  },
  toggleShuffle: () => {
    const { contentSource, order } = get();
    if (contentSource === 'personal_fm') return;
    void playerApi.setShuffle(order !== 'shuffle');
  },

  play: async (track) => {
    await withLoading(() => playerApi.playTrack(songToQueueItem(track)));
  },
  replaceAndPlay: async (tracks, startIndex = 0) => {
    await withLoading(() =>
      playerApi.replaceAndPlay(tracks.map(songToQueueItem), startIndex),
    );
  },
  next: async () => {
    await withLoading(() => playerApi.playNext());
  },
  prev: async () => {
    await withLoading(() => playerApi.playPrev());
  },
  addToQueue: async (track) => {
    await playerApi.appendToQueue([songToQueueItem(track)]);
  },
  playNext: async (track) => {
    await playerApi.insertNext(songToQueueItem(track));
  },
  playFromIndex: async (index) => {
    await withLoading(() => playerApi.playQueueAt(index));
  },
  removeFromQueue: async (index) => {
    await playerApi.removeFromQueue(index);
  },
  clearQueue: () => {
    void playerApi.clearQueue();
  },
  setContentSource: async (source) => {
    await withLoading(() => playerApi.setContentSource(source));
  },
  fmTrash: async () => {
    await withLoading(() => playerApi.fmTrash());
  },
}));

// 事件订阅（模块加载时挂载一次）。
void playerApi.onPlayerEvent((payload: PlayerEventPayload) => {
  switch (payload.event) {
    case 'player:current': {
      const prevTrackId = usePlayerStore.getState().currentTrack?.track_id;
      const nextTrack = payload.data.track;
      usePlayerStore.setState({
        currentTrack: nextTrack,
        currentIndex: payload.data.index,
        order: payload.data.order,
        repeat: payload.data.repeat,
        contentSource: payload.data.source,
      });
      if (nextTrack?.track_id !== prevTrackId) {
        usePlayerStore.setState({
          duration: nextTrack ? nextTrack.duration_secs : 0,
          currentTime: 0,
          currentTimeHigh: 0,
        });
      }
      break;
    }
    case 'player:queue':
      usePlayerStore.setState({
        queue: payload.data.items,
        currentIndex: payload.data.current_index,
      });
      break;
    case 'player:playing':
      usePlayerStore.setState((state) => ({
        playing: payload.data.playing,
        loading: payload.data.playing ? false : state.loading,
      }));
      break;
  }
});
