// QueueEngine —— 播放器领域引擎（前端移植：port of `src-tauri/src/player/queue.rs`）。
//
// 纯逻辑：零 I/O、零网络。导航决策下沉到 `PlayStrategy`（遍历顺序 Order × 终止策略 Repeat），
// 「队尾如何续歌」由 `source`（ContentSource）决定，两者正交 —— 引擎持有「导航策略」与「内容来源」两个独立维度。
// 导航区分「手动切歌」（manualNext/manualPrev）与「自然结束」（onTrackEnd）两个独立入口：
// 手动切歌始终环绕，Repeat 只影响自然结束（off 停止 / all 环绕 / one 重播）。

import type { QueueItem } from '@/shared/types/entities';
import { PlayStrategy } from './PlayStrategy';
import type {
  ContentSource,
  Order,
  PlayerSnapshot,
  Repeat,
  Step,
} from './types';

/** 随机种子：以时间 + 随机为熵源（前端引擎，仅影响 shuffle 顺序）。 */
function randomSeed(): bigint {
  return (
    (BigInt(Date.now()) ^
      (BigInt(Math.floor(Math.random() * 0xffffffff)) << 32n)) &
    0xffff_ffff_ffff_ffffn
  );
}

/** FM 进入前保存的原队列上下文（enter/exit 的私有实现细节）。 */
interface SavedContext {
  queue: QueueItem[];
  index: number | null;
  order: Order;
  repeat: Repeat;
}

export class QueueEngine {
  private queue: QueueItem[] = [];
  private currentIndex: number | null = null;
  /** 内容来源（queue/personal_fm）——决定队尾如何续歌。 */
  private source: ContentSource = 'queue';
  /** 导航策略（遍历顺序 × 终止策略 + Shuffle 排列状态）。始终有效，不与来源互斥。 */
  private strategy: PlayStrategy;
  /** FM 进入前保存的原队列上下文（非 FM 时为 null）。 */
  private fmSaved: SavedContext | null = null;
  /** FM 已播 id 列表（Queue 源时为空）。 */
  private fmPlayedIds: number[] = [];
  /** 队列是否已自然耗尽（顺序播放 off 到队尾后为 true；手动操作/重启后复位）。 */
  private ended = false;

  constructor(seed: number | bigint = randomSeed()) {
    this.strategy = new PlayStrategy('sequential', 'off', seed);
  }

  /** 从快照恢复（WebView 重载 / 进程重启恢复）。 */
  static fromSnapshot(snapshot: PlayerSnapshot): QueueEngine {
    const engine = new QueueEngine();
    engine.queue = snapshot.queue;
    // 越界容错：current_index 钳制到合法范围
    engine.currentIndex =
      engine.queue.length === 0
        ? null
        : snapshot.current_index != null &&
            snapshot.current_index < engine.queue.length
          ? snapshot.current_index
          : null;
    engine.fmPlayedIds = snapshot.fm_played_ids;
    engine.source = snapshot.content_source;
    // 导航策略始终跟随 order/repeat（Shuffle 排列惰性重建，不持久化）
    engine.strategy = new PlayStrategy(
      snapshot.order,
      snapshot.repeat,
      randomSeed(),
    );
    return engine;
  }

  // ── 播放控制 ──

  /** 播放指定曲目。已在队列中 → 跳转；否则替换为单曲上下文。退出 FM 并丢弃快照。 */
  playTrack(track: QueueItem): QueueItem {
    this.ended = false;
    this.discardFm();
    const pos = this.queue.findIndex((t) => t.track_id === track.track_id);
    if (pos >= 0) {
      this.currentIndex = pos;
      return this.queue[pos];
    }
    this.queueReplace([track], 0);
    return this.currentTrack()!;
  }

  /** 替换整个队列并从指定位置播放。退出 FM 并丢弃快照。空队列返回 null。 */
  replacePlay(
    tracks: QueueItem[],
    startIndex?: number | null,
  ): QueueItem | null {
    this.ended = false;
    if (this.source === 'personal_fm') this.discardFm();
    this.queueReplace(tracks, startIndex ?? 0);
    return this.currentTrack();
  }

  /** 从队列指定位置播放。越界返回 null。FM 激活时先退出 FM（恢复快照）再按恢复后的队列执行。 */
  playQueueAt(index: number): QueueItem | null {
    this.ended = false;
    if (this.isFmActive()) this.exitFm();
    if (index >= this.queue.length) return null;
    this.currentIndex = index;
    return this.currentTrack();
  }

  /** 手动切下一首。返回 Play / ReplayCurrent / End。End 后续行为由 source 决定。 */
  manualNext(): Step {
    this.ended = false;
    const current = this.currentIndex;
    const len = this.queue.length;
    const step = this.isFmActive()
      ? this.strategy.manualNextStreaming(current, len)
      : this.strategy.manualNext(current, len);
    if (step.type === 'play') this.currentIndex = step.index;
    return step;
  }

  /** 曲目自然播完。与「手动切下一首」是两个独立入口：LoopOne 下自然结束重播当前曲，手动切歌切走。 */
  onTrackEnd(): Step {
    const current = this.currentIndex;
    const len = this.queue.length;
    const step = this.strategy.onTrackEnd(current, len);
    if (step.type === 'play') this.currentIndex = step.index;
    if (step.type === 'end' && this.source === 'queue') this.ended = true;
    return step;
  }

  /** 手动切上一首。无上一首返回 null。 */
  prev(): QueueItem | null {
    this.ended = false;
    const current = this.currentIndex;
    const len = this.queue.length;
    const idx = this.strategy.manualPrev(current, len);
    if (idx == null) return null;
    this.currentIndex = idx;
    return this.currentTrack();
  }

  /** 从队列开头重新播放（顺序播放 ended 后点播放的语义）。空队列返回 null。 */
  restart(): QueueItem | null {
    this.ended = false;
    if (this.queue.length === 0) {
      this.currentIndex = null;
      return null;
    }
    this.currentIndex = 0;
    return this.currentTrack();
  }

  // ── 队列操作 ──

  /** 追加到队尾（按 track_id 去重，空队列自动播放）。FM 激活时先退出 FM 再追加，不回 FM。 */
  append(tracks: QueueItem[]): void {
    if (this.isFmActive()) this.exitFm();
    this.queueAdd(this.queue.length, tracks);
  }

  /** 插入当前曲目之后（按 track_id 去重，空队列自动播放）。FM 激活时先退出 FM。 */
  insertNext(track: QueueItem): void {
    if (this.isFmActive()) this.exitFm();
    const at = this.currentIndex == null ? 0 : this.currentIndex + 1;
    this.queueAdd(at, [track]);
  }

  /** 移除指定位置曲目。越界为 no-op。FM 激活时先退出 FM 再按恢复后的队列移除。 */
  removeAt(index: number): void {
    if (this.isFmActive()) this.exitFm();
    this.queueDelete(index);
  }

  /** 清空队列并重置索引。退出 FM 并丢弃快照。 */
  clear(): void {
    this.ended = false;
    this.discardFm();
    this.queueClear();
  }

  // ── 模式（order × repeat） ──

  setRepeat(repeat: Repeat): void {
    this.strategy.setRepeat(repeat);
  }

  setOrder(order: Order): void {
    this.strategy.setOrder(order);
  }

  // ── FM ──

  /** 进入 FM（单曲模型）。保存当前队列上下文，设置初始曲目，切换到 PersonalFm 来源。已在 FM 中再次进入不覆盖原快照。 */
  enterFm(initialTrack: QueueItem): void {
    this.ended = false;
    if (!this.isFmActive()) {
      this.fmSaved = {
        queue: this.queue,
        index: this.currentIndex,
        order: this.strategy.orderValue(),
        repeat: this.strategy.repeatValue(),
      };
      this.queue = [];
    }
    this.source = 'personal_fm';
    this.queueReplace([initialTrack], 0);
    this.fmPlayedIds = [];
  }

  /** 退出内容来源回到 Queue：PersonalFm 恢复进入前保存的原队列上下文；无快照则清空。Queue 为 no-op。 */
  exitFm(): QueueItem | null {
    if (this.source !== 'personal_fm') return this.currentTrack();
    this.fmPlayedIds = [];
    this.source = 'queue';
    const ctx = this.fmSaved;
    this.fmSaved = null;
    if (ctx) {
      this.queue = ctx.queue;
      this.currentIndex = ctx.index;
      this.strategy.setOrder(ctx.order);
      this.strategy.setRepeat(ctx.repeat);
      return this.currentTrack();
    }
    this.queueClear();
    return null;
  }

  /** FM 续歌（流式）：向 FM 队列尾部追加曲目（按 track_id 去重）。非 FM 调用为 no-op。 */
  appendFm(tracks: QueueItem[]): void {
    if (!this.isFmActive()) return;
    this.queueAdd(this.queue.length, tracks);
  }

  /** FM「不感兴趣」：移除当前 FM 曲目并返回被移除的曲。移除后下一首滑入；队列空 currentIndex 置 null。非 FM 返回 null。 */
  removeFmCurrent(): QueueItem | null {
    if (!this.isFmActive()) return null;
    const ci = this.currentIndex;
    if (ci == null) return null;
    return this.queueDelete(ci);
  }

  /** 记录当前 FM 曲目已播放（加入 played_ids）。 */
  fmRecordPlayed(): void {
    if (this.isFmActive()) {
      const t = this.currentTrack();
      if (t) this.fmPlayedIds.push(t.track_id);
    }
  }

  // ── 只读查询 ──

  currentTrack(): QueueItem | null {
    return this.currentIndex == null
      ? null
      : (this.queue[this.currentIndex] ?? null);
  }

  currentIdx(): number | null {
    return this.currentIndex;
  }

  queueItems(): QueueItem[] {
    return this.queue;
  }

  order(): Order {
    return this.strategy.orderValue();
  }

  repeat(): Repeat {
    return this.strategy.repeatValue();
  }

  isFmActive(): boolean {
    return this.source === 'personal_fm';
  }

  isEnded(): boolean {
    return this.ended;
  }

  sourceValue(): ContentSource {
    return this.source;
  }

  /** 全量快照（崩溃/重载恢复）。 */
  snapshot(): PlayerSnapshot {
    return {
      queue: [...this.queue],
      current_index: this.currentIndex,
      order: this.strategy.orderValue(),
      repeat: this.strategy.repeatValue(),
      content_source: this.source,
      fm_played_ids: [...this.fmPlayedIds],
    };
  }

  // ── 内部：队列基础原语（所有队列修改的唯一入口；index 一致性在此统一维护） ──

  /** 基础增：去重后插入到指定位置。插入后维护 index：空队列首次插入自动 0。返回是否插入了任何曲。 */
  private queueAdd(at: number, tracks: QueueItem[]): boolean {
    let idx = Math.min(at, this.queue.length);
    let added = false;
    for (const t of tracks) {
      if (this.queue.some((x) => x.track_id === t.track_id)) continue;
      this.queue.splice(idx, 0, t);
      idx += 1;
      added = true;
    }
    if (added && this.currentIndex == null && this.queue.length > 0) {
      this.currentIndex = 0;
    }
    return added;
  }

  /** 基础删：删除指定位置。删除后维护 index（空→null；删当前曲之前→前移；删当前曲→下一首滑入/钳制尾）。返回被删除的曲（越界 null）。 */
  private queueDelete(index: number): QueueItem | null {
    if (index >= this.queue.length) return null;
    const oldCi = this.currentIndex;
    const [removed] = this.queue.splice(index, 1);
    if (oldCi == null) {
      this.currentIndex = null;
    } else if (this.queue.length === 0) {
      this.currentIndex = null;
    } else if (index < oldCi) {
      this.currentIndex = oldCi - 1;
    } else if (index === oldCi) {
      this.currentIndex = Math.min(oldCi, this.queue.length - 1);
    } else {
      this.currentIndex = oldCi;
    }
    return removed;
  }

  /** 基础清空：清空队列 + index=null。 */
  private queueClear(): void {
    this.queue = [];
    this.currentIndex = null;
  }

  /** 基础替换：替换整个队列并从 start 位置起播。空队列 → 清空；start 越界钳制到尾。 */
  private queueReplace(tracks: QueueItem[], start: number): void {
    if (tracks.length === 0) {
      this.queueClear();
      return;
    }
    const idx = Math.min(start, tracks.length - 1);
    this.queue = tracks;
    this.currentIndex = idx;
  }

  /** 退出 FM 并丢弃快照（playTrack / clear / replacePlay 用）。 */
  private discardFm(): void {
    this.source = 'queue';
    this.fmSaved = null;
    this.fmPlayedIds = [];
  }
}
