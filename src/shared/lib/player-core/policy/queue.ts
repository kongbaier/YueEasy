// QueuePolicy —— 队列流（IPlaybackPolicy 实现）。
//
// 组合 TrackQueue（队列原语）+ PlayStrategy（遍历顺序 Order），自己持有 Repeat（终止策略）。
// 语义：手动 next / previous 始终环绕；handleAutoNext 按 Repeat（off 队尾耗尽 / all 环绕 / one 重播）。
// 队列流的「播放整张歌单 / 指定曲目 / 插队」等富操作以具体方法暴露，接口未收。

import type { Track } from "../models/track";
import type { IPlaybackPolicy, Order, Repeat } from "../types";
import { PlayStrategy } from "../strategy";
import { TrackQueue } from "../TrackQueue";

export class QueuePolicy implements IPlaybackPolicy {
  private readonly queue = new TrackQueue();
  private strategy: PlayStrategy;
  private repeat: Repeat;
  private exhausted = false;

  constructor(
    order: Order = "sequential",
    repeat: Repeat = "off",
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
    if (this.repeat === "one") {
      return cur == null ? null : this.queue.current();
    }
    const idx = this.strategy.nextIndex(
      cur,
      this.queue.length,
      this.repeat === "all",
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
    this.exhausted = false;
    const idx = this.queue.indexOfId(track.id);
    if (idx >= 0) {
      this.queue.goTo(idx);
      return this.queue.current();
    }
    this.queue.replace([track], 0);
    return this.queue.current();
  }

  /** 整批替换并从 startIndex 起播。 */
  replacePlay(tracks: Track[], startIndex = 0): Track | null {
    this.exhausted = false;
    this.queue.replace(tracks, startIndex);
    return this.queue.current();
  }

  /** 从指定索引播放；越界返回 null。 */
  playQueueAt(index: number): Track | null {
    if (index >= this.queue.length) return null;
    this.exhausted = false;
    this.queue.goTo(index);
    return this.queue.current();
  }

  insertNext(track: Track): void {
    this.queue.insertNext(track);
  }

  removeAt(index: number): void {
    this.queue.removeAt(index);
  }

  private advance(idx: number | null): Track | null {
    if (idx == null) return null;
    this.exhausted = false;
    this.queue.goTo(idx);
    return this.queue.current();
  }
}
