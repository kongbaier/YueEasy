// NCM 鉴权域 IPC 入口（infra 层）。
// 每个函数 = 一次 invoke 封装；返回值即 Rust 侧产出的 Ui Model（见 shared/types/entities.ts），
// 本层不再做任何字段映射。

import { invoke } from '@tauri-apps/api/core';
import type {
  AuthSession,
  LoginStatus,
  QrCheck,
  QrCreate,
  QrKey,
} from '@/shared/types/uiModels';

/** 登录（密码 / 验证码二选一）。 */
export const loginCellphone = (
  params: { phone: string } & ({ password: string } | { captcha: string }),
): Promise<AuthSession> => invoke<AuthSession>('ncm_login_cellphone', params);

export const captchaSent = (phone: string): Promise<void> =>
  invoke<void>('ncm_captcha_sent', { phone });

export const captchaVerify = (phone: string, captcha: string): Promise<void> =>
  invoke<void>('ncm_captcha_verify', { phone, captcha });

export const qrKey = (): Promise<QrKey> => invoke<QrKey>('ncm_login_qr_key');

export const qrCreate = (key: string): Promise<QrCreate> =>
  invoke<QrCreate>('ncm_login_qr_create', { key, qrimg: 'true' });

export const qrCheck = (key: string): Promise<QrCheck> =>
  invoke<QrCheck>('ncm_login_qr_check', { key });

export const loginStatus = (): Promise<LoginStatus> =>
  invoke<LoginStatus>('ncm_login_status');
