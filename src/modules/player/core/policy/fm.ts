// FmPolicy —— 推荐流（IPlaybackPolicy 实现）。
//
// 组合 TrackQueue（流式队列），固定 sequential（无 shuffle）；Repeat 仅 off / one。
// 语义：流式续歌 —— 手动 next 与自然结束都在已取曲内推进；耗尽（isExhausted）由外部
// 适配层 fetch 后 append 续歌。曲目身份经 currentId 暴露给服务端「不感兴趣」上报。

import type { Track } from '@/shared/lib/player-core/models/track';
import type { IPlaybackPolicy, Repeat } from '../types';
import { TrackQueue } from '../TrackQueue';

export class FmPolicy implements IPlaybackPolicy {
  private readonly queue = new TrackQueue();
  private repeat: Repeat = 'off';
  private exhausted = false;

  getCurrent(): Track | null {
    return this.queue.current();
  }

  next(): Track | null {
    if (this.repeat === 'one') return this.queue.current();
    const cur = this.queue.currentIdx();
    if (cur == null) {
      this.exhausted = true;
      return null;
    }
    const n = cur + 1;
    if (n >= this.queue.length) {
      this.exhausted = true;
      return null;
    }
    this.exhausted = false;
    this.queue.goTo(n);
    return this.queue.current();
  }

  previous(): Track | null {
    const cur = this.queue.currentIdx();
    this.exhausted = false;
    if (cur == null || cur === 0) return this.queue.current();
    this.queue.goTo(cur - 1);
    return this.queue.current();
  }

  append(tracks: Track[]): void {
    this.queue.append(tracks);
    this.exhausted = false;
  }

  remove(id: string): void {
    this.queue.removeById(id);
  }

  clear(): void {
    this.exhausted = false;
    this.queue.clear();
  }

  handleAutoNext(): Track | null {
    return this.next();
  }

  get isExhausted(): boolean {
    return this.exhausted;
  }

  get tracks(): readonly Track[] {
    return this.queue.items();
  }

  initialize(): void {
    this.exhausted = false;
  }

  dispose(): void {
    this.queue.clear();
  }

  // ── 具体方法 ──

  /** 当前曲（= getCurrent 别名）。 */
  current(): Track | null {
    return this.queue.current();
  }

  /** 当前索引；空队列 null。 */
  currentIndex(): number | null {
    return this.queue.currentIdx();
  }

  /** 进入推荐流：以初始曲目重置队列。 */
  seed(track: Track): void {
    this.exhausted = false;
    this.queue.replace([track], 0);
  }

  /** 从快照恢复（整批替换 + 定位）。 */
  seedFrom(tracks: Track[], index = 0): void {
    this.exhausted = false;
    this.queue.replace(tracks, index);
  }

  /** 从开头重新播放（耗尽后点播放）。空队列 null。 */
  restart(): Track | null {
    this.exhausted = false;
    if (this.queue.length === 0) {
      this.queue.goTo(null);
      return null;
    }
    this.queue.goTo(0);
    return this.queue.current();
  }

  setRepeat(repeat: Repeat): void {
    // FM 无「整队循环」，all 归一为 off
    this.repeat = repeat === 'all' ? 'off' : repeat;
  }

  repeatValue(): Repeat {
    return this.repeat;
  }

  /** 「不感兴趣」：移除当前曲，下一首滑入。 */
  removeCurrent(): Track | null {
    const i = this.queue.currentIdx();
    return i == null ? null : this.queue.removeAt(i);
  }

  /** 当前曲 id（供服务端去重 / 不感兴趣上报）。 */
  currentId(): string | null {
    return this.queue.current()?.id ?? null;
  }
}
