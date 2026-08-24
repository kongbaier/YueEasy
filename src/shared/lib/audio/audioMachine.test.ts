// audioMachine —— 状态机行为自检（关键路径：loading/buffering 分离 + seek guard）。
import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { audioMachine } from './audioMachine';

/** 可变 seeking 的 mock audio：guard 在事件时读 audio.seeking，测试中可翻转。 */
function mockAudio() {
  return { seeking: false } as HTMLAudioElement;
}

function playThrough(audio: HTMLAudioElement) {
  const actor = createActor(audioMachine, { input: { audio } });
  actor.start();
  actor.send({ type: 'LOAD_START' });
  actor.send({ type: 'LOADED_METADATA' });
  actor.send({ type: 'PLAYING' });
  return actor;
}

describe('audioMachine', () => {
  it('loading → ready → playing → buffering → playing（缓冲恢复）', () => {
    const actor = playThrough(mockAudio());
    actor.send({ type: 'WAITING' });
    expect(actor.getSnapshot().value).toBe('buffering');
    actor.send({ type: 'CAN_PLAY' });
    expect(actor.getSnapshot().value).toBe('playing');
  });

  it('seek 引起的 waiting 被 guard 忽略，不进 buffering（不闪）', () => {
    const audio = mockAudio();
    const actor = playThrough(audio);
    audio.seeking = true; // 拖进度条那一刻
    actor.send({ type: 'WAITING' });
    expect(actor.getSnapshot().value).toBe('playing');
    audio.seeking = false;
    actor.send({ type: 'WAITING' });
    expect(actor.getSnapshot().value).toBe('buffering'); // 真·网络卡顿才进
  });

  it('播放中切歌 playing → loading（next/prev 在播时 load 新曲）', () => {
    const actor = playThrough(mockAudio());
    actor.send({ type: 'LOAD_START' });
    expect(actor.getSnapshot().value).toBe('loading');
  });

  it('未匹配事件被忽略而非抛错（idle 收 PAUSE）', () => {
    const actor = createActor(audioMachine, { input: { audio: mockAudio() } });
    actor.start();
    expect(() => actor.send({ type: 'PAUSE' })).not.toThrow();
    expect(actor.getSnapshot().value).toBe('idle');
  });
});
