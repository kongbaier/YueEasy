// NCM 发现页域 IPC 入口（infra 层）。
// 每个函数 = 一次 invoke 封装；返回值即 Rust 侧产出的 Ui Model。

import { invoke } from '@tauri-apps/api/core';
import type {
  Banner,
  DragonBallItem,
  IntelligenceSong,
  Song,
} from '@/shared/types/uiModels';

export const banner = (): Promise<Banner[]> =>
  invoke<Banner[]>('ncm_banner', { bannerType: 0 });

export const recommendSongs = (): Promise<Song[]> =>
  invoke<Song[]>('ncm_recommend_songs');

export const personalFm = (): Promise<Song[]> => invoke<Song[]>('ncm_personal_fm');

export const fmTrash = (id: number): Promise<void> =>
  invoke<void>('ncm_fm_trash', { id });

/** 首页圆形入口（含「私人雷达」，登录后调用）。 */
export const dragonBall = (): Promise<DragonBallItem[]> =>
  invoke<DragonBallItem[]>('ncm_homepage_dragon_ball');

/** 心动模式/智能播放：基于当前播放的歌曲生成相似歌曲。 */
export const playmodeIntelligenceList = (
  id: number,
  pid: number,
  count = 20,
): Promise<IntelligenceSong[]> =>
  invoke<IntelligenceSong[]>('ncm_playmode_intelligence_list', { id, pid, count });
