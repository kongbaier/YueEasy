import type { AlbumDetail } from '@/shared/types/uiModels';
import { ncm } from '@/tauri/ncm';

export async function getAlbumDetail(id: number): Promise<AlbumDetail> {
  return ncm.albumDetail(id);
}
