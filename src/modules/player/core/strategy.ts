import type { Order } from "./types";

/** mulberry32 —— 轻量 32-bit 可种子化 PRNG（仅测试确定性用）。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/**
 * PlayStrategy —— 共享导航策略（纯逻辑，只算索引，对 Track 无感知）。
 * > 只负责「遍历顺序 Order」；终止策略（Repeat）由各 policy 持有并组合 —— 两轴解耦。
 * >
 */
export class PlayStrategy {
  private order: Order;
  private readonly rng: () => number;
  private shuffled: number[] = [];

  constructor(
    order: Order = "sequential",
    seed = Math.floor(Math.random() * 0xffffffff),
  ) {
    this.order = order;
    this.rng = mulberry32(seed);
  }

  setOrder(order: Order): void {
    if (order === this.order) return;
    this.order = order;
    this.shuffled = [];
  }

  orderValue(): Order {
    return this.order;
  }

  /** 下一个索引；wrap=false 时队尾返回 null（供「自然结束 / 流式耗尽」用）。 */
  nextIndex(current: number | null, len: number, wrap: boolean): number | null {
    if (len === 0) return null;
    if (this.order === "sequential") {
      if (current == null) return 0;
      const n = current + 1;
      if (n < len) return n;
      return wrap ? 0 : null;
    }
    if (this.shuffled.length !== len) this.rebuild(current, len);
    const pos = this.posOf(current);
    const n = pos + 1;
    if (n < len) return this.shuffled[n];
    return wrap ? this.shuffled[0] : null;
  }

  /** 上一个索引（环绕）。 */
  prevIndex(current: number | null, len: number): number | null {
    if (len === 0) return null;
    if (this.order === "sequential") {
      if (current == null) return null;
      return current === 0 ? len - 1 : current - 1;
    }
    if (this.shuffled.length !== len) this.rebuild(current, len);
    const pos = this.posOf(current);
    const p = pos === 0 ? len - 1 : pos - 1;
    return this.shuffled[p];
  }

  private posOf(current: number | null): number {
    if (current == null) return 0;
    const pos = this.shuffled.indexOf(current);
    return pos >= 0 ? pos : 0;
  }

  /** Fisher-Yates 重建排列，并把 current 旋转到首位（下一首从其后开始）。 */
  private rebuild(current: number | null, len: number): void {
    const arr = Array.from({ length: len }, (_, i) => i);
    for (let i = len - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (current != null) {
      const idx = arr.indexOf(current);
      if (idx >= 0) arr.push(...arr.splice(0, idx));
    }
    this.shuffled = arr;
  }
}
