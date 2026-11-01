// NCM 用户域 IPC 入口（infra 层）。
// 每个函数 = 一次 invoke 封装；返回值即 Rust 侧产出的 Ui Model。

import { invoke } from '@tauri-apps/api/core';
import type { UserDetail } from '@/shared/types/uiModels';

export const userDetail = (uid: number): Promise<UserDetail> =>
  invoke<UserDetail>('ncm_user_detail', { uid });
