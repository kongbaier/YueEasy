// PlayerService —— 播放器编排服务（服务层，业务就近）。
//
// 编排权威从旧 PlayerStore 迁出：本模块持有 audioCore + Player 单例，负责
// 「URL 解析（缓存 + 反竞态）→ loadAndPlay → 事件投影 → ended/FM 续歌」全链路，
// 单向写入 usePlayerStore（纯状态容器）与 useQueueStore（队列权威）。
// store 只承载状态，不再持编排；组件命令统一走 `playerService`。
//
// 依赖方向：service → stores / core / data-service / infra（tauri 经 data-service）。

import { usePlayerSettingsStore } from "@/modules/player/stores/playerSettingsStore";
import { usePlayerStore } from "@/modules/player/stores/playerStore";
import {
  useQueueStore,
  queuePolicy,
  fmPolicy,
  type QueueSnapshot,
  type ContentSource,
} from "@/modules/player/stores/queueStore";
import type { QueueItem } from "@/shared/types/entities";
import type { RepeatMode, Track } from "@/shared/types/player";
import { NEXT_REPEAT } from "@/shared/constants/player";
import { songToQueueItem } from "@/shared/utils/mappers";
import { AudioCore } from "@/shared/lib/player-core/audio";
import { Player } from "@/modules/player/core/player";
import type { Track as CoreTrack } from "@/shared/lib/player-core/models/track";
import {
  fetchFm,
  resolveUrl,
  trashFm,
} from "@/modules/player/services/PlayerDataService";
import { recordPlay } from "@/modules/player/services/PlayHistoryService";

/** QueueItem → 库 Track（URL 留空，由 resolver 解析后注入）。 */
function queueItemToCoreTrack(item: QueueItem): CoreTrack {
  const { track_id, ...rest } = item;
  return { id: String(track_id), src: "", ...rest };
}

// ── URL 解析（缓存 + 反竞态 seq） ──
const lastUrlCache = new Map<string, string>();
let playSeq = 0;
/** FM 续歌防死循环上限（对齐旧实现）。 */
const FM_CONTINUE_MAX = 8;

// ── 库音频 / Player 门面（共享同一 AudioCore 实例） ──
// audioCore：物理层，订阅其事件驱动 transport；player：编排层（policy + resolver + load/play）。
export const audioCore = new AudioCore();
const player = new Player(audioCore, queuePolicy, async (track) => {
  // 反竞态：被更新的切歌取代则返回 null（Player 跳过 load/play）
  const mySeq = playSeq;
  const key = track.id;
  let url = lastUrlCache.get(key);
  if (!url) {
    url = await resolveUrl(Number(key));
    if (mySeq !== playSeq) return null; // 已被更新的切歌取代
    lastUrlCache.set(key, url);
  }
  return url;
});

// 单次订阅音频事件（模块加载挂载一次）。状态权威来自 AudioCore 状态投影（status）。
audioCore.on("timeupdate", (pos) => {
  usePlayerStore.setState({ currentTime: pos });
});
audioCore.on("status", (status) => {
  usePlayerStore.setState({
    playing: status === "playing" || status === "buffering",
    loading: status === "loading",
    buffering: status === "buffering",
  });
});
audioCore.on("ended", () => {
  void handleEnded();
});
audioCore.on("error", () => {
  usePlayerStore.setState({ playing: false, loading: false });
  console.warn("[player] audio error");
});

const queueStore = () => useQueueStore.getState();

/** 播放编排：乐观 loading → resolve（经 resolver）→ load+play（经 Player）。 */
async function resolveAndPlay(item: QueueItem): Promise<void> {
  recordPlay(item); // 本地播放记录（fire-and-forget，受开关控制）
  const seq = ++playSeq;
  usePlayerStore.setState({
    currentTrack: item,
    currentTime: 0,
    duration: item.duration_secs,
    loading: true,
  });
  await player.loadAndPlay(queueItemToCoreTrack(item));
  if (seq !== playSeq) return; // 已被更新的切歌取代
}

/** FM 续歌循环：End + personal_fm → fetch → appendFm → 重推进。带防死循环 guard。 */
async function fmContinuation(): Promise<void> {
  for (let i = 0; i < FM_CONTINUE_MAX; i++) {
    const before = fmPolicy.tracks.length;
    const tracks = await fetchFm();
    if (tracks.length === 0) {
      pauseAudio();
      return;
    }
    queueStore().appendFm(tracks);
    if (fmPolicy.tracks.length === before) {
      pauseAudio(); // 无新曲目，停止不空转
      return;
    }
    const step = queueStore().manualNext();
    if (step.type === "play") {
      const track = queueStore().queue[step.index];
      if (track) await resolveAndPlay(track);
      return;
    }
    // 仍 End → 继续取；超上限停止
  }
  pauseAudio();
}

function pauseAudio(): void {
  player.pause();
  usePlayerStore.setState({ playing: false, loading: false });
}

/** 自然播放结束：按 repeat 推进 / FM 续歌 / 停。 */
async function handleEnded(): Promise<void> {
  if (queueStore().queue.length === 0) {
    pauseAudio();
    return;
  }
  const step = queueStore().onTrackEnd();
  if (step.type === "play") {
    const track = queueStore().queue[step.index];
    if (track) await resolveAndPlay(track);
  } else if (step.type === "replayCurrent") {
    const cur = queueStore().currentTrack();
    if (cur) await resolveAndPlay(cur);
  } else if (queueStore().isFmActive()) {
    await fmContinuation();
  } else {
    pauseAudio();
  }
}

export interface PlayerController {
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
  setContentSource: (source: ContentSource) => Promise<void>;
  fmTrash: () => Promise<void>;

  /** 启动恢复：交给 queue store 重建两条 policy 并回填 transport 当前曲。 */
  restore: (snapshot: QueueSnapshot) => void;
}

export const playerService: PlayerController = {
  restore: (snapshot) => {
    useQueueStore.getState().restore(snapshot);
    playSeq += 1;
    lastUrlCache.clear();
    usePlayerStore.setState({
      currentTrack: useQueueStore.getState().currentTrack(),
      duration: useQueueStore.getState().currentTrack()?.duration_secs ?? 0,
      currentTime: 0,
      playing: false,
      loading: false,
      buffering: false,
    });
    audioCore.reset();
  },

  seek: (time) => {
    usePlayerStore.setState({ currentTime: time });
    player.seek(time);
  },
  resume: async () => {
    if (usePlayerStore.getState().loading) return;
    const q = () => useQueueStore.getState();
    // ended 后点播放 → 从头播放队列
    if (q().isEnded()) {
      const track = q().restart();
      if (track) await resolveAndPlay(track);
      return;
    }
    const cur = q().currentTrack();
    if (!cur) return;
    // 无已加载 source（恢复/清空后）→ 重载当前曲
    if (audioCore.getStatus() === "idle") {
      await resolveAndPlay(cur);
      return;
    }
    await player.play(); // play → playing 事件驱动 playing/loading
  },
  pause: () => {
    player.pause();
  },
  toggle: () => {
    if (usePlayerStore.getState().loading) return;
    void (
      usePlayerStore.getState().playing
        ? playerService.pause()
        : playerService.resume()
    );
  },
  setVolume: (volume) => {
    usePlayerSettingsStore.getState().updatePlayer({ volume, isMuted: false });
    player.volume = volume;
  },
  setMuted: (muted) => {
    const p = usePlayerSettingsStore.getState().player;
    if (p.isMuted === muted) return;
    usePlayerSettingsStore.getState().updatePlayer({ isMuted: muted });
    player.volume = muted ? 0 : p.volume;
  },
  cycleRepeat: () => {
    const q = () => useQueueStore.getState();
    const { repeat, contentSource } = q();
    const next: RepeatMode =
      contentSource === "personal_fm"
        ? repeat === "one"
          ? "off"
          : "one"
        : NEXT_REPEAT[repeat];
    q().setRepeat(next);
  },
  toggleShuffle: () => {
    const q = () => useQueueStore.getState();
    if (q().contentSource === "personal_fm") return;
    q().setOrder(q().order === "shuffle" ? "sequential" : "shuffle");
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
    const q = () => useQueueStore.getState();
    const step = q().manualNext();
    if (step.type === "play") {
      const track = q().queue[step.index];
      if (track) await resolveAndPlay(track);
    } else if (step.type === "end") {
      if (q().isFmActive()) await fmContinuation();
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
    const q = () => useQueueStore.getState();
    const before = q().currentTrack()?.track_id;
    q().removeAt(index);
    const after = q().currentTrack();
    if (after?.track_id !== before) {
      if (after) await resolveAndPlay(after);
      else await pauseAudio();
    }
  },
  clearQueue: () => {
    useQueueStore.getState().clear();
    audioCore.reset();
    usePlayerStore.setState({
      currentTrack: null,
      playing: false,
      loading: false,
      buffering: false,
      currentTime: 0,
      duration: 0,
    });
  },
  setContentSource: async (source) => {
    const q = () => useQueueStore.getState();
    if (source === "personal_fm") {
      const tracks = await fetchFm();
      if (tracks.length === 0) return;
      q().enterFm(tracks[0]);
      const cur = q().currentTrack();
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
    await trashFm(removed.track_id);
    const cur = q().currentTrack();
    if (cur) await resolveAndPlay(cur);
    else await pauseAudio();
  },
};
