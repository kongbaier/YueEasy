import { AudioCore, QueueManager } from '@/core';
import type { PlayMode, Track } from '@/core/types';
import { EventEmitter } from '@/shared/lib/EventEmitter';
import type { PlayerSettings } from '@/shared/types/settings';
import { useSettingsStore } from '@/stores/settings';
import { ncm } from '@/tauri/ncm';

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
    this.#audio.on('error', (error) => this.#events.emit('error', error));
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
      this.#queue.advanceOnEnd();
      this.#events.emit('queuechange');
      this.playCurrent().catch(() => this.stop());
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
    if (Date.now() - this.#urlFetchedAt > 15 * 60 * 1000) {
      const track = this.#queue.currentTrack;
      if (!track) return;
      // Capture the position BEFORE reload — load() resets currentTime to 0.
      const resumeFrom = this.#audio.currentTime;
      const url = await this.#resolveUrl(track.id);
      this.#urlFetchedAt = Date.now();
      await this.#audio.load(url);
      this.#audio.seek(resumeFrom);
      await this.#audio.play();
    } else {
      await this.#audio.play();
    }
  }

  /** Resolve URL for the current queue track, load audio, and play. */
  async playCurrent(): Promise<void> {
    const track = this.#queue.currentTrack;
    if (!track) return;
    const url = await this.#resolveUrl(track.id);
    this.#urlFetchedAt = Date.now();
    await this.#audio.load(url);
    await this.#audio.play();
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
    this.#queue.advance();
    this.#events.emit('queuechange');
    await this.playCurrent();
  }

  async prev(): Promise<void> {
    this.#queue.retreat();
    this.#events.emit('queuechange');
    await this.playCurrent();
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
}

export const playerService = new PlayerService();
