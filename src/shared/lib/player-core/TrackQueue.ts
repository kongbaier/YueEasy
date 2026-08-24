// TrackQueue —— 源无关的曲目队列原语（纯逻辑，对 Track 仅依赖 id）。
// 两个 policy 组合使用；增删改后的 current index 一致性在此统一维护。

import type { Track } from "./models/track";

export class TrackQueue {
  private tracks: Track[] = [];
  private index: number | null = null;

  get length(): number {
    return this.tracks.length;
  }

  get isEmpty(): boolean {
    return this.tracks.length === 0;
  }

  items(): readonly Track[] {
    return this.tracks;
  }

  current(): Track | null {
    return this.index == null ? null : (this.tracks[this.index] ?? null);
  }

  currentIdx(): number | null {
    return this.index;
  }

  /** 直接设定当前位置（导航层调用；调用方负责索引合法性）。 */
  goTo(i: number | null): void {
    this.index = i;
  }

  indexOfId(id: string): number {
    return this.tracks.findIndex((t) => t.id === id);
  }

  /** 追加（按 id 去重）；空队列首插自动定位 0。 */
  append(tracks: Track[]): void {
    for (const t of tracks) {
      if (this.tracks.some((x) => x.id === t.id)) continue;
      this.tracks.push(t);
    }
    if (this.index == null && this.tracks.length > 0) this.index = 0;
  }

  /** 在 current 之后插入（按 id 去重）。 */
  insertNext(track: Track): void {
    if (this.tracks.some((x) => x.id === track.id)) return;
    const at = this.index == null ? 0 : this.index + 1;
    this.tracks.splice(at, 0, track);
    if (this.index == null) this.index = 0;
  }

  removeById(id: string): Track | null {
    const i = this.indexOfId(id);
    return i < 0 ? null : this.removeAt(i);
  }

  removeAt(i: number): Track | null {
    if (i < 0 || i >= this.tracks.length) return null;
    const oldCi = this.index;
    const [removed] = this.tracks.splice(i, 1);
    if (oldCi == null) {
      this.index = null;
    } else if (this.tracks.length === 0) {
      this.index = null;
    } else if (i < oldCi) {
      this.index = oldCi - 1;
    } else if (i === oldCi) {
      this.index = Math.min(oldCi, this.tracks.length - 1);
    } else {
      this.index = oldCi;
    }
    return removed;
  }

  clear(): void {
    this.tracks = [];
    this.index = null;
  }

  /** 整批替换并从 start 起。 */
  replace(tracks: Track[], start = 0): void {
    if (tracks.length === 0) {
      this.clear();
      return;
    }
    this.tracks = [...tracks];
    this.index = Math.min(start, tracks.length - 1);
  }
}
