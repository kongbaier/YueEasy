// 应用级能力 infra 封装（@tauri-apps/api/app / 插件 API 统一入口）。

import { getVersion } from '@tauri-apps/api/app';

/** 获取应用版本号。 */
export function getAppVersion(): Promise<string> {
  return getVersion();
}
