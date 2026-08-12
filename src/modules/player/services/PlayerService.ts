import { AudioCore } from '@/shared/lib/audio/AudioCore';
import { EventEmitter } from '@/shared/lib/EventEmitter';
import type { PlayerSettings } from '@/shared/types/settings';
import type { FullPlayerState, PlayUrlInfo } from '@/shared/types/player';
import { usePlayerMirrorStore } from '@/stores/playerMirror';
import { useSettingsStore } from '@/stores/settings';
import { invoke } from '@tauri-apps/api/core';

/**
 * Rust `advance_once` 的正常结束哨兵（队尾 / 队列空）—— 非错误，不上抛。
 * 调用方（queue store 的 `next` / `fmTrash`、本服务的 `#handleEnded` / `resumeFromEnd`）识别后静默吞掉。
 */
export function isQueueEnded(err: unknown): boolean {
  if (err instanceof Error) return err.message === 'queue ended';
  return String(err) === 'queue ended';
}

// ── Service events (engine state broadcasts) ──

export type PlayerEvents = {
  play: [];
  pause: [];
  ended: [];
  timeupdate: [currentTime: number];
  timetick: [currentTime: number];
  durationchange: [duration: number];
  loading: [];
  ready: [];
  error: [error: Error];
  queuechange: [];
};

class PlayerService {
  #audio: AudioCore;
  #events = new EventEmitter<PlayerEvents>();
  // 位置持久化：周期上报 timer（单个 setInterval，暂停即清除）+ seek 去抖
  #positionTimer: number | null = null;
  #seekDebounceTimer: number | null = null;
  // end-after 决策防重入（ended 回调 / resumeFromEnd 并发时只允许一个接管）
  #endInProgress: boolean = false;

  constructor() {
    this.#audio = new AudioCore();
    // ended 决策编排：AudioCore 不感知队列/策略，由本服务询问 Rust 下一步
    this.#audio.setOnEndedHandler(() => this.#handleEnded());
    this.#wireAudio();
    this.#applyPlayerSettings(useSettingsStore.getState().player);

    // Player preferences (settings store) are the single source of truth;
    // apply them to the engine whenever they change.
    useSettingsStore.subscribe((state, prev) => {
      if (state.player.volume !== prev.player.volume) {
        this.setVolume(state.player.volume);
      }
      if (state.player.isMuted !== prev.player.isMuted) {
        this.setMuted(state.player.isMuted);
      }
    });
  }

  /** Forward engine events (player store mirrors them). */
  #wireAudio(): void {
    this.#audio.on('play', () => {
      this.#events.emit('play');
      this.#startPositionReporting();
    });
    this.#audio.on('pause', () => {
      this.#events.emit('pause');
      this.#stopPositionReporting();
      // 暂停即落盘（位置 + playing=false）
      void this.#reportPositionNow();
    });
    this.#audio.on('loading', () => {
      this.#events.emit('loading');
      // 切歌加载新源：暂停周期上报（旧曲目位置已在切歌前由 flushPosition 上报）
      this.#stopPositionReporting();
    });
    this.#audio.on('ready', () => this.#events.emit('ready'));
    this.#audio.on('error', (error: Error) => {
      this.#events.emit('error', error);
    });
    this.#audio.on('timeupdate', (currentTime: number) =>
      this.#events.emit('timeupdate', currentTime),
    );
    this.#audio.on('timetick', (currentTime: number) =>
      this.#events.emit('timetick', currentTime),
    );
    this.#audio.on('durationchange', (duration: number) =>
      this.#events.emit('durationchange', duration),
    );
    this.#audio.on('ended', () => {
      this.#events.emit('ended');
      this.#stopPositionReporting();
      // 曲目自然结束也落盘（结束位置 + playing=false）
      void this.#reportPositionNow();
      // 推进职责已下放给 setOnEndedHandler 注册的 #handleEnded 回调
    });
  }

  /**
   * end-after 决策（AudioCore ended → Rust `decide_after_end` → load + play）。
   * Rust 决策层是单一权威：PlayTrack/NeedFmTrack → PlayUrlInfo；队列耗尽 → Err("queue ended")。
   * 与旧 `#advanceOnEnd` 的关键差别：不再假设返回 URL，Stopped（queue ended）是合法结果。
   */
  async #dispatchEndAction(): Promise<void> {
    const result = await invoke<PlayUrlInfo>('decide_after_end');
    await this.#audio.load(result.url);
    await this.#audio.play();
  }

  /**
   * AudioCore ended 回调：询问 Rust "end 后该做什么"。
   * 队尾（queue ended）自然保持暂停；其他错误记日志不阻断（与 restorePlayerState 同策略）。
   */
  #handleEnded = async (): Promise<void> => {
    if (this.#endInProgress) return; // 防重入
    this.#endInProgress = true;
    try {
      await this.#dispatchEndAction();
    } catch (err) {
      if (isQueueEnded(err)) return; // 队尾：自然保持暂停
      console.warn('[PlayerService] 曲目自然结束推进失败（保持暂停）:', err);
    } finally {
      this.#endInProgress = false;
    }
  };

  #applyPlayerSettings(settings: PlayerSettings): void {
    this.setVolume(settings.volume);
    this.setMuted(settings.isMuted);
  }

  // ── 位置持久化（上报播放进度/状态，快照仅存此值） ──

  /** 上报当前播放位置/状态。失败静默（非关键路径，重启恢复兜底）。 */
  async #reportPositionNow(): Promise<void> {
    try {
      // Tauri v2：Rust 参数 position_secs / playing → JS 侧 camelCase `positionSecs`
      await invoke<void>('report_position', {
        positionSecs: this.#audio.currentTime,
        playing: this.#audio.playing,
      });
    } catch {
      // 上报失败不阻断播放
    }
  }

  /** 播放中每 10s 上报一次（单个 setInterval，暂停/切歌/结束即清除）。 */
  #startPositionReporting(): void {
    if (this.#positionTimer !== null) return;
    this.#positionTimer = window.setInterval(() => {
      void this.#reportPositionNow();
    }, 10_000);
  }

  #stopPositionReporting(): void {
    if (this.#positionTimer !== null) {
      window.clearInterval(this.#positionTimer);
      this.#positionTimer = null;
    }
  }

  /** seek 后 500ms 去抖落盘。暴露给 usePlayer 直连 audioCore.seek 的路径调用。 */
  reportPositionDebounced(): void {
    if (this.#seekDebounceTimer !== null) window.clearTimeout(this.#seekDebounceTimer);
    this.#seekDebounceTimer = window.setTimeout(() => {
      this.#seekDebounceTimer = null;
      void this.#reportPositionNow();
    }, 500);
  }

  /** 切歌前立即上报当前进度（旧曲目的最终位置/状态），随后引擎会重置位置。 */
  async flushPosition(): Promise<void> {
    await this.#reportPositionNow();
  }

  on<K extends keyof PlayerEvents>(
    event: K,
    listener: (...args: PlayerEvents[K]) => void,
  ): () => void {
    return this.#events.on(event, listener);
  }

  // ── Engine state (single source of truth) ──

  /** 暴露只读 AudioCore 引用给 Rust 模式 load/play/切换。 */
  get audioCore(): AudioCore {
    return this.#audio;
  }

  get currentTime(): number {
    return this.#audio.currentTime;
  }

  get duration(): number {
    return this.#audio.duration;
  }

  get playing(): boolean {
    return this.#audio.playing;
  }

  // ── 音频控制 ──

  pause(): void {
    this.#audio.pause();
  }

  /**
   * 队尾/ended 态点 play：从队列第一个开始（Sequential 末尾行为）。
   * 复用 decide_after_end：Rust 决策层是单一权威。
   */
  async resumeFromEnd(): Promise<void> {
    if (this.#endInProgress) return; // 让 #handleEnded 接管
    this.#endInProgress = true;
    try {
      await this.#dispatchEndAction();
    } catch (err) {
      if (isQueueEnded(err)) return;
      console.warn('[PlayerService] 队尾恢复失败:', err);
    } finally {
      this.#endInProgress = false;
    }
  }

  seek(time: number): void {
    this.#audio.seek(time);
    // seek 落盘（去抖 500ms 后上报一次）
    this.reportPositionDebounced();
  }

  setVolume(volume: number): void {
    this.#audio.volume = volume;
  }

  setMuted(muted: boolean): void {
    this.#audio.muted = muted;
  }
}

export const playerService = new PlayerService();

/**
 * 启动恢复（bootstrap 调用）。从 Rust 拉取全量快照 → 填充 MirrorStore →
 * 恢复 AudioCore 进度并按上次状态尝试续播。自动续播可能被浏览器手势策略拦截——
 * 失败则保持暂停。
 */
export async function restorePlayerState(): Promise<void> {
  try {
    const { snapshot, current_track } = await invoke<FullPlayerState>(
      'get_full_player_state',
    );
    // 填充镜像（与 usePlayerEvents 的增量事件写入合并；事件监听此时尚未挂载）
    usePlayerMirrorStore.setState({
      currentTrack: current_track,
      queue: snapshot.queue,
      currentIndex: snapshot.current_index,
      iterationStrategy: snapshot.iteration_strategy,
      contentSource: snapshot.content_source,
      playing: snapshot.playing,
    });
    if (!current_track) return;
    // 恢复进度：解析播放 URL → load → seek → 按上次状态尝试续播
    // Tauri v2：Rust 参数 track_id → JS 侧必须 camelCase `trackId`
    const { url } = await invoke<PlayUrlInfo>('resolve_play_url', {
      trackId: current_track.track_id,
      quality: null,
    });
    await playerService.audioCore.load(url);
    if (snapshot.position_secs > 0) {
      playerService.audioCore.seek(snapshot.position_secs);
    }
    if (snapshot.playing) {
      await playerService.audioCore.play();
    }
  } catch (err) {
    // 恢复失败不阻塞启动：队列已入镜像，音频稍后可手动播放
    console.warn('[restorePlayerState] 恢复播放器状态失败（保持暂停）:', err);
  }
}
