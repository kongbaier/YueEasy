// NCM cookie 命令（infra 层）：与 auth 域同层，独立成文件避免混入登录流程。

import { invoke } from '@tauri-apps/api/core';

export const setNcmCookie = (cookie: string): Promise<void> =>
  invoke<void>('ncm_set_cookie', { cookie });

export const getNcmCookie = (): Promise<string> => invoke<string>('ncm_get_cookie');

export const clearNcmCookie = (): Promise<void> => invoke<void>('ncm_clear_cookie');
