import type { CloudPage } from '@/shared/types/uiModels';
import { ncm } from '@/tauri/ncm';

/**
 * 音乐云盘分页（`offset` 从 0 开始）。
 * 登录态由后端 cookie 决定，前端只透传分页参数。
 */
export function getCloudFiles(limit = 30, offset = 0): Promise<CloudPage> {
  return ncm.userCloud(limit, offset);
}
