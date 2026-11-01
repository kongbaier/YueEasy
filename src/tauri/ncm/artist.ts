// NCM 歌手域 IPC 入口（infra 层）。
// 每个函数 = 一次 invoke 封装；返回值即 Rust 侧产出的 Ui Model。

import { invoke } from '@tauri-apps/api/core';
import type { ArtistAlbumPage, ArtistDetail } from '@/shared/types/uiModels';

export const artistDetail = (id: number): Promise<ArtistDetail> =>
  invoke<ArtistDetail>('ncm_artist_detail', { id });

export const artistAlbums = (
  id: number,
  limit = 30,
  offset = 0,
): Promise<ArtistAlbumPage> =>
  invoke<ArtistAlbumPage>('ncm_artist_albums', { id, limit, offset });
