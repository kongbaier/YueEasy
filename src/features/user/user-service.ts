import type { UserDetail } from '@/shared/types/uiModels';
import { ncm } from '@/tauri/ncm';

/** 用户主页详情（等级 / 听歌数 / 歌单数等只在详情接口返回）。 */
export function getUserDetail(uid: number): Promise<UserDetail> {
  return ncm.userDetail(uid);
}
