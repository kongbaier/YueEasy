// audioMachine —— 音频物理层状态机（XState，Actor 模式）。
//
// 状态 = 播放器 UI 消费的「单一投影轴」，不是浏览器三层正交状态（readyState /
// networkState / paused）的镜像——那三层已由 HTMLMediaElement 免费维护，这里只做投影。
// 事件 = HTMLMediaElement 原生事件；waiting 带 notSeeking guard：seek 触发的 waiting
// 是瞬态假象，忽略；网络卡顿的 waiting 才进 buffering。
//
// 注入：context.audio（HTMLAudioElement）由 AudioCore 构造时经 input 注入，
// guard 直读 audio.seeking —— 正交真值只认浏览器，不在本机里再建一份。

import { setup } from 'xstate';

export type AudioStatus =
  | 'idle' // 没歌
  | 'loading' // 加载元数据（歌曲未知）
  | 'ready' // 元数据就绪，未播放
  | 'playing' // 出声中
  | 'paused' // 暂停
  | 'buffering' // 播放中缓冲不足（歌曲已知，数据跟不上）
  | 'ended' // 自然播完
  | 'error'; // 错误

export type AudioMachineInput = { audio: HTMLAudioElement };

export type AudioMachineEvent =
  | { type: 'LOAD_START' } // loadstart（load() 乐观先行，DOM 异步再证）
  | { type: 'LOADED_METADATA' } // loadedmetadata
  | { type: 'PLAYING' } // playing：真正出声
  | { type: 'WAITING' } // waiting：缓冲不足（seek 假象经 guard 排除）
  | { type: 'CAN_PLAY' } // canplay：缓冲跟上
  | { type: 'PAUSE' } // pause
  | { type: 'ENDED' } // ended：自然播完
  | { type: 'ERROR' } // error
  | { type: 'RESET' }; // 程序性清空（clearQueue / restore）

export const audioMachine = setup({
  types: {
    context: {} as { audio: HTMLAudioElement },
    input: {} as AudioMachineInput,
    events: {} as AudioMachineEvent,
  },
  guards: {
    /** waiting 因 seek 引起则忽略（HTMLMediaElement.seeking 此刻已为 true）。 */
    notSeeking: ({ context }) => !context.audio.seeking,
  },
}).createMachine({
  id: 'audio',
  initial: 'idle',
  context: ({ input }) => ({ audio: input.audio }),
  states: {
    idle: {
      on: { LOAD_START: 'loading' },
    },
    loading: {
      on: {
        LOADED_METADATA: 'ready',
        ERROR: 'error',
      },
    },
    ready: {
      on: {
        PLAYING: 'playing',
        // 切歌：ready 中直接 load 新曲
        LOAD_START: 'loading',
        ERROR: 'error',
      },
    },
    playing: {
      on: {
        PAUSE: 'paused',
        WAITING: { target: 'buffering', guard: 'notSeeking' },
        ENDED: 'ended',
        // 切歌：播放中点下一首，load 新曲
        LOAD_START: 'loading',
        ERROR: 'error',
      },
    },
    paused: {
      on: {
        PLAYING: 'playing',
        // 暂停中切歌
        LOAD_START: 'loading',
        ERROR: 'error',
      },
    },
    buffering: {
      on: {
        PLAYING: 'playing',
        CAN_PLAY: 'playing',
        PAUSE: 'paused',
        // 切歌：卡顿中换曲
        LOAD_START: 'loading',
        ERROR: 'error',
      },
    },
    ended: {
      on: {
        // 播完自动切下一首（resolveAndPlay → load）
        LOAD_START: 'loading',
        RESET: 'idle',
      },
    },
    error: {
      on: {
        LOAD_START: 'loading',
        RESET: 'idle',
      },
    },
  },
});
