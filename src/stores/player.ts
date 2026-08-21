// usePlayerStore —— 播放编排 + transport 状态（不持久化）。
//
// 职责：把「引擎决策（useQueueStore）+ 播放 URL + audioCore」编排成播放动作，
// 并持有 transport 状态（playing/loading/currentTime/duration）与当前曲。
// 持久化在 useQueueStore（低频、plugin-store）；本 store 不套 persist。
//
// playing/loading 采用「乐观更新 + 事件同步兜底」：
//   - 乐观：resolveAndPlay 开头 loading=true、play 事件 playing=true 即时反馈
//   - 兜底：audioCore 原生事件（play/playing/waiting/pause/ended/error）权威校正
// currentTime 由 audioCore timeupdate 事件驱动（~4Hz，够进度条）；逐字歌词的 60fps
// 时间不走本 store，由 useActiveLine 本地 rAF 直读 audioCore.getPosition()。

import { create } from 'zustand';
import { useSettingsStore } from '@/stores/settings';
import { useQueueStore, playerEngine } from '@/stores/queue';
import type { QueueItem } from '@/shared/types/entities';
import type {
  RepeatMode,
  RustContentSource,
  Track,
} from '@/shared/types/player';
import { NEXT_REPEAT } from '@/shared/constants/player';
import { songToQueueItem } from '@/shared/utils/mappers';
import { audioCore } from '@/shared/lib/audio/AudioCore';
import type { PlayerSnapshot } from '@/modules/player/core/types';
import {
  fetchFm,
  resolveUrl,
  trashFm,
} from '@/modules/player/services/PlayerService';

export { formatQueueCount } from '@/shared/utils/format';

/** track_id → url 缓存（LoopOne 重播 / 同曲重播免再 resolve）。 */
const lastUrlCache = new Map<number, string>();
/** 快速切歌竞态防护：新 load 开始则旧 async resolve/play 失效。 */
let playSeq = 0;
/** FM 续歌防死循环上限（对齐 Rust「续歌无新曲目」停止语义）。 */
const FM_CONTINUE_MAX = 8;

/** 播放编排：乐观 loading → resolve URL → load+play。playing/loading 由 audio 事件校正。 */
async function resolveAndPlay(item: QueueItem): Promise<void> {
  const seq = ++playSeq;
  usePlayerStore.setState({
    currentTrack: item,
    currentTime: 0,
    duration: item.duration_secs,
    loading: true,
  });
  try {
    let url = lastUrlCache.get(item.track_id);
    if (!url) {
      url = await resolveUrl(item.track_id);
      if (seq !== playSeq) return; // 已被更新的切歌取代
      lastUrlCache.set(item.track_id, url);
    }
    audioCore.load(url);
    await audioCore.play();
  } catch (err) {
    if (seq === playSeq) {
      usePlayerStore.setState({ loading: false, playing: false });
      console.warn('[player] 播放失败:', err);
    }
  }
}

/** FM 续歌循环：End + personal_fm → fetch → appendFm → 重推进。带防死循环 guard。 */
async function fmContinuation(): Promise<void> {
  const q = () => useQueueStore.getState();
  for (let i = 0; i < FM_CONTINUE_MAX; i++) {
    const before = playerEngine.queueItems().length;
    const tracks = await fetchFm();
    if (tracks.length === 0) {
      await pauseAudio();
      return;
    }
    q().appendFm(tracks);
    if (playerEngine.queueItems().length === before) {
      await pauseAudio(); // 无新曲目，停止不空转
      return;
    }
    const step = q().manualNext();
    if (step.type === 'play') {
      await resolveAndPlay(playerEngine.queueItems()[step.index]);
      return;
    }
    // 仍 End → 继续取；超上限停止
  }
  await pauseAudio();
}

async function pauseAudio(): Promise<void> {
  audioCore.pause();
  usePlayerStore.setState({ playing: false, loading: false });
}

/** 自然播放结束：按 repeat 推进 / FM 续歌 / 停。 */
async function handleEnded(): Promise<void> {
  if (playerEngine.queueItems().length === 0) {
    await pauseAudio();
    return;
  }
  const step = useQueueStore.getState().onTrackEnd();
  if (step.type === 'play') {
    await resolveAndPlay(playerEngine.queueItems()[step.index]);
  } else if (step.type === 'replayCurrent') {
    const cur = playerEngine.currentTrack();
    if (cur) await resolveAndPlay(cur);
  } else if (useQueueStore.getState().contentSource === 'personal_fm') {
    await fmContinuation();
  } else {
    await pauseAudio();
  }
}

// 单次订阅 AudioCore 事件（模块加载挂载一次）。
// playing/loading 权威来自 audio 事件；乐观更新已在 action/resolveAndPlay 里先行。
audioCore.on('timeupdate', (pos) => {
  usePlayerStore.setState({ currentTime: pos });
});
audioCore.on('play', () => {
  usePlayerStore.setState({ playing: true, loading: true });
});
audioCore.on('playing', () => {
  usePlayerStore.setState({ playing: true, loading: false });
});
audioCore.on('waiting', () => {
  usePlayerStore.setState({ loading: true });
});
audioCore.on('pause', () => {
  usePlayerStore.setState({ playing: false, loading: false });
});
audioCore.on('ended', () => {
  void handleEnded();
});
audioCore.on('error', (msg) => {
  usePlayerStore.setState({ playing: false, loading: false });
  console.warn('[player] audio error:', msg);
});

// ── Store 定义 ──

export interface PlayerStore {
  // transport / 编排状态
  currentTrack: QueueItem | null;
  playing: boolean;
  loading: boolean;
  currentTime: number;
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

  // 队列命令（编排）
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

  /** 启动恢复：交给 queue store 重建引擎并回填本 store 当前曲。 */
  restore: (snapshot: PlayerSnapshot) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  playing: false,
  loading: false,
  currentTime: 0,
  duration: 0,

  restore: (snapshot) => {
    useQueueStore.getState().restore(snapshot);
    playSeq += 1;
    lastUrlCache.clear();
    usePlayerStore.setState({
      currentTrack: playerEngine.currentTrack(),
      duration: playerEngine.currentTrack()?.duration_secs ?? 0,
      currentTime: 0,
      playing: false,
      loading: false,
    });
    audioCore.pause(); // audio 置空闲，不自动播放
  },

  seek: (time) => {
    set({ currentTime: time });
    audioCore.seek(time);
  },
  resume: async () => {
    if (get().loading) return;
    const q = () => useQueueStore.getState();
    // ended 后点播放 → 从头播放队列
    if (q().isEnded()) {
      const track = q().restart();
      if (track) await resolveAndPlay(track);
      return;
    }
    const cur = playerEngine.currentTrack();
    if (!cur) return;
    // 无已加载 source（恢复/清空后）→ 重载当前曲
    if (audioCore.getStatus() === 'idle') {
      await resolveAndPlay(cur);
      return;
    }
    await audioCore.play(); // play → playing/waiting 事件驱动 playing/loading
  },
  pause: () => {
    audioCore.pause(); // pause 事件驱动 playing/loading
  },
  toggle: () => {
    if (get().loading) return;
    void (get().playing ? get().pause() : get().resume());
  },
  setVolume: (volume) => {
    useSettingsStore.getState().updatePlayer({ volume, isMuted: false });
    audioCore.setVolume(volume);
  },
  setMuted: (muted) => {
    const player = useSettingsStore.getState().player;
    if (player.isMuted === muted) return;
    useSettingsStore.getState().updatePlayer({ isMuted: muted });
    audioCore.setVolume(muted ? 0 : player.volume);
  },
  cycleRepeat: () => {
    const q = () => useQueueStore.getState();
    const { repeat, contentSource } = q();
    const next: RepeatMode =
      contentSource === 'personal_fm'
        ? repeat === 'one'
          ? 'off'
          : 'one'
        : NEXT_REPEAT[repeat];
    q().setRepeat(next);
  },
  toggleShuffle: () => {
    const q = () => useQueueStore.getState();
    if (q().contentSource === 'personal_fm') return;
    q().setOrder(q().order === 'shuffle' ? 'sequential' : 'shuffle');
  },

  play: async (track) => {
    const cur = useQueueStore.getState().playTrack(songToQueueItem(track));
    if (cur) await resolveAndPlay(cur);
  },
  replaceAndPlay: async (tracks, startIndex = 0) => {
    const cur = useQueueStore
      .getState()
      .replacePlay(tracks.map(songToQueueItem), startIndex);
    if (cur) await resolveAndPlay(cur);
  },
  next: async () => {
    const step = useQueueStore.getState().manualNext();
    if (step.type === 'play') {
      await resolveAndPlay(playerEngine.queueItems()[step.index]);
    } else if (step.type === 'end') {
      if (useQueueStore.getState().contentSource === 'personal_fm')
        await fmContinuation();
      else await pauseAudio();
    }
  },
  prev: async () => {
    const cur = useQueueStore.getState().prev();
    if (cur) await resolveAndPlay(cur);
  },
  addToQueue: async (track) => {
    useQueueStore.getState().append([songToQueueItem(track)]);
  },
  playNext: async (track) => {
    useQueueStore.getState().insertNext(songToQueueItem(track));
  },
  playFromIndex: async (index) => {
    const cur = useQueueStore.getState().playQueueAt(index);
    if (cur) await resolveAndPlay(cur);
  },
  removeFromQueue: async (index) => {
    const before = playerEngine.currentTrack()?.track_id;
    useQueueStore.getState().removeAt(index);
    const after = playerEngine.currentTrack();
    if (after?.track_id !== before) {
      if (after) await resolveAndPlay(after);
      else await pauseAudio();
    }
  },
  clearQueue: () => {
    useQueueStore.getState().clear();
    audioCore.pause();
    set({
      currentTrack: null,
      playing: false,
      loading: false,
      currentTime: 0,
      duration: 0,
    });
  },
  setContentSource: async (source) => {
    const q = () => useQueueStore.getState();
    if (source === 'personal_fm') {
      const tracks = await fetchFm();
      if (tracks.length === 0) return;
      q().enterFm(tracks[0]);
      const cur = playerEngine.currentTrack();
      if (cur) await resolveAndPlay(cur);
    } else {
      const cur = q().exitFm();
      if (cur) await resolveAndPlay(cur);
    }
  },
  fmTrash: async () => {
    const q = () => useQueueStore.getState();
    if (!q().isFmActive()) return;
    const removed = q().removeFmCurrent();
    if (!removed) return;
    await trashFm(removed.track_id); // 上报服务端
    const cur = playerEngine.currentTrack();
    if (cur) await resolveAndPlay(cur);
    else await pauseAudio();
  },
}));
