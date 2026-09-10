// QueuePolicy —— 队列流（IPlaybackPolicy 实现）。
//
// 组合 TrackQueue（队列原语）+ PlayStrategy（遍历顺序 Order），自己持有 Repeat（终止策略）。
// 语义：手动 next / previous 始终环绕；handleAutoNext 按 Repeat（off 队尾耗尽 / all 环绕 / one 重播）。
// 队列流的「播放整张歌单 / 指定曲目 / 插队」等富操作以具体方法暴露，接口未收。

import type { Track } from '@/shared/lib/player-core/models/track';
import type { IPlaybackPolicy, Order, Repeat } from '../types';
import { PlayStrategy } from '../strategy';
import { TrackQueue } from '../TrackQueue';

/**
 * 经典的队列策略
 */
export class QueuePolicy implements IPlaybackPolicy {
  private readonly queue = new TrackQueue();
  private strategy: PlayStrategy;
  private repeat: Repeat;
  /** 队列是否耗尽 */
  private exhausted = false;

  constructor(
    order: Order = 'sequential',
    repeat: Repeat = 'off',
    seed?: number,
  ) {
    this.strategy = new PlayStrategy(order, seed);
    this.repeat = repeat;
  }

  // ── IPlaybackPolicy ──

  getCurrent(): Track | null {
    return this.queue.current();
  }

  next(): Track | null {
    return this.advance(
      this.strategy.nextIndex(this.queue.currentIdx(), this.queue.length, true),
    );
  }

  previous(): Track | null {
    return this.advance(
      this.strategy.prevIndex(this.queue.currentIdx(), this.queue.length),
    );
  }

  append(tracks: Track[]): void {
    this.queue.append(tracks);
  }

  remove(id: string): void {
    this.queue.removeById(id);
  }

  clear(): void {
    this.exhausted = false;
    this.queue.clear();
  }

  handleAutoNext(): Track | null {
    const cur = this.queue.currentIdx();
    if (this.repeat === 'one') {
      return cur == null ? null : this.queue.current();
    }
    const idx = this.strategy.nextIndex(
      cur,
      this.queue.length,
      this.repeat === 'all',
    );
    if (idx == null) {
      this.exhausted = true;
      return null;
    }
    return this.advance(idx);
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

  // ── 具体方法（app 适配层用） ──

  /** 当前曲（= getCurrent 别名）；供只读查询统一使用。 */
  current(): Track | null {
    return this.queue.current();
  }

  /** 当前索引；空队列 null。 */
  currentIndex(): number | null {
    return this.queue.currentIdx();
  }

  /** 从队列开头重新播放（顺序播放耗尽后点播放的语义）。空队列 null。 */
  restart(): Track | null {
    this.exhausted = false;
    if (this.queue.length === 0) {
      this.queue.goTo(null);
      return null;
    }
    return this.advance(0);
  }

  setRepeat(repeat: Repeat): void {
    this.repeat = repeat;
  }

  setOrder(order: Order): void {
    this.strategy.setOrder(order);
  }

  order(): Order {
    return this.strategy.orderValue();
  }

  repeatValue(): Repeat {
    return this.repeat;
  }

  /** 播放指定曲目：已在队列 → 跳转；否则替换为单曲上下文。 */
  playTrack(track: Track): Track | null {
    const idx = this.queue.indexOfId(track.id);
    if (idx >= 0) return this.advance(idx); // advance 顺带清 exhausted
    this.exhausted = false;
    this.queue.replace([track], 0);
    return this.queue.current();
  }

  /** 整批替换并从 startIndex 起播。 */
  replacePlay(tracks: Track[], startIndex = 0): Track | null {
    this.exhausted = false;
    this.queue.replace(tracks, startIndex);
    return this.queue.current();
  }

  /** 从指定索引播放；越界（含负数）返回 null。 */
  playQueueAt(index: number): Track | null {
    if (index < 0 || index >= this.queue.length) return null;
    return this.advance(index);
  }

  insertNext(track: Track): void {
    this.queue.insertNext(track);
  }

  removeAt(index: number): void {
    this.queue.removeAt(index);
  }

  /** 确认 index 有效的情况下，进行跳转 */
  private advance(idx: number | null): Track | null {
    if (idx == null) return null;
    this.exhausted = false;
    this.queue.goTo(idx);
    return this.queue.current();
  }
}
