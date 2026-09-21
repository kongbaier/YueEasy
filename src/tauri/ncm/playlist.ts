// NCM 歌单域 IPC 入口（infra 层）。
// 每个函数 = 一次 invoke 封装；返回值即 Rust 侧产出的 Ui Model。

import { invoke } from '@tauri-apps/api/core';
import type { Playlist, PlaylistHotTag, PlaylistPage } from '@/shared/types/uiModels';

export const playlistDetail = (id: number): Promise<Playlist> =>
  invoke<Playlist>('ncm_playlist_detail', { id });

export const userPlaylist = (uid: number): Promise<Playlist[]> =>
  invoke<Playlist[]>('ncm_user_playlist', { uid });

export const personalized = (limit = 30): Promise<Playlist[]> =>
  invoke<Playlist[]>('ncm_personalized', { limit });

/** 兼容旧调用名；等价 `personalized`。 */
export const personalizedPlaylist = personalized;

export const topPlaylist = (
  cat = '全部',
  limit = 30,
  offset = 0,
): Promise<PlaylistPage> =>
  invoke<PlaylistPage>('ncm_top_playlist', { cat, limit, offset });

export const playlistRecommend = (): Promise<Playlist[]> =>
  invoke<Playlist[]>('ncm_recommend_resource');

export const playlistHot = (): Promise<PlaylistHotTag[]> =>
  invoke<PlaylistHotTag[]>('ncm_playlist_hot');
