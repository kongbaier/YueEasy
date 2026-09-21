// NCM 评论域 IPC 入口（infra 层）。
// 每个函数 = 一次 invoke 封装；返回值即 Rust 侧产出的 Ui Model。

import { invoke } from '@tauri-apps/api/core';
import type { CommentPage } from '@/shared/types/uiModels';

export const commentPlaylist = (
  id: number,
  limit = 20,
  offset = 0,
): Promise<CommentPage> =>
  invoke<CommentPage>('ncm_comment_playlist', { id, limit, offset });

export const commentMusic = (
  id: number,
  limit = 20,
  offset = 0,
): Promise<CommentPage> =>
  invoke<CommentPage>('ncm_comment_music', { id, limit, offset });
