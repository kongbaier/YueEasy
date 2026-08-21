// 播放导航策略（前端移植：port of `src-tauri/src/player/policy.rs`）。
// 纯逻辑、零 I/O。正交组合「遍历顺序（Order）× 终止策略（Repeat）」。
// 关键语义：
// - 手动切歌（manualNext/manualPrev）始终环绕，与 Repeat 无关；
//   Repeat 只影响自然结束（onTrackEnd）：off 队尾停止、all 环绕、one 重播当前。
// - 内容来源（ContentSource）不在此层 —— 策略只算「队内下一个 index」，不做续歌决策。

import type { Order, Repeat, Step } from './types';

/** 种子推进常数（每次进入 Shuffle 推进，保证「重新随机」产生新排列）。u64 与 Rust 一致。 */
const SEED_ADVANCE = 0x9e37_79b9_7f4a_7c15n;

/** 内部小型 PRNG（xorshift64）—— 用 BigInt 精确复刻 Rust u64 算术，保证排列与 Rust 一一对应。 */
class XorShift64 {
  private state: bigint;

  constructor(seed: bigint) {
    // 状态为 0 时 xorshift 退化为全零输出，规避之
    this.state = seed === 0n ? SEED_ADVANCE : seed;
  }

  /** [0, bound) 内的伪随机索引 */
  next(bound: number): number {
    let x = this.state;
    x ^= (x << 13n) & MASK64;
    x ^= x >> 7n;
    x ^= (x << 17n) & MASK64;
    this.state = x & MASK64;
    return Number(x % BigInt(bound));
  }
}

const MASK64 = 0xffff_ffff_ffff_ffffn;

export class PlayStrategy {
  private order: Order;
  private repeat: Repeat;
  /** Shuffle 排列（仅 order == shuffle 时使用；惰性重建，同一 seed 下排列稳定）。 */
  private shuffled: number[] = [];
  private seed: bigint;

  constructor(order: Order, repeat: Repeat, seed: number | bigint) {
    this.order = order;
    this.repeat = repeat;
    this.seed = BigInt(seed) & MASK64;
  }

  orderValue(): Order {
    return this.order;
  }

  repeatValue(): Repeat {
    return this.repeat;
  }

  setRepeat(repeat: Repeat): void {
    this.repeat = repeat;
  }

  /** 设置遍历顺序。进入 Shuffle 时推进种子并清空排列 → 下次导航生成全新排列。 */
  setOrder(order: Order): void {
    if (order === 'shuffle') {
      this.seed = (this.seed + SEED_ADVANCE) & MASK64;
      this.shuffled = [];
    }
    this.order = order;
  }

  /** 手动按「下一首」：始终环绕。 */
  manualNext(current: number | null, len: number): Step {
    return this.nextIndex(current, len, true);
  }

  /** 流式来源（FM）的「下一首」：跟随 Repeat（off 队尾返回 End 触发续歌、其余环绕）。 */
  manualNextStreaming(current: number | null, len: number): Step {
    const wrap = this.repeat !== 'off';
    return this.nextIndex(current, len, wrap);
  }

  /** 曲目自然播完：one 重播当前；all 环绕；off 队尾停止。 */
  onTrackEnd(current: number | null, len: number): Step {
    if (this.repeat === 'one') {
      return current == null ? { type: 'end' } : { type: 'replayCurrent' };
    }
    return this.nextIndex(current, len, this.repeat === 'all');
  }

  /** 手动按「上一首」：环绕（Sequential 与 Shuffle 均环绕）。 */
  manualPrev(current: number | null, len: number): number | null {
    if (len === 0) return null;
    if (this.order === 'sequential') {
      return current == null ? null : current === 0 ? len - 1 : current - 1;
    }
    // shuffle
    if (this.shuffled.length !== len) this.rebuild(current, len);
    const cur = this.currentPos(current);
    const prevPos = cur === 0 ? len - 1 : cur - 1;
    return this.shuffled[prevPos];
  }

  /** 计算下一个队列索引（wrap 控制队尾是否环绕）。 */
  private nextIndex(current: number | null, len: number, wrap: boolean): Step {
    if (len === 0) return { type: 'end' };
    let idx: number | null = null;
    if (this.order === 'sequential') {
      if (current != null && current + 1 < len) {
        idx = current + 1;
      } else if (current != null && wrap) {
        idx = 0;
      }
    } else {
      // shuffle
      if (this.shuffled.length !== len) this.rebuild(current, len);
      const cur = this.currentPos(current);
      const nextPos = cur + 1;
      if (nextPos < len) {
        idx = this.shuffled[nextPos];
      } else if (wrap) {
        idx = this.shuffled[0];
      }
    }
    return idx == null ? { type: 'end' } : { type: 'play', index: idx };
  }

  /** 当前队列索引在排列中的位置（未命中则回退 0）。 */
  private currentPos(current: number | null): number {
    if (current == null) return 0;
    const pos = this.shuffled.indexOf(current);
    return pos >= 0 ? pos : 0;
  }

  /** Fisher-Yates 重建排列，并把 current 旋转到首位（线性遍历起点）。惰性：len 不符才重建。 */
  private rebuild(current: number | null, len: number): void {
    if (len === 0) {
      this.shuffled = [];
      return;
    }
    const order = Array.from({ length: len }, (_, i) => i);
    const rng = new XorShift64(this.seed);
    for (let i = len - 1; i >= 1; i--) {
      const j = rng.next(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (current != null) {
      const idx = order.indexOf(current);
      if (idx >= 0) {
        order.push(...order.splice(0, idx));
      }
    }
    this.shuffled = order;
  }
}
