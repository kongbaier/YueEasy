// player-core 单元测试（纯逻辑，node 环境无 DOM 依赖）。
// 覆盖 PlayStrategy（遍历）/ QueuePolicy（队列流）/ FmPolicy（推荐流）/ Player（编排桥接）。

import { describe, expect, it } from 'vitest';
import type { BaseEventMap, IAudioCore } from '@/shared/lib/player-core/types';
import type { Track } from '@/shared/lib/player-core/models/track';
import { PlayStrategy } from './strategy';
import { QueuePolicy } from './policy/queue';
import { FmPolicy } from './policy/fm';
import { Player } from './player';

function track(id: number): Track {
  return { id: String(id), src: `https://x/${id}` };
}

function tracks(n: number): Track[] {
  return Array.from({ length: n }, (_, i) => track(i));
}

function ids(ts: readonly Track[]): string[] {
  return ts.map((t) => t.id);
}

class FakeAudio implements IAudioCore {
  currentTime = 0;
  volume = 1;
  src = '';
  muted = false;
  rate = 1;
  duration = 0;
  playing = false;
  ended = false;
  loaded: string[] = [];
  private listeners = new Map<string, () => void>();

  load(url: string) {
    this.src = url;
    this.loaded.push(url);
  }

  async play() {
    this.playing = true;
  }

  pause() {
    this.playing = false;
  }

  seek(_time: number) {}

  reset() {
    this.src = '';
    this.playing = false;
    this.status = 'idle';
  }

  status = 'idle' as const;

  getStatus() {
    return this.status;
  }

  on<K extends keyof BaseEventMap>(
    event: K,
    callback: BaseEventMap[K],
  ): () => void {
    this.listeners.set(event, callback as () => void);
    return () => this.listeners.delete(event);
  }

  emit(event: keyof BaseEventMap) {
    this.listeners.get(event)?.();
  }
}

describe('PlayStrategy', () => {
  it('sequential next/prev 环绕与队尾不环绕', () => {
    const s = new PlayStrategy('sequential');
    expect(s.nextIndex(1, 4, true)).toBe(2);
    expect(s.nextIndex(3, 4, true)).toBe(0);
    expect(s.nextIndex(3, 4, false)).toBeNull();
    expect(s.prevIndex(0, 4)).toBe(3);
    expect(s.prevIndex(2, 4)).toBe(1);
  });

  it('shuffle 覆盖每个索引一次后环绕', () => {
    const s = new PlayStrategy('shuffle', 42);
    const seen = [0];
    let cur = 0;
    for (let i = 0; i < 3; i++) {
      cur = s.nextIndex(cur, 4, true)!;
      seen.push(cur);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(s.nextIndex(cur, 4, true)).toBe(0);
  });
});

describe('QueuePolicy', () => {
  it('next/previous 环绕', () => {
    const q = new QueuePolicy();
    q.append(tracks(4));
    expect(q.getCurrent()!.id).toBe('0');
    expect(q.next()!.id).toBe('1');
    expect(q.next()!.id).toBe('2');
    expect(q.previous()!.id).toBe('1');
  });

  it('handleAutoNext off 队尾耗尽', () => {
    const q = new QueuePolicy();
    q.append(tracks(3));
    q.playQueueAt(2);
    expect(q.handleAutoNext()).toBeNull();
    expect(q.isExhausted).toBe(true);
  });

  it('handleAutoNext all 环绕', () => {
    const q = new QueuePolicy('sequential', 'all');
    q.append(tracks(3));
    q.playQueueAt(2);
    expect(q.handleAutoNext()!.id).toBe('0');
    expect(q.isExhausted).toBe(false);
  });

  it('handleAutoNext one 重播当前', () => {
    const q = new QueuePolicy('sequential', 'one');
    q.append(tracks(3));
    q.playQueueAt(1);
    expect(q.handleAutoNext()!.id).toBe('1');
  });

  it('单曲循环只影响自然结束，手动 next 仍切下一首', () => {
    const q = new QueuePolicy('sequential', 'one');
    q.append(tracks(3));
    q.playQueueAt(1);
    // 手动下一首：不受 one 影响，正常进到下一首
    expect(q.next()!.id).toBe('2');
    // 自然结束：one 重播当前
    expect(q.handleAutoNext()!.id).toBe('2');
  });

  it('append 按 id 去重', () => {
    const q = new QueuePolicy();
    q.append(tracks(2));
    q.append([track(1), track(2)]);
    expect(ids(q.tracks)).toEqual(['0', '1', '2']);
  });

  it('remove by id 维护索引', () => {
    const q = new QueuePolicy();
    q.append(tracks(4));
    q.playQueueAt(3);
    q.remove('1');
    expect(ids(q.tracks)).toEqual(['0', '2', '3']);
    expect(q.getCurrent()!.id).toBe('3');
  });

  it('playTrack 已存在跳转、新曲替换', () => {
    const q = new QueuePolicy();
    q.append(tracks(3));
    expect(q.playTrack(track(2))!.id).toBe('2');
    expect(q.playTrack(track(99))!.id).toBe('99');
    expect(ids(q.tracks)).toEqual(['99']);
  });

  it('手动 next 解除耗尽', () => {
    const q = new QueuePolicy();
    q.append(tracks(2));
    q.playQueueAt(1);
    expect(q.handleAutoNext()).toBeNull();
    expect(q.isExhausted).toBe(true);
    expect(q.next()!.id).toBe('0');
    expect(q.isExhausted).toBe(false);
  });
});

describe('FmPolicy', () => {
  it('流式推进并队尾耗尽', () => {
    const fm = new FmPolicy();
    fm.seed(track(100));
    expect(fm.getCurrent()!.id).toBe('100');
    expect(fm.next()).toBeNull();
    expect(fm.isExhausted).toBe(true);
  });

  it('append 续歌并解除耗尽', () => {
    const fm = new FmPolicy();
    fm.seed(track(100));
    fm.append([track(101), track(102)]);
    expect(fm.isExhausted).toBe(false);
    expect(fm.next()!.id).toBe('101');
    expect(fm.next()!.id).toBe('102');
    expect(fm.next()).toBeNull();
    expect(fm.isExhausted).toBe(true);
  });

  it('repeat one 重播当前', () => {
    const fm = new FmPolicy();
    fm.setRepeat('one');
    fm.seed(track(100));
    fm.append([track(101)]);
    expect(fm.next()!.id).toBe('100');
    expect(fm.handleAutoNext()!.id).toBe('100');
  });

  it('removeCurrent 下一首滑入', () => {
    const fm = new FmPolicy();
    fm.seed(track(100));
    fm.append([track(101)]);
    expect(fm.removeCurrent()!.id).toBe('100');
    expect(fm.getCurrent()!.id).toBe('101');
  });
});

describe('Player', () => {
  /** 默认 resolver：直接返回 track.src（模拟 app 端有 URL）。 */
  const resolve: (t: Track) => Promise<string | null> = (t) =>
    Promise.resolve(t.src);

  it('next 解析并播放', async () => {
    const audio = new FakeAudio();
    const q = new QueuePolicy();
    q.append(tracks(2));
    const p = new Player(audio, q, resolve);
    expect((await p.next())!.id).toBe('1');
    expect(audio.loaded).toEqual(['https://x/1']);
    expect(audio.playing).toBe(true);
  });

  it('ended 由编排层接管（库 Player 不自动推进）', async () => {
    const audio = new FakeAudio();
    const q = new QueuePolicy();
    q.append(tracks(2));
    const p = new Player(audio, q, resolve);
    audio.emit('ended');
    await Promise.resolve();
    // 库 Player 不自动 handleAutoNext；编排层决定后续
    expect(p.currentTrack!.id).toBe('0');
    expect(audio.loaded).toEqual([]);
    // 编排层手动推进
    const next = await p.handleAutoNext();
    expect(next!.id).toBe('1');
    expect(audio.loaded).toEqual(['https://x/1']);
  });

  it('setPolicy 换源', () => {
    const audio = new FakeAudio();
    const q = new QueuePolicy();
    q.append(tracks(2));
    const p = new Player(audio, q, resolve);
    const fm = new FmPolicy();
    fm.seed(track(100));
    p.setPolicy(fm);
    expect(p.currentTrack!.id).toBe('100');
  });

  it('resolver 返回 null（坏歌/竞态）不播放', async () => {
    const audio = new FakeAudio();
    const q = new QueuePolicy();
    q.append(tracks(2));
    const p = new Player(audio, q, () => Promise.resolve(null));
    await p.next();
    expect(audio.loaded).toEqual([]);
    expect(p.currentTrack!.id).toBe('1'); // 策略已推进，只是不加载
  });
});
