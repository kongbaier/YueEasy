import { create } from 'zustand';
import * as playerApi from '@/tauri/player';
import { useSettingsStore } from '@/stores/settings';
import { usePlayerMirrorStore } from '@/stores/playerMirror';
import { useLikeStore } from '@/modules/like/stores/like';
import { NEXT_RUST_STRATEGY } from '@/shared/constants/player';

// ── Store ──
//
// 音频迁移 Rust 后，播放状态（playing）、进度（currentTime/currentTimeHigh）的权威在
// Rust 音频引擎：`playing` 由 `player:status-changed` 事件驱动，进度由 usePlaybackClock
// 本地 rAF 插值 + 周期 invoke `get_position` 校准。本 store 是纯本地镜像 + 传输命令层
// （命令经 `@/tauri/player`，ui/hooks 不直接 invoke）。

export interface PlayerStore {
  playing: boolean;
  loading: boolean;
  currentTime: number;
  currentTimeHigh: number;
  duration: number;

  /** 跳转到指定位置（乐观更新 + 提交 Rust）。 */
  seek: (time: number) => void;
  /** 开始/恢复播放（无已加载 source 时 Rust 侧自动重载当前曲目）。 */
  play: () => Promise<void>;
  pause: () => void;
  /** 播放/暂停切换（loading 中忽略）。 */
  toggle: () => void;
  /** 设置音量并下发音量到 Rust 音频引擎（前端 settings 持久化权威）。 */
  setVolume: (volume: number) => void;
  /** 静音切换（静音 = 音量 0，取消静音 = 恢复原音量）。 */
  setMuted: (muted: boolean) => void;
  /** 播放模式档位循环（含心动模式与漫游的 LoopOne↔FM）。 */
  cycleStrategy: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  playing: false,
  loading: false,
  currentTime: 0,
  currentTimeHigh: 0,
  duration: 0,

  seek: (time) => {
    set({ currentTime: time, currentTimeHigh: time });
    void playerApi.seek(time);
  },

  play: async () => {
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

  cycleStrategy: () => {
    const mirror = usePlayerMirrorStore.getState();
    const { iterationStrategy, contentSource, currentTrack } = mirror;

    if (contentSource === 'personal_fm') {
      // 漫游：单曲循环 ↔ 漫游前进（FM 队列顺序播放）。LoopOne = 临时多听几遍。
      // 退出漫游不在这里 —— 靠其他列表的「播放/播放全部」自动 exit_fm。
      if (iterationStrategy === 'loop_one') {
        void playerApi.setIterationStrategy('sequential'); // 切回漫游前进
      } else {
        void playerApi.setIterationStrategy('loop_one'); // 单曲循环多听几遍
      }
      return;
    }

    if (contentSource === 'heartbeat') {
      // 心动：切回普通队列
      void playerApi.setContentSource('queue');
      return;
    }

    // queue 源：策略循环，shuffle 后若「当前曲被喜欢 + 有喜欢歌单」插入心动档位
    const like = useLikeStore.getState();
    if (
      iterationStrategy === 'shuffle' &&
      currentTrack &&
      like.isLiked(currentTrack.track_id) &&
      like.likedPlaylistId != null
    ) {
      void playerApi.enterHeartbeat(
        currentTrack.track_id,
        like.likedPlaylistId,
      );
      return;
    }
    void playerApi.setIterationStrategy(NEXT_RUST_STRATEGY[iterationStrategy]);
  },
}));
