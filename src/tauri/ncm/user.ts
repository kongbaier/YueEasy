// NCM 用户域 IPC 入口（infra 层）。
// 每个函数 = 一次 invoke 封装；返回值即 Rust 侧产出的 Ui Model。

import { invoke } from '@tauri-apps/api/core';
import type { CloudPage, UserDetail } from '@/shared/types/uiModels';

export const userDetail = (uid: number): Promise<UserDetail> =>
  invoke<UserDetail>('ncm_user_detail', { uid });

/** 音乐云盘分页：登录态由后端 cookie 决定，无需 uid。 */
export const userCloud = (limit = 30, offset = 0): Promise<CloudPage> =>
  invoke<CloudPage>('ncm_user_cloud', { limit, offset });
