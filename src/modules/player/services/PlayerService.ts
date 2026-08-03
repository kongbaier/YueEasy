import { AudioCore, QueueManager } from '@/core';
import type { PlayMode, Track } from '@/core/types';
import { EventEmitter } from '@/shared/lib/EventEmitter';
import type { PlayerSettings } from '@/shared/types/settings';
import { useSettingsStore } from '@/stores/settings';
import { ncm, toFmSong } from '@/tauri/ncm';

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
  #queue: QueueManager;
  #urlFetchedAt = 0;
  #events = new EventEmitter<PlayerEvents>();
  // 切歌串行化：只有最新一次播放请求可以落地，旧请求直接被丢弃
  #playToken = 0;
  // FM 坏歌跳过：连续丢弃超过上限视为推荐全部失效，停止漫游防止死循环
  #fmSkips = 0;
  #fmSkipInFlight = false;
  // 进入漫游前的音频状态快照（退出漫游时恢复到原歌原进度）
  #fmSnapshotAudio: { currentTime: number; playing: boolean } | null = null;
  static #FM_MAX_SKIPS = 3;

  constructor() {
    this.#audio = new AudioCore();
    this.#queue = new QueueManager();
    this.#wireAudio();
    this.#applyPlayerSettings(useSettingsStore.getState().player);

    // Player preferences (settings store) are the single source of truth;
    // apply them to the engines whenever they change.
    useSettingsStore.subscribe((state, prev) => {
      if (state.player.volume !== prev.player.volume) {
        this.setVolume(state.player.volume);
      }
      if (state.player.isMuted !== prev.player.isMuted) {
        this.setMuted(state.player.isMuted);
      }
      if (state.player.playMode !== prev.player.playMode) {
        this.setMode(state.player.playMode);
      }
    });
  }

  /** Forward engine events; auto-advance the queue when a track ends. */
  #wireAudio(): void {
    this.#audio.on('play', () => this.#events.emit('play'));
    this.#audio.on('pause', () => this.#events.emit('pause'));
    this.#audio.on('loading', () => this.#events.emit('loading'));
    this.#audio.on('ready', () => this.#events.emit('ready'));
    this.#audio.on('error', (error) => {
      this.#events.emit('error', error);
      // 漫游中遇到无法播放的歌曲（VIP/下架/无版权）自动丢进下一首
      if (this.#queue.isFm) void this.#fmSkipTrack();
    });
    this.#audio.on('timeupdate', (currentTime) =>
      this.#events.emit('timeupdate', currentTime),
    );
    this.#audio.on('timetick', (currentTime) =>
      this.#events.emit('timetick', currentTime),
    );
    this.#audio.on('durationchange', (duration) =>
      this.#events.emit('durationchange', duration),
    );
    this.#audio.on('ended', () => {
      this.#events.emit('ended');
      void this.#onEnded();
    });
  }

  #applyPlayerSettings(settings: PlayerSettings): void {
    this.setVolume(settings.volume);
    this.setMuted(settings.isMuted);
    this.setMode(settings.playMode);
  }

  on<K extends keyof PlayerEvents>(
    event: K,
    listener: (...args: PlayerEvents[K]) => void,
  ): () => void {
    return this.#events.on(event, listener);
  }

  // ── Engine state (single source of truth) ──

  get currentTime(): number {
    return this.#audio.currentTime;
  }

  get duration(): number {
    return this.#audio.duration;
  }

  get playing(): boolean {
    return this.#audio.playing;
  }

  // ── Queue state ──

  get queue(): readonly Track[] {
    return this.#queue.tracks;
  }

  get currentTrack(): Track | null {
    return this.#queue.currentTrack;
  }

  get queueLength(): number {
    return this.#queue.length;
  }

  get currentIndex(): number {
    return this.#queue.currentIndex;
  }

  get isFm(): boolean {
    return this.#queue.isFm;
  }

  get fmExitWillEmpty(): boolean {
    return this.#queue.fmExitWillEmpty;
  }

  get canPrev(): boolean {
    return this.#queue.canPrev;
  }

  // ── Playback actions ──

  pause(): void {
    this.#audio.pause();
  }

  stop(): void {
    this.#audio.stop();
  }

  seek(time: number): void {
    this.#audio.seek(time);
  }

  setVolume(volume: number): void {
    this.#audio.volume = volume;
  }

  setMuted(muted: boolean): void {
    this.#audio.muted = muted;
  }

  /** Resume playback, re-resolving the URL if it is stale (>15 min). */
  async resume(): Promise<void> {
    const token = ++this.#playToken;
    if (Date.now() - this.#urlFetchedAt > 15 * 60 * 1000) {
      const track = this.#queue.currentTrack;
      if (!track) return;
      // Capture the position BEFORE reload — load() resets currentTime to 0.
      const resumeFrom = this.#audio.currentTime;
      try {
        const url = await this.#resolveUrl(track.id);
        if (token !== this.#playToken) return;
        this.#urlFetchedAt = Date.now();
        await this.#audio.load(url);
        if (token !== this.#playToken) return;
        this.#audio.seek(resumeFrom);
        await this.#audio.play();
      } catch (err) {
        if (token !== this.#playToken) return;
        throw err;
      }
    } else {
      await this.#audio.play();
    }
  }

  /** Resolve URL for the current queue track, load audio, and play. */
  async playCurrent(): Promise<void> {
    const token = ++this.#playToken;
    const track = this.#queue.currentTrack;
    if (!track) return;
    try {
      const url = await this.#resolveUrl(track.id);
      if (token !== this.#playToken) return; // 已被更新的切歌请求顶掉
      this.#urlFetchedAt = Date.now();
      await this.#audio.load(url);
      if (token !== this.#playToken) return;
      await this.#audio.play();
    } catch (err) {
      if (token !== this.#playToken) return; // 过期请求的失败与当前状态无关
      throw err;
    }
  }

  // ── Queue use cases ──

  async play(track: Track): Promise<void> {
    this.#queue.play(track);
    this.#events.emit('queuechange');
    await this.playCurrent();
  }

  async replaceAndPlay(tracks: Track[], startIndex = 0): Promise<void> {
    this.#queue.replace(tracks, startIndex);
    this.#events.emit('queuechange');
    await this.playCurrent();
  }

  async next(): Promise<void> {
    if (this.#queue.isFm && this.#queue.isAtEnd) {
      const refilled = await this.#refillFm();
      if (!refilled) return; // 没补到新歌，留在原地（不要重载当前歌）
    }
    this.#queue.advance();
    this.#events.emit('queuechange');
    await this.#playCurrentOrSkip();
  }

  async prev(): Promise<void> {
    if (!this.#queue.canPrev) return;
    this.#queue.retreat();
    this.#events.emit('queuechange');
    await this.#playCurrentOrSkip();
  }

  async addToQueue(track: Track): Promise<void> {
    const wasEmpty = this.#queue.length === 0;
    this.#queue.append(track);
    this.#events.emit('queuechange');
    if (wasEmpty) await this.playCurrent();
  }

  async playNext(track: Track): Promise<void> {
    const wasEmpty = this.#queue.length === 0;
    this.#queue.insertNext(track);
    this.#events.emit('queuechange');
    if (wasEmpty) await this.playCurrent();
  }

  async playFromIndex(index: number): Promise<void> {
    if (!this.#queue.select(index)) return;
    this.#events.emit('queuechange');
    await this.playCurrent();
  }

  async removeFromQueue(index: number): Promise<void> {
    const wasCurrent = this.#queue.removeAt(index);
    this.#events.emit('queuechange');
    if (wasCurrent) {
      if (this.#queue.length === 0) {
        this.stop();
      } else {
        await this.playCurrent();
      }
    }
  }

  // ── FM (私人漫游) ──

  /** 进入私人漫游。传入已预请求的歌曲则直接使用，否则现场拉取。返回是否成功开始播放（无歌曲返回 false）。 */
  async enterFm(initialTracks?: Track[]): Promise<boolean> {
    const songs =
      initialTracks && initialTracks.length > 0
        ? initialTracks
        : await this.#fetchFmBatch();
    this.#fmSkips = 0;
    // 快照进入漫游前的播放进度与播放状态；已在漫游中再次进入不覆盖
    if (!this.#queue.isFm) {
      this.#fmSnapshotAudio =
        this.#queue.length > 0
          ? {
              currentTime: this.#audio.currentTime,
              playing: this.#audio.playing,
            }
          : null;
    }
    this.#queue.enterFm(songs);
    this.#events.emit('queuechange');
    if (songs.length === 0) return false;
    await this.#playCurrentOrSkip();
    return true;
  }

  /**
   * 退出私人漫游：恢复进入漫游前的队列，并续播原歌（进度与播放/暂停状态一并恢复）；
   * 无快照（进入漫游前队列为空）时维持原行为——清空并停止。
   */
  async exitFm(): Promise<void> {
    const snapshot = this.#queue.exitFm();
    this.#events.emit('queuechange');
    const track = this.#queue.currentTrack;
    if (!snapshot || !track) {
      this.#fmSnapshotAudio = null;
      this.stop();
      return;
    }
    const audio = this.#fmSnapshotAudio;
    this.#fmSnapshotAudio = null;
    const token = ++this.#playToken;
    try {
      const url = await this.#resolveUrl(track.id);
      if (token !== this.#playToken) return; // 已被更新的切歌请求顶掉
      this.#urlFetchedAt = Date.now();
      await this.#audio.load(url);
      if (token !== this.#playToken) return;
      if (audio && audio.currentTime > 0) this.#audio.seek(audio.currentTime);
      // 进入漫游前正在播放才自动续播，暂停状态保持暂停
      if (audio?.playing) await this.#audio.play();
    } catch {
      if (token !== this.#playToken) return; // 过期请求的失败与当前状态无关
      this.stop(); // 恢复的歌曲无法播放时静默停止（与列表模式一致）
    }
  }

  /** 减少推荐：把当前漫游歌曲丢进垃圾桶并从队列移除，继续播下一首。 */
  async fmTrash(): Promise<void> {
    const track = this.#queue.currentTrack;
    if (!track || !this.#queue.isFm) return;
    await ncm.fmTrash(track.id); // 失败会抛错，由调用方 toast
    const wasLast = this.#queue.currentIndex === this.#queue.length - 1;
    // 丢的正是队尾最后一首：先补新批次再移除，让下一首落在新批次第一首（不回退到上一首）；
    // 没补到新歌时队列里只剩已听过的歌，停止而不是回头播放。
    const refilled = wasLast && (await this.#refillFm());
    this.#queue.removeAt(this.#queue.currentIndex);
    this.#events.emit('queuechange');
    if (wasLast && !refilled) {
      this.stop();
      return;
    }
    if (this.#queue.currentTrack) await this.#playCurrentOrSkip();
  }

  clearQueue(): void {
    this.#queue.clear();
    this.#events.emit('queuechange');
    this.stop();
  }

  setMode(mode: PlayMode): void {
    this.#queue.setMode(mode);
    this.#events.emit('queuechange');
  }

  /** Restore a persisted queue at startup. */
  restoreQueue(tracks: Track[], index: number): void {
    this.#queue.replace(tracks, index);
    this.#events.emit('queuechange');
  }

  async #resolveUrl(id: number): Promise<string> {
    const result = await ncm.songUrl(id);
    const url = result.data?.[0]?.url || '';
    if (!url) {
      throw new Error('无法解析播放地址');
    }
    return url;
  }

  async #fetchFmBatch(): Promise<Track[]> {
    const res = await ncm.personalFm();
    return (res.data ?? []).map(toFmSong);
  }

  /** 漫游模式下若已到队尾则拉取一批新歌追加；返回是否成功补充了歌曲 */
  async #refillFm(): Promise<boolean> {
    if (!this.#queue.isFm || !this.#queue.isAtEnd) return false;
    try {
      const songs = await this.#fetchFmBatch();
      return this.#queue.appendMany(songs) > 0;
    } catch {
      return false;
    }
  }

  /** 播放当前歌；FM 下失败自动丢弃坏歌跳到下一首，列表模式失败则停止。 */
  async #playCurrentOrSkip(): Promise<void> {
    try {
      await this.playCurrent();
    } catch {
      if (this.#queue.isFm) {
        await this.#fmSkipTrack();
      } else {
        this.stop();
      }
    }
  }

  /** FM 坏歌跳过入口：互斥锁防止 error 事件与切歌链路过早并发触发双重跳过。 */
  async #fmSkipTrack(): Promise<void> {
    if (this.#fmSkipInFlight) return;
    this.#fmSkipInFlight = true;
    try {
      await this.#fmSkipLoop();
    } finally {
      this.#fmSkipInFlight = false;
    }
  }

  /** 依次丢弃当前歌直到有一首能正常播放；连续超过上限说明推荐不可用，停止漫游。 */
  async #fmSkipLoop(): Promise<void> {
    while (this.#queue.isFm) {
      if (++this.#fmSkips > PlayerService.#FM_MAX_SKIPS) {
        this.stop();
        return;
      }
      // 队尾的坏歌：先补新批次再移除，试播新歌而不是回退到已听过的上一首
      // oxlint-disable-next-line no-await-in-loop 同下处，串行处理不能并发
      if (this.#queue.isAtEnd) await this.#refillFm();
      this.#queue.removeAt(this.#queue.currentIndex);
      this.#events.emit('queuechange');
      const next = this.#queue.currentTrack;
      if (!next) {
        this.stop();
        return;
      }
      try {
        // oxlint-disable-next-line no-await-in-loop 同上一处，串行试播
        await this.playCurrent();
        this.#fmSkips = 0;
        return;
      } catch {
        // 这首歌也无法播放，继续跳过
      }
    }
  }

  /** Auto-advance when the current track ends; refill FM before wrapping. */
  async #onEnded(): Promise<void> {
    if (this.#queue.isFm && this.#queue.isAtEnd) {
      await this.#refillFm();
      if (this.#queue.isAtEnd) {
        this.stop();
        return;
      }
    }
    this.#queue.advanceOnEnd();
    this.#events.emit('queuechange');
    await this.#playCurrentOrSkip();
  }
}

export const playerService = new PlayerService();
